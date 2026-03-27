import { Hono } from 'hono';
import { z } from 'zod/v4';
import { zValidator } from '../middleware/zod-validator.js';
import { db, modelConfigs, visionConfigs, embeddingConfigs, eq } from '@hatch/database';

// ─── Validators ─────────────────────────────────────────────────────────────

const ModelConfigBody = z.object({
  workspaceId: z.string(),
  model: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  temperature: z.number().nullable().optional(),
  topP: z.number().nullable().optional(),
  topK: z.number().int().nullable().optional(),
  maxTokens: z.number().int().nullable().optional(),
  maxRetries: z.number().int().nullable().optional(),
  seed: z.number().int().nullable().optional(),
  frequencyPenalty: z.number().nullable().optional(),
  presencePenalty: z.number().nullable().optional(),
  providerOptions: z.record(z.string(), z.unknown()).nullable().optional(),
});

const VisionConfigBody = z.object({
  workspaceId: z.string(),
  model: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  maxTokens: z.number().int().nullable().optional(),
  providerOptions: z.record(z.string(), z.unknown()).nullable().optional(),
});

const EmbeddingConfigBody = z.object({
  workspaceId: z.string(),
  model: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  dimension: z.number().int().nullable().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

export const configRoutes = new Hono()

  // ── Model Config ────────────────────────────────────────────────────────

  .get('/configs/model/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const [row] = await db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.workspaceId, workspaceId));
    return c.json(row ?? null);
  })

  .put('/configs/model', zValidator('json', ModelConfigBody), async (c) => {
    const { workspaceId, ...data } = c.req.valid('json');
    const [existing] = await db
      .select({ id: modelConfigs.id })
      .from(modelConfigs)
      .where(eq(modelConfigs.workspaceId, workspaceId));

    if (existing) {
      const [row] = await db
        .update(modelConfigs)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(modelConfigs.workspaceId, workspaceId))
        .returning();
      return c.json(row);
    }

    const [row] = await db
      .insert(modelConfigs)
      .values({ workspaceId, ...data })
      .returning();
    return c.json(row, 201);
  })

  // ── Vision Config ───────────────────────────────────────────────────────

  .get('/configs/vision/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const [row] = await db
      .select()
      .from(visionConfigs)
      .where(eq(visionConfigs.workspaceId, workspaceId));
    return c.json(row ?? null);
  })

  .put('/configs/vision', zValidator('json', VisionConfigBody), async (c) => {
    const { workspaceId, ...data } = c.req.valid('json');
    const [existing] = await db
      .select({ id: visionConfigs.id })
      .from(visionConfigs)
      .where(eq(visionConfigs.workspaceId, workspaceId));

    if (existing) {
      const [row] = await db
        .update(visionConfigs)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(visionConfigs.workspaceId, workspaceId))
        .returning();
      return c.json(row);
    }

    const [row] = await db
      .insert(visionConfigs)
      .values({ workspaceId, ...data })
      .returning();
    return c.json(row, 201);
  })

  // ── Embedding Config ────────────────────────────────────────────────────

  .get('/configs/embedding/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const [row] = await db
      .select()
      .from(embeddingConfigs)
      .where(eq(embeddingConfigs.workspaceId, workspaceId));
    return c.json(row ?? null);
  })

  .put('/configs/embedding', zValidator('json', EmbeddingConfigBody), async (c) => {
    const { workspaceId, ...data } = c.req.valid('json');
    const [existing] = await db
      .select({ id: embeddingConfigs.id })
      .from(embeddingConfigs)
      .where(eq(embeddingConfigs.workspaceId, workspaceId));

    if (existing) {
      const [row] = await db
        .update(embeddingConfigs)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(embeddingConfigs.workspaceId, workspaceId))
        .returning();
      return c.json(row);
    }

    const [row] = await db
      .insert(embeddingConfigs)
      .values({ workspaceId, ...data })
      .returning();
    return c.json(row, 201);
  });
