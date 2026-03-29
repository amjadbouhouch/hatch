import { createTool } from '@mastra/core/tools';
import { db, scheduledJobs, eq, and } from '@hatch/database';
import { z } from 'zod/v4';
import rruleLib from 'rrule';
import type { HarnessRequestContext } from '@hatch/harness';
const { rrulestr } = rruleLib;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWorkspaceId(requestContext: any): string {
  const harnessCtx = requestContext?.get('harness') as HarnessRequestContext | undefined;
  if (!harnessCtx?.resourceId) {
    throw new Error('Missing workspaceId — harness context not available');
  }
  return harnessCtx.resourceId;
}

function assertNotScheduleRun(requestContext: any): void {
  const harnessCtx = requestContext?.get('harness') as HarnessRequestContext | undefined;
  const state = harnessCtx?.state as { platform?: string } | undefined;
  if (state?.platform === 'schedule') {
    throw new Error('Cannot modify schedules from within a scheduled run.');
  }
}

const rruleField = z.string().refine((val) => {
  try {
    rrulestr(val);
    return true;
  } catch {
    return false;
  }
}, 'Invalid RRULE string');

// ─── Create ─────────────────────────────────────────────────────────────────

const createScheduleInputSchema = z.object({
  label: z.string().min(1).describe('Short action label (e.g. "Creating weekly check-in schedule"). Use present progressive form.'),
  name: z.string().describe('Short name for the schedule'),
  description: z.string().optional().describe('What this schedule does and why'),
  rruleStr: rruleField.describe('RFC 5545 RRULE string'),
  timezone: z.string().default('UTC').describe('IANA timezone, e.g. "Africa/Tunis"'),
  prompt: z
    .string()
    .describe(
      `Self-contained markdown instructions to my future self. ` +
      `I will have NO conversation history when this fires — only workspaceId is in context.\n\n` +
      `**Structure:**\n` +
      `- **## Goal** — what I need to accomplish\n` +
      `- **## Context** — all IDs and names I will need\n` +
      `- **## Steps** — numbered actions referencing tools by name\n` +
      `- **## Constraints** — rules, filters, or limits to apply\n\n` +
      `Rules: embed every ID/name literally, reference tools with expected inputs, write in first-person "I".`
    ),
});

export const createScheduleTool = createTool({
  id: 'create_schedule',
  description: `Create a new recurring schedule for yourself.
    Uses RFC 5545 RRULE strings for recurrence patterns.
    Examples:
    - Every Monday at 7 AM: "DTSTART;TZID=Africa/Tunis:20260101T070000\\nRRULE:FREQ=WEEKLY;BYDAY=MO"
    - Weekdays at 6 PM: "DTSTART;TZID=Africa/Tunis:20260101T180000\\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA"
    - Once on a specific date: "DTSTART:20260215T070000Z\\nRRULE:FREQ=DAILY;COUNT=1"
    - Every Sunday at 9 PM: "DTSTART;TZID=Africa/Tunis:20260101T210000\\nRRULE:FREQ=WEEKLY;BYDAY=SU"`,
  inputSchema: createScheduleInputSchema,
  execute: async (input, context) => {
    assertNotScheduleRun(context?.requestContext);
    const workspaceId = getWorkspaceId(context?.requestContext);

    const rule = rrulestr(input.rruleStr);
    const nextRunAt = rule.after(new Date());

    const [job] = await db
      .insert(scheduledJobs)
      .values({
        name: input.name,
        description: input.description,
        rruleStr: input.rruleStr,
        timezone: input.timezone,
        prompt: input.prompt,
        nextRunAt: nextRunAt?.toISOString() ?? null,
        workspaceId,
      })
      .returning();

    return {
      id: job.id,
      name: job.name,
      nextRunAt: job.nextRunAt,
      humanReadable: rule.toText(),
    };
  },
});

// ─── List ───────────────────────────────────────────────────────────────────

export const listSchedulesTool = createTool({
  id: 'list_schedules',
  description: 'Get all your active schedules',
  inputSchema: z.object({
    label: z.string().min(1).describe('Short action label (e.g. "Listing active schedules"). Use present progressive form.'),
  }),
  execute: async (_input, context) => {
    const workspaceId = getWorkspaceId(context?.requestContext);

    const jobs = await db
      .select({
        id: scheduledJobs.id,
        name: scheduledJobs.name,
        description: scheduledJobs.description,
        rruleStr: scheduledJobs.rruleStr,
        enabled: scheduledJobs.enabled,
        nextRunAt: scheduledJobs.nextRunAt,
        lastRunAt: scheduledJobs.lastRunAt,
      })
      .from(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.workspaceId, workspaceId),
          eq(scheduledJobs.isDeleted, false),
        )
      )
      .orderBy(scheduledJobs.nextRunAt);

    return jobs.map((j) => ({
      ...j,
      humanReadable: rrulestr(j.rruleStr).toText(),
    }));
  },
});

// ─── Update ─────────────────────────────────────────────────────────────────

const updateScheduleInputSchema = createScheduleInputSchema
  .partial()
  .extend({
    label: z.string().min(1).describe('Short action label (e.g. "Updating schedule timing"). Use present progressive form.'),
    id: z.string().describe('Schedule ID to update'),
    enabled: z.boolean().optional(),
  });

export const updateScheduleTool = createTool({
  id: 'update_schedule',
  description: 'Update or disable one of your schedules by ID',
  inputSchema: updateScheduleInputSchema,
  execute: async (input, context) => {
    assertNotScheduleRun(context?.requestContext);
    const workspaceId = getWorkspaceId(context?.requestContext);

    // Build update payload
    const updates: Record<string, unknown> = {};
    if (input.enabled !== undefined) {
      updates.enabled = input.enabled;
      if (!input.enabled) updates.nextRunAt = null;
    }
    if (input.prompt) updates.prompt = input.prompt;
    if (input.name) updates.name = input.name;

    if (input.rruleStr) {
      updates.rruleStr = input.rruleStr;
      updates.nextRunAt = rrulestr(input.rruleStr).after(new Date())?.toISOString() ?? null;
    } else if (input.enabled) {
      // Re-enabling without new rrule — recompute nextRunAt from existing
      const [existing] = await db
        .select({ rruleStr: scheduledJobs.rruleStr })
        .from(scheduledJobs)
        .where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.workspaceId, workspaceId)));
      if (existing) {
        updates.nextRunAt = rrulestr(existing.rruleStr).after(new Date())?.toISOString() ?? null;
      }
    }

    const [job] = await db
      .update(scheduledJobs)
      .set(updates)
      .where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.workspaceId, workspaceId)))
      .returning();

    if (!job) return { error: 'Schedule not found' };
    return { id: job.id, name: job.name, enabled: job.enabled, nextRunAt: job.nextRunAt };
  },
});

// ─── Delete ─────────────────────────────────────────────────────────────────

export const deleteScheduleTool = createTool({
  id: 'delete_schedule',
  description: 'Delete one of your schedules by ID',
  inputSchema: z.object({
    label: z.string().min(1).describe('Short action label (e.g. "Removing schedule"). Use present progressive form.'),
    id: z.string().describe('Schedule ID to delete'),
  }),
  execute: async (input, context) => {
    assertNotScheduleRun(context?.requestContext);
    const workspaceId = getWorkspaceId(context?.requestContext);

    await db
      .update(scheduledJobs)
      .set({ isDeleted: true, enabled: false })
      .where(and(eq(scheduledJobs.id, input.id), eq(scheduledJobs.workspaceId, workspaceId)));

    return { deleted: true };
  },
});

// ─── Export bundle ──────────────────────────────────────────────────────────

export const scheduleTools = {
  createSchedule: createScheduleTool,
  listSchedules: listSchedulesTool,
  updateSchedule: updateScheduleTool,
  deleteSchedule: deleteScheduleTool,
};
