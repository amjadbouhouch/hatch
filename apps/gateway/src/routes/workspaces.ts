import { Hono } from 'hono';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db, workspaces, modelConfigs, embeddingConfigs, eq, asc } from '@hatch/database';
import { zValidator } from '../middleware/zod-validator.js';
import { z } from 'zod';
import { HATCH_HOME } from '../services/agent-factory.js';
import { DEFAULT_MEMORY, DEFAULT_SKILLS, DEFAULT_MODEL_CONFIG, DEFAULT_EMBEDDING_CONFIG } from '../templates.js';
import { installSkillToWorkspace, installDefaultSkills } from './skills.js';

const CreateWorkspaceBody = z.object({
  name: z.string().min(1).max(100),
  template: z.enum(['blank', 'coder', 'marketing']).default('blank'),
});

const UpdateWorkspaceBody = z.object({
  name: z.string().min(1).max(100).optional(),
  agentName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const workspaceRoutes = new Hono()
  .get('/workspaces/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json(row);
  })

  .get('/workspaces', async (c) => {
    const rows = await db.select().from(workspaces).orderBy(asc(workspaces.createdAt));
    return c.json(
      rows.map((w) => ({
        id: w.id,
        name: w.name,
        agentName: w.agentName,
        description: w.description,
      }))
    );
  })
  .patch('/workspaces/:workspaceId', zValidator('json', UpdateWorkspaceBody), async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const data = c.req.valid('json');
    const [updated] = await db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(workspaces.id, workspaceId))
      .returning();
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json(updated);
  })

  .delete('/workspaces/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    if (!row) return c.json({ error: 'Not found' }, 404);
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    const wsDir = join(HATCH_HOME, 'workspaces', workspaceId);
    if (existsSync(wsDir)) rmSync(wsDir, { recursive: true, force: true });
    return c.json({ ok: true });
  })

  .post('/workspaces', zValidator('json', CreateWorkspaceBody), async (c) => {
    const { name, template } = c.req.valid('json');

    const agentName = template === 'coder' ? 'Coder'
      : template === 'marketing' ? 'Marketer'
      : 'Hatch';

    const description = template === 'coder' ? 'Code generation, review, and debugging'
      : template === 'marketing' ? 'Content generation, competitor monitoring, scheduling'
      : undefined;

    const [ws] = await db
      .insert(workspaces)
      .values({ name, agentName, description })
      .returning();

    // Seed default configs
    await db.insert(modelConfigs).values({ workspaceId: ws.id, ...DEFAULT_MODEL_CONFIG });
    await db.insert(embeddingConfigs).values({ workspaceId: ws.id, ...DEFAULT_EMBEDDING_CONFIG });

    // Write SOUL.md + IDENTITY.md to workspace directory
    const { DEFAULT_SOUL, DEFAULT_IDENTITY } = await import('../templates.js');
    const wsDir = join(HATCH_HOME, 'workspaces', ws.id);
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(join(wsDir, 'SOUL.md'), DEFAULT_SOUL);
    writeFileSync(join(wsDir, 'IDENTITY.md'), DEFAULT_IDENTITY);

    // Scaffold knowledge/ and memory/ directories
    mkdirSync(join(wsDir, 'knowledge'), { recursive: true });
    mkdirSync(join(wsDir, 'memory', 'daily'), { recursive: true });
    writeFileSync(join(wsDir, 'memory', 'MEMORY.md'), DEFAULT_MEMORY);

    // Install default skills (fire-and-forget — don't block workspace creation)
    Promise.allSettled([
      ...DEFAULT_SKILLS.map((s) => installSkillToWorkspace(ws.id, s.skillId, s.owner, s.repo)),
      installDefaultSkills(ws.id),
    ]).catch(() => {});

    return c.json({ id: ws.id, name: ws.name, agentName: ws.agentName, description: ws.description }, 201);
  });
