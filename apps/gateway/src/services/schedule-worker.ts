import { db, scheduledJobs, eq, and, sql } from '@hatch/database';
import type { ScheduledJob } from '@hatch/database';
import { harnessPool } from './harness-pool.js';
import rruleLib from 'rrule';

const { rrulestr } = rruleLib;

// ─── Constants ──────────────────────────────────────────────────────────────

const TAG = '[schedule-worker]';
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
const POLL_INTERVAL_MS =
  Number(process.env.SCHEDULE_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ─── Core ───────────────────────────────────────────────────────────────────

async function fireJob(job: ScheduledJob): Promise<void> {
  const jobTag = `${TAG} [${job.name}/${job.id.slice(0, 8)}]`;

  try {
    console.log(`${jobTag} firing — prompt: "${job.prompt.slice(0, 80)}…"`);

    // 1. Create a new thread with platform:'schedule' state + schedule metadata
    const title = `Schedule: ${job.name} — ${new Date().toISOString()}`;
    const { threadId } = await harnessPool.createScheduleThread(
      job.workspaceId,
      title,
      { scheduleId: job.id, scheduleName: job.name },
    );

    console.log(`${jobTag} thread created: ${threadId}`);

    // 2. Send the prompt (non-blocking — fires followUp internally)
    harnessPool.send(threadId, job.prompt);

    // 3. Compute next occurrence
    const rule = rrulestr(job.rruleStr);
    const nextOccurrence = rule.after(new Date());

    // 4. Update the job in DB
    if (nextOccurrence) {
      const nextRunAt = nextOccurrence.toISOString();
      await db
        .update(scheduledJobs)
        .set({
          lastRunAt: new Date().toISOString(),
          nextRunAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledJobs.id, job.id));
      console.log(`${jobTag} next run at: ${nextRunAt}`);
    } else {
      // One-shot schedule exhausted — disable it
      await db
        .update(scheduledJobs)
        .set({
          lastRunAt: new Date().toISOString(),
          nextRunAt: null,
          enabled: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledJobs.id, job.id));
      console.log(`${jobTag} no next occurrence — schedule disabled`);
    }

    console.log(`${jobTag} fired successfully`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${jobTag} FAILED to fire: ${msg}`);

    // Still advance nextRunAt to prevent infinite retry loops
    try {
      const rule = rrulestr(job.rruleStr);
      const nextOccurrence = rule.after(new Date());
      await db
        .update(scheduledJobs)
        .set({
          nextRunAt: nextOccurrence?.toISOString() ?? null,
          enabled: nextOccurrence ? true : false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledJobs.id, job.id));
    } catch (advanceErr) {
      console.error(`${jobTag} FAILED to advance nextRunAt: ${advanceErr}`);
    }
  }
}

async function pollTick(): Promise<void> {
  if (isRunning) {
    console.log(`${TAG} tick skipped — previous tick still running`);
    return;
  }
  isRunning = true;
  const tickStart = Date.now();

  try {
    const now = new Date().toISOString();

    const dueJobs = await db
      .select()
      .from(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.enabled, true),
          eq(scheduledJobs.isDeleted, false),
          sql`${scheduledJobs.nextRunAt} IS NOT NULL`,
          sql`${scheduledJobs.nextRunAt} <= ${now}`,
        ),
      );

    if (dueJobs.length === 0) return;

    console.log(`${TAG} found ${dueJobs.length} due job(s)`);

    for (const job of dueJobs) {
      await fireJob(job);
    }

    console.log(`${TAG} tick done — ${dueJobs.length} job(s) in ${Date.now() - tickStart}ms`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${TAG} tick FAILED: ${msg}`);
  } finally {
    isRunning = false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function startScheduleWorker(): void {
  if (pollTimer) return;
  console.log(`${TAG} started — interval=${POLL_INTERVAL_MS / 1000}s`);
  pollTimer = setInterval(() => {
    pollTick();
  }, POLL_INTERVAL_MS);
  // Run once immediately on startup
  pollTick();
}

export function stopScheduleWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log(`${TAG} stopped`);
  }
}
