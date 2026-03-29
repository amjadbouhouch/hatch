import { MastraSandbox, MountManager, SandboxError } from '@mastra/core/workspace';
import type {
  CommandResult,
  ExecuteCommandOptions,
  FilesystemMountConfig,
  InstructionsOption,
  MastraSandboxOptions,
  MountResult,
  ProviderStatus,
  SandboxInfo,
  WorkspaceFilesystem,
} from '@mastra/core/workspace';

export interface RemoteSandboxOptions extends MastraSandboxOptions {
  id?: string;
  serviceUrl: string;
  image?: string;
  workingDirectory?: string;
  containerWorkDir?: string;
  containerName?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  instructions?: InstructionsOption;
  extraRunArgs?: string[];
  resourceLimits?: {
    memory?: string;
    cpus?: string;
    pidsLimit?: number;
    tmpfsSize?: string;
  };
  networkOptions?: { network?: string };
  readOnly?: boolean;
}

export class RemoteSandbox extends MastraSandbox {
  status: ProviderStatus = 'pending';
  readonly id: string;
  readonly name = 'RemoteSandbox';
  readonly provider = 'remote-docker';
  readonly mounts: MountManager;

  private readonly _serviceUrl: string;
  private readonly _options: RemoteSandboxOptions;
  private readonly _defaultTimeout: number;
  private readonly _instructionsOverride: InstructionsOption | undefined;
  private readonly _image: string;
  private readonly _containerWorkDir: string;
  private readonly _createdAt: Date;

  constructor(options: RemoteSandboxOptions) {
    super({
      name: 'RemoteSandbox',
      onStart: options.onStart,
      onStop: options.onStop,
      onDestroy: options.onDestroy,
    });

    this.id = options.id ?? `remote-${crypto.randomUUID().slice(0, 8)}`;
    this._serviceUrl = options.serviceUrl.replace(/\/$/, '');
    this._options = options;
    this._defaultTimeout = options.timeout ?? 30_000;
    this._instructionsOverride = options.instructions;
    this._image = options.image ?? 'hatch-sandbox';
    this._containerWorkDir = options.containerWorkDir ?? '/workspace';
    this._createdAt = new Date();

    this.mounts = new MountManager({
      mount: (fs, path) => this.mount(fs, path),
      logger: console as any,
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    const res = await fetch(`${this._serviceUrl}/sandboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: this._options.id,
        image: this._options.image,
        workingDirectory: this._options.workingDirectory,
        containerWorkDir: this._options.containerWorkDir,
        containerName: this._options.containerName,
        env: this._options.env,
        timeout: this._options.timeout,
        extraRunArgs: this._options.extraRunArgs,
        resourceLimits: this._options.resourceLimits,
        networkOptions: this._options.networkOptions,
        readOnly: this._options.readOnly,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new SandboxError(`Failed to create remote sandbox: ${body}`, 'REMOTE_CREATE_FAILED');
    }

    this.status = 'running';
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
  }

  async destroy(): Promise<void> {
    const res = await fetch(`${this._serviceUrl}/sandboxes/${this.id}`, {
      method: 'DELETE',
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new SandboxError(`Failed to destroy remote sandbox: ${body}`, 'REMOTE_DESTROY_FAILED');
    }

    this.status = 'stopped';
  }

  // ─── Command Execution ──────────────────────────────────────────────────────

  async executeCommand(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<CommandResult> {
    await this.ensureRunning();

    const timeout = options?.timeout ?? this._defaultTimeout;

    const res = await fetch(`${this._serviceUrl}/sandboxes/${this.id}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        args,
        options: {
          timeout,
          env: options?.env,
          cwd: options?.cwd,
        },
      }),
      signal: AbortSignal.timeout(timeout + 5_000), // HTTP timeout buffer
    });

    if (!res.ok) {
      const body = await res.text();
      throw new SandboxError(`Remote exec failed: ${body}`, 'REMOTE_EXEC_FAILED');
    }

    return res.json() as Promise<CommandResult>;
  }

  // ─── Mounts ─────────────────────────────────────────────────────────────────

  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    const config = filesystem.getMountConfig?.();

    if (config?.type !== 'local') {
      return {
        success: false,
        mountPath,
        error: `Unsupported mount type: ${config?.type ?? 'unknown'}`,
      };
    }

    const hostPath = (config as FilesystemMountConfig & { basePath: string }).basePath;

    const res = await fetch(`${this._serviceUrl}/sandboxes/${this.id}/mount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostPath, mountPath }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, mountPath, error: body };
    }

    return res.json() as Promise<MountResult>;
  }

  async unmount(_mountPath: string): Promise<void> {
    // Future: add unmount endpoint to sandbox-service
  }

  // ─── Instructions ───────────────────────────────────────────────────────────

  getInstructions(opts?: { requestContext?: unknown }): string {
    const defaults = [
      `Docker sandbox (image: ${this._image}).`,
      `Working directory: ${this._containerWorkDir}.`,
      `Commands execute inside an isolated container via sandbox-service.`,
    ].join(' ');

    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({
        defaultInstructions: defaults,
        requestContext: opts?.requestContext as any,
      });
    }
    return defaults;
  }

  // ─── Info ───────────────────────────────────────────────────────────────────

  async getInfo(): Promise<SandboxInfo> {
    try {
      const res = await fetch(`${this._serviceUrl}/sandboxes/${this.id}`);
      if (res.ok) return res.json() as Promise<SandboxInfo>;
    } catch {
      // fall through to local info
    }

    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt,
      metadata: { serviceUrl: this._serviceUrl },
    };
  }
}
