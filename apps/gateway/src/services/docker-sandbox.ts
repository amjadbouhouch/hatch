import { MastraSandbox, MountManager, SandboxError } from '@mastra/core/workspace';
import type {
  MastraSandboxOptions,
  CommandResult,
  ExecuteCommandOptions,
  SandboxInfo,
  InstructionsOption,
  ProviderStatus,
  MountResult,
  WorkspaceFilesystem,
  FilesystemMountConfig,
} from '@mastra/core/workspace';
import { execFile, spawn, execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);



export interface DockerSandboxOptions extends MastraSandboxOptions {
  id?: string;
  image?: string;
  workingDirectory?: string;
  containerWorkDir?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  instructions?: InstructionsOption;
  dockerPath?: string;
  containerName?: string;
  extraRunArgs?: string[];
}

export class DockerSandbox extends MastraSandbox {
  status: ProviderStatus = "pending";
  readonly id: string;
  readonly name = 'DockerSandbox';
  readonly provider = 'docker';

  readonly mounts: MountManager;

  private _containerId: string | undefined;
  private readonly _containerName: string;
  private readonly _image: string;
  private readonly _hostWorkDir: string;
  private readonly _containerWorkDir: string;
  private readonly _env: NodeJS.ProcessEnv;
  private readonly _defaultTimeout: number;
  private readonly _dockerPath: string;
  private readonly _extraRunArgs: string[];
  private readonly _instructionsOverride: InstructionsOption | undefined;
  private readonly _createdAt: Date;
  private _cleanupHandlers: Array<() => void> = [];
  private _bindMounts: Map<string, string> = new Map(); // containerPath → hostPath

  constructor(options: DockerSandboxOptions = {}) {
    super({
      name: 'DockerSandbox',
      onStart: options.onStart,
      onStop: options.onStop,
      onDestroy: options.onDestroy,
    });

    this.id = options.id ?? `docker-${crypto.randomUUID().slice(0, 8)}`;
    this._image = options.image ?? 'node:22-alpine';
    this._hostWorkDir = options.workingDirectory ?? '';
    this._containerWorkDir = options.containerWorkDir ?? '/workspace';
    this._env = options.env ?? {};
    this._defaultTimeout = options.timeout ?? 30_000;
    this._dockerPath = options.dockerPath ?? 'docker';
    this._containerName = options.containerName ?? `hatch-sandbox-${this.id}`;
    this._extraRunArgs = options.extraRunArgs ?? [];
    this._instructionsOverride = options.instructions;
    this._createdAt = new Date();

    this.mounts = new MountManager({
      mount: (fs, path) => this.mount(fs, path),
      logger: console as any,
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    // 1. Check Docker is available
    const available = await this._isDockerAvailable();
    if (!available) {
      throw new SandboxError(
        'Docker daemon is not running or docker is not installed. Run "docker info" to diagnose.',
        'DOCKER_UNAVAILABLE',
      );
    }

    // 2. Check if container already exists
    const state = await this._containerState();
    if (state === 'running') {
      // Reuse the existing container
      const { stdout } = await this._dockerCmd([
        'inspect',
        '--format',
        '{{.Id}}',
        this._containerName,
      ]);
      this._containerId = stdout.trim();
      this._registerCleanupHandlers();
      return;
    }
    if (state === 'stopped') {
      // Remove stale container before recreating
      await this._dockerCmd(['rm', '-f', this._containerName]);
    }

    // 3. Ensure host working directory exists
    if (this._hostWorkDir) {
      await mkdir(this._hostWorkDir, { recursive: true });
    }

    // 4. Start the container
    const runArgs = this._buildRunArgs();

    const { stdout } = await this._dockerCmd(runArgs);
    this._containerId = stdout.trim();

    // 5. Register cleanup handlers
    this._registerCleanupHandlers();
  }

  async stop(): Promise<void> {
    if (this._containerId) {
      try {
        await this._dockerCmd(['stop', '-t', '5', this._containerId]);
      } catch {
        // Container may already be stopped
      }
    }
    this._removeCleanupHandlers();
  }

  async destroy(): Promise<void> {
    if (this._containerId) {
      try {
        await this._dockerCmd(['rm', '-f', this._containerId]);
      } catch {
        // Container may already be removed
      }
      this._containerId = undefined;
    }
    this._removeCleanupHandlers();
  }

  // ─── Mounts ─────────────────────────────────────────────────────────────────

  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    const config = filesystem.getMountConfig?.();

    if (config?.type === 'local') {
      const hostPath = (config as FilesystemMountConfig & { basePath: string }).basePath;
      await mkdir(hostPath, { recursive: true });

      // Skip if the container already has this bind mount
      if (this._containerId) {
        const hasMount = await this._hasBindMount(hostPath, mountPath);
        if (hasMount) {
          this._bindMounts.set(mountPath, hostPath);
          return { success: true, mountPath };
        }
      }

      this._bindMounts.set(mountPath, hostPath);

      // Recreate container with the new bind mount
      if (this._containerId) {
        await this._recreateContainer();
      }

      return { success: true, mountPath };
    }

    return {
      success: false,
      mountPath,
      error: `Unsupported mount type: ${config?.type ?? 'unknown'}`,
    };
  }

  async unmount(mountPath: string): Promise<void> {
    this._bindMounts.delete(mountPath);

    if (this._containerId) {
      await this._recreateContainer();
    }
  }

  private async _recreateContainer(): Promise<void> {
    this._removeCleanupHandlers();
    try {
      await this._dockerCmd(['rm', '-f', this._containerId!]);
    } catch {
      // ignore
    }
    this._containerId = undefined;

    const runArgs = this._buildRunArgs();
    const { stdout } = await this._dockerCmd(runArgs);
    this._containerId = stdout.trim();
    this._registerCleanupHandlers();
  }

  // ─── Command Execution ──────────────────────────────────────────────────────

  async executeCommand(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<CommandResult> {
    await this.ensureRunning();

    const fullCommand = args?.length ? `${command} ${args.join(' ')}` : command;
    const timeout = options?.timeout ?? this._defaultTimeout;
    const startTime = Date.now();

    const execArgs: string[] = ['exec'];

    // Working directory override
    if (options?.cwd) {
      execArgs.push('-w', options.cwd);
    }

    // Per-command environment variables
    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        if (value !== undefined) {
          execArgs.push('--env', `${key}=${value}`);
        }
      }
    }

    execArgs.push(this._containerId!, 'sh', '-c', fullCommand);

    return new Promise<CommandResult>((resolve) => {
      const child = spawn(this._dockerPath, execArgs, { stdio: 'pipe' });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;
      let settled = false;

      const settle = (exitCode: number) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          success: exitCode === 0,
          exitCode,
          stdout,
          stderr,
          executionTimeMs: Date.now() - startTime,
          timedOut,
          killed,
          command,
          args,
        });
      };

      // Timeout
      const timer = setTimeout(() => {
        timedOut = true;
        killed = true;
        child.kill('SIGKILL');
      }, timeout);

      // Abort signal
      if (options?.abortSignal) {
        options.abortSignal.addEventListener(
          'abort',
          () => {
            killed = true;
            child.kill('SIGKILL');
          },
          { once: true },
        );
      }

      // Capture output
      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        options?.onStdout?.(chunk);
      });

      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        options?.onStderr?.(chunk);
      });

      child.on('close', (code) => {
        settle(code ?? 1);
      });

      child.on('error', (err) => {
        stderr += err.message;
        settle(1);
      });
    });
  }

  // ─── Instructions ───────────────────────────────────────────────────────────

  getInstructions(opts?: { requestContext?: unknown }): string {
    const defaultInstructions = [
      `Docker sandbox (image: ${this._image}).`,
      `Working directory: ${this._containerWorkDir}.`,
      `Commands execute inside an isolated container.`,
    ].join(' ');

    if (typeof this._instructionsOverride === 'string') {
      return this._instructionsOverride;
    }
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({
        defaultInstructions,
        requestContext: opts?.requestContext as any,
      });
    }
    return defaultInstructions;
  }

  // ─── Info ───────────────────────────────────────────────────────────────────

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt,
      metadata: {
        image: this._image,
        containerName: this._containerName,
        containerId: this._containerId,
        hostWorkDir: this._hostWorkDir,
        containerWorkDir: this._containerWorkDir,
      },
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async _hasBindMount(hostPath: string, containerPath: string): Promise<boolean> {
    try {
      const { stdout } = await this._dockerCmd([
        'inspect',
        '--format',
        '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}',
        this._containerName,
      ]);
      return stdout.includes(`${hostPath}:${containerPath}`);
    } catch {
      return false;
    }
  }

  private _buildRunArgs(): string[] {
    const args: string[] = [
      'run',
      '-d',
      '--name',
      this._containerName,
      '-w',
      this._containerWorkDir,
    ];

    // Primary bind mount (when workingDirectory is set explicitly)
    if (this._hostWorkDir) {
      args.push('-v', `${this._hostWorkDir}:${this._containerWorkDir}`);
    }

    // Additional bind mounts from mount()
    for (const [containerPath, hostPath] of this._bindMounts) {
      args.push('-v', `${hostPath}:${containerPath}`);
    }

    for (const [key, value] of Object.entries(this._env)) {
      if (value !== undefined) {
        args.push('--env', `${key}=${value}`);
      }
    }

    args.push(...this._extraRunArgs);
    args.push(this._image, 'tail', '-f', '/dev/null');

    return args;
  }

  private async _dockerCmd(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(this._dockerPath, args, {
        timeout: 60_000,
      });
      return { stdout, stderr };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new SandboxError(`Docker binary not found at "${this._dockerPath}".`, 'DOCKER_NOT_FOUND');
      }
      // execFile errors include stdout/stderr on the error object
      if (err.killed || err.signal) {
        throw new SandboxError(`Docker command timed out: docker ${args.join(' ')}`, 'DOCKER_TIMEOUT');
      }
      throw new SandboxError(
        `Docker command failed (exit ${err.code}): docker ${args.join(' ')}\n${err.stderr ?? err.message}`,
        'DOCKER_CMD_FAILED',
      );
    }
  }

  private async _isDockerAvailable(): Promise<boolean> {
    try {
      await this._dockerCmd(['info']);
      return true;
    } catch {
      return false;
    }
  }

  private async _containerState(): Promise<'running' | 'stopped' | 'none'> {
    try {
      const { stdout } = await this._dockerCmd([
        'inspect',
        '--format',
        '{{.State.Running}}',
        this._containerName,
      ]);
      return stdout.trim() === 'true' ? 'running' : 'stopped';
    } catch {
      return 'none';
    }
  }

  private _registerCleanupHandlers(): void {
    this._removeCleanupHandlers();

    const cleanup = () => {
      if (this._containerId) {
        try {
          execFileSync(this._dockerPath, ['rm', '-f', this._containerId], {
            stdio: 'ignore',
            timeout: 5_000,
          });
        } catch {
          // Best-effort cleanup
        }
      }
    };

    const onExit = () => cleanup();
    const onSignal = () => {
      cleanup();
      process.exit(1);
    };

    process.on('exit', onExit);
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    this._cleanupHandlers = [
      () => process.removeListener('exit', onExit),
      () => process.removeListener('SIGINT', onSignal),
      () => process.removeListener('SIGTERM', onSignal),
    ];
  }

  private _removeCleanupHandlers(): void {
    for (const remove of this._cleanupHandlers) {
      remove();
    }
    this._cleanupHandlers = [];
  }
}
