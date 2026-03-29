import { Hono } from 'hono';
import { z } from 'zod/v4';
import { zValidator } from '../middleware/zod-validator.js';
import { db, scheduledJobs, eq, and } from '@hatch/database';
import rruleLib from 'rrule';

const { rrulestr } = rruleLib;

// ─── Routes ─────────────────────────────────────────────────────────────────

export const scheduleRoutes = new Hono()

  // List schedules for a workspace
  .get('/schedules/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');

    const jobs = await db
      .select()
      .from(scheduledJobs)
      .where(
        and(
          eq(scheduledJobs.workspaceId, workspaceId),
          eq(scheduledJobs.isDeleted, false),
        ),
      )
      .orderBy(scheduledJobs.createdAt);

    const result = jobs.map((j) => {
      let humanReadable = '';
      try {
        humanReadable = rrulestr(j.rruleStr).toText();
      } catch {
        humanReadable = j.rruleStr;
      }
      return {
        id: j.id,
        name: j.name,
        description: j.description,
        humanReadable,
        timezone: j.timezone,
        prompt: j.prompt,
        enabled: j.enabled,
        nextRunAt: j.nextRunAt,
        lastRunAt: j.lastRunAt,
        createdAt: j.createdAt,
      };
    });

    return c.json(result);
  })

  // Toggle enabled / update a schedule
  .post(
    '/schedules/toggle',
    zValidator(
      'json',
      z.object({
        workspaceId: z.string(),
        scheduleId: z.string(),
        enabled: z.boolean(),
      }),
    ),
    async (c) => {
      const { workspaceId, scheduleId, enabled } = c.req.valid('json');

      const updates: Record<string, unknown> = { enabled };

      if (!enabled) {
        updates.nextRunAt = null;
      } else {
        // Re-enable: recompute nextRunAt from existing rrule
        const [existing] = await db
          .select({ rruleStr: scheduledJobs.rruleStr })
          .from(scheduledJobs)
          .where(and(eq(scheduledJobs.id, scheduleId), eq(scheduledJobs.workspaceId, workspaceId)));
        if (existing) {
          updates.nextRunAt =
            rrulestr(existing.rruleStr).after(new Date())?.toISOString() ?? null;
        }
      }

      const [job] = await db
        .update(scheduledJobs)
        .set(updates)
        .where(and(eq(scheduledJobs.id, scheduleId), eq(scheduledJobs.workspaceId, workspaceId)))
        .returning();

      if (!job) return c.json({ error: 'Schedule not found' }, 404);

      return c.json({ id: job.id, enabled: job.enabled, nextRunAt: job.nextRunAt });
    },
  )

  // Soft-delete a schedule
  .post(
    '/schedules/delete',
    zValidator(
      'json',
      z.object({
        workspaceId: z.string(),
        scheduleId: z.string(),
      }),
    ),
    async (c) => {
      const { workspaceId, scheduleId } = c.req.valid('json');

      await db
        .update(scheduledJobs)
        .set({ isDeleted: true, enabled: false })
        .where(
          and(eq(scheduledJobs.id, scheduleId), eq(scheduledJobs.workspaceId, workspaceId)),
        );

      return c.json({ ok: true });
    },
  );
