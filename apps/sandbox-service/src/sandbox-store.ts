import { DockerSandbox, type DockerSandboxOptions } from './docker-sandbox.js';

// Default: 10 minutes of inactivity before auto-destroy
const SANDBOX_TTL_MS = Number(process.env.SANDBOX_TTL_MS) || 10 * 60 * 1000;
// Reaper checks every 30 seconds
const REAPER_INTERVAL_MS = Number(process.env.SANDBOX_REAPER_INTERVAL_MS) || 30 * 1000;

interface SandboxEntry {
  sandbox: DockerSandbox;
  lastActivity: number;
}

const sandboxes = new Map<string, SandboxEntry>();
let reaperTimer: ReturnType<typeof setInterval> | null = null;

export function getSandbox(id: string): DockerSandbox | undefined {
  return sandboxes.get(id)?.sandbox;
}

export function touchSandbox(id: string): void {
  const entry = sandboxes.get(id);
  if (entry) entry.lastActivity = Date.now();
}

export async function createSandbox(options: DockerSandboxOptions): Promise<DockerSandbox> {
  const existing = sandboxes.get(options.id!);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing.sandbox;
  }

  const sandbox = new DockerSandbox(options);
  await sandbox.start();
  sandboxes.set(sandbox.id, { sandbox, lastActivity: Date.now() });
  return sandbox;
}

export async function destroySandbox(id: string): Promise<boolean> {
  const entry = sandboxes.get(id);
  if (!entry) return false;
  await entry.sandbox.destroy();
  sandboxes.delete(id);
  return true;
}

export async function destroyAll(): Promise<void> {
  stopReaper();
  const entries = [...sandboxes.entries()];
  for (const [id, entry] of entries) {
    try {
      await entry.sandbox.destroy();
    } catch {
      // best-effort
    }
    sandboxes.delete(id);
  }
}

// ─── Reaper ─────────────────────────────────────────────────────────────────

async function reap(): Promise<void> {
  const now = Date.now();
  for (const [id, entry] of sandboxes) {
    const idle = now - entry.lastActivity;
    if (idle >= SANDBOX_TTL_MS) {
      console.log(`[reaper] destroying stale sandbox ${id} (idle ${Math.round(idle / 1000)}s)`);
      try {
        await entry.sandbox.destroy();
      } catch {
        // best-effort
      }
      sandboxes.delete(id);
    }
  }
}

export function startReaper(): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(reap, REAPER_INTERVAL_MS);
  console.log(`[reaper] started — TTL ${SANDBOX_TTL_MS / 1000}s, check every ${REAPER_INTERVAL_MS / 1000}s`);
}

export function stopReaper(): void {
  if (reaperTimer) {
    clearInterval(reaperTimer);
    reaperTimer = null;
  }
}
