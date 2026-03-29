import { Harness } from '@hatch/harness';
import type { HarnessEvent } from '@hatch/harness';
import { db, workspaceModes, eq, asc } from '@hatch/database';
import {
  createAgent,
  createWorkspace,
  DEFAULT_WORKSPACE_ID,
  storage,
} from './agent-factory.js';
import { createModeTools } from '../tools/mode-tools.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PoolEntry {
  harness: Harness;
  threadId: string;
  workspaceId: string;
  title: string;
  lastActivityAt: number;
  unsub: () => void;
}

export type PoolListener = (threadId: string, event: HarnessEvent) => void;

// ─── Constants ──────────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

// ─── Pool Manager ───────────────────────────────────────────────────────────

export class HarnessPoolManager {
  private pool = new Map<string, PoolEntry>();
  private creating = new Map<string, Promise<PoolEntry>>();
  private listeners: PoolListener[] = [];
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  // ── Private Helpers ─────────────────────────────────────────────────────

  private async _buildHarness(
    workspaceId: string,
    opts?: { initialState?: Record<string, unknown> },
  ): Promise<Harness> {
    const { agent, modelSettings } = await createAgent(workspaceId);

    // Load modes from DB
    const dbModes = await db
      .select()
      .from(workspaceModes)
      .where(eq(workspaceModes.workspaceId, workspaceId))
      .orderBy(asc(workspaceModes.sortOrder));

    const modes = dbModes.length > 0
      ? dbModes.map((m) => ({
          id: m.modeId,
          name: m.name,
          default: m.isDefault,
          color: m.color ?? undefined,
          defaultModelId: m.model ?? undefined,
          agent,
        }))
      : [{ id: 'chat', name: 'Chat', default: true as const, agent }];

    // Build switch_mode tool only when workspace has multiple modes
    const harnessRef: { current: Harness | null } = { current: null };
    const modeTools = modes.length > 1
      ? createModeTools(harnessRef, modes.map((m) => ({ id: m.id, name: m.name ?? m.id })))
      : undefined;

    const harness = new Harness({
      id: crypto.randomUUID(),
      resourceId: workspaceId,
      storage,
      modes,
      tools: modeTools,
      initialState: { yolo: true, ...opts?.initialState },
      modelSettings,
    });

    harnessRef.current = harness;

    return harness;
  }

  private _registerEntry(entry: PoolEntry): void {
    const unsub = entry.harness.subscribe((event: HarnessEvent) => {
      if (event.type === 'error') {
        console.error('[harness] ERROR:', (event as any).error?.message ?? event);
      }
      for (const listener of this.listeners) {
        listener(entry.threadId, event);
      }
    });
    entry.unsub = unsub;
    this.pool.set(entry.threadId, entry);
  }

  private async _storeThreadMetadata(
    threadId: string,
    workspaceId: string,
    extra?: Record<string, string | undefined>,
  ): Promise<void> {
    try {
      const memory = await storage.getStore('memory');
      if (!memory) return;
      const thread = await memory.getThreadById({ threadId });
      if (thread) {
        await memory.updateThread({
          id: threadId,
          title: thread.title ?? '',
          metadata: { ...thread.metadata, workspaceId, ...extra },
        });
      }
    } catch (err) {
      console.error(`[harness-pool] failed to store thread metadata for ${threadId}:`, err);
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async getOrCreate(
    threadId: string,
    workspaceId: string = DEFAULT_WORKSPACE_ID,
  ): Promise<PoolEntry> {
    const existing = this.pool.get(threadId);
    if (existing) {
      existing.lastActivityAt = Date.now();
      return existing;
    }

    const inflight = this.creating.get(threadId);
    if (inflight) return inflight;

    const promise = this._doCreate(threadId, workspaceId);
    this.creating.set(threadId, promise);
    try {
      return await promise;
    } finally {
      this.creating.delete(threadId);
    }
  }

  private async _doCreate(
    threadId: string,
    workspaceId: string,
  ): Promise<PoolEntry> {
    const harness = await this._buildHarness(workspaceId);
    await harness.init();

    let finalThreadId = threadId;
    try {
      await harness.switchThread({ threadId: finalThreadId });
    } catch {
      const thread = await harness.createThread({ title: '' });
      finalThreadId = thread.id;
    }

    // Store workspaceId in thread metadata
    await this._storeThreadMetadata(finalThreadId, workspaceId);

    const entry: PoolEntry = {
      harness,
      threadId: finalThreadId,
      workspaceId,
      title: '',
      lastActivityAt: Date.now(),
      unsub: () => { },
    };

    this._registerEntry(entry);
    return entry;
  }

  get(threadId: string): PoolEntry | undefined {
    return this.pool.get(threadId);
  }

  async send(threadId: string, content: string): Promise<void> {
    const entry = this.pool.get(threadId);
    if (!entry) return;

    entry.lastActivityAt = Date.now();

    const userEvent = {
      type: 'user_message',
      content,
      createdAt: new Date().toISOString(),
    } as any;
    for (const listener of this.listeners) {
      listener(threadId, userEvent);
    }

    entry.harness.followUp({ content }).catch((err) => {
      console.error(`[harness-pool] followUp error for thread ${threadId}:`, err);
    });
  }

  abort(threadId: string): boolean {
    const entry = this.pool.get(threadId);
    if (!entry) return false;
    entry.harness.abort();
    return true;
  }

  isRunning(threadId: string): boolean {
    const entry = this.pool.get(threadId);
    return entry?.harness.isRunning() ?? false;
  }

  subscribe(listener: PoolListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  async createThread(
    workspaceId: string = DEFAULT_WORKSPACE_ID,
    title?: string,
  ): Promise<{ threadId: string; entry: PoolEntry }> {
    const harness = await this._buildHarness(workspaceId);
    await harness.init();
    const thread = await harness.createThread({ title: title || '' });
    const threadId = thread.id;

    // Store workspaceId in thread metadata
    await this._storeThreadMetadata(threadId, workspaceId);

    const entry: PoolEntry = {
      harness,
      threadId,
      workspaceId,
      title: title || '',
      lastActivityAt: Date.now(),
      unsub: () => { },
    };

    this._registerEntry(entry);
    return { threadId, entry };
  }

  async createScheduleThread(
    workspaceId: string,
    title: string,
    meta?: { scheduleId?: string; scheduleName?: string },
  ): Promise<{ threadId: string; entry: PoolEntry }> {
    const harness = await this._buildHarness(workspaceId, {
      initialState: { platform: 'schedule' },
    });
    await harness.init();
    const thread = await harness.createThread({ title });
    const threadId = thread.id;

    await this._storeThreadMetadata(threadId, workspaceId, meta);

    const entry: PoolEntry = {
      harness,
      threadId,
      workspaceId,
      title,
      lastActivityAt: Date.now(),
      unsub: () => { },
    };

    this._registerEntry(entry);
    return { threadId, entry };
  }

  async remove(threadId: string): Promise<void> {
    const entry = this.pool.get(threadId);
    if (!entry) return;

    entry.unsub();
    try {
      await entry.harness.stopHeartbeats();
      await entry.harness.destroyWorkspace();
    } catch (err) {
      console.error(`[harness-pool] cleanup error for ${threadId}:`, err);
    }
    this.pool.delete(threadId);
  }

  startSweeper(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
  }

  stopSweeper(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  getStatus(threadId: string) {
    const entry = this.pool.get(threadId);
    if (!entry) return { running: false, threadId: null, pending: { toolApproval: null, question: null, planApproval: null }, runBuffer: [] as unknown[], harnessState: null };
    const ds = (entry.harness as any).displayState ?? {};
    return {
      running: entry.harness.isRunning(),
      threadId: entry.harness.getCurrentThreadId(),
      pending: {
        toolApproval: ds.pendingApproval ?? null,
        question: ds.pendingQuestion ?? null,
        planApproval: ds.pendingPlanApproval ?? null,
      },
      runBuffer: [] as unknown[],
      harnessState: entry.harness.getState(),
    };
  }

  async getMessages(threadId: string) {
    const entry = this.pool.get(threadId);
    if (!entry) return { messages: [] };
    const messages = await entry.harness.listMessagesForThread({ threadId });
    return { messages };
  }

  approveTool(threadId: string, decision: 'allow' | 'deny' | 'always_allow_category'): boolean {
    const entry = this.pool.get(threadId);
    if (!entry) return false;
    const mapped = decision === 'allow' ? 'approve' : decision === 'deny' ? 'decline' : 'always_allow_category';
    entry.harness.respondToToolApproval({ decision: mapped as any });
    return true;
  }

  answerQuestion(threadId: string, questionId: string, answer: string): boolean {
    const entry = this.pool.get(threadId);
    if (!entry) return false;
    entry.harness.respondToQuestion({ questionId, answer });
    return true;
  }

  async approvePlan(threadId: string, planId: string, response: 'approved' | 'rejected', feedback?: string): Promise<boolean> {
    const entry = this.pool.get(threadId);
    if (!entry) return false;
    await entry.harness.respondToPlanApproval({ planId, response: { action: response, feedback } });
    return true;
  }

  async switchMode(threadId: string, modeId: string): Promise<boolean> {
    const entry = this.pool.get(threadId);
    if (!entry) return false;
    await entry.harness.switchMode({ modeId });
    return true;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [threadId, entry] of this.pool) {
      if (entry.harness.isRunning()) continue;
      if (now - entry.lastActivityAt < IDLE_TIMEOUT_MS) continue;
      console.log(`[harness-pool] sweeping idle harness for thread ${threadId}`);
      this.remove(threadId).catch((err) => {
        console.error(`[harness-pool] sweep error for ${threadId}:`, err);
      });
    }
  }
}

export const harnessPool = new HarnessPoolManager();
