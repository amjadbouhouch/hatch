import { Hono } from 'hono';
import { zValidator } from '../middleware/zod-validator.js';
import { CreateThreadBody, InitThreadBody } from '@hatch/shared';
import { harnessPool } from '../services/harness-pool.js';
import { storage } from '../services/agent-factory.js';

export const threadRoutes = new Hono()
  .post('/threads', zValidator('json', CreateThreadBody), async (c) => {
    const { workspaceId, title } = c.req.valid('json');
    const { threadId } = await harnessPool.createThread(workspaceId, title);
    return c.json({ threadId });
  })
  .get('/threads', async (c) => {
    const workspaceId = c.req.query('workspaceId');
    const memory = await storage.getStore('memory');
    if (!memory) return c.json([]);

    const { threads } = await memory.listThreads({
      filter: workspaceId ? { resourceId: workspaceId } : undefined,
      orderBy: { field: 'updatedAt', direction: 'DESC' },
      perPage: 100,
      page: 0,
    });

    return c.json(threads.map((t) => ({
      threadId: t.id,
      title: t.title || 'New Thread',
      workspaceId: (t.metadata as any)?.workspaceId || t.resourceId,
      running: harnessPool.isRunning(t.id),
      lastActivityAt: t.updatedAt.getTime(),
    })));
  })
  .post('/threads/:threadId/init', zValidator('json', InitThreadBody), async (c) => {
    const threadId = c.req.param('threadId');
    const { workspaceId } = c.req.valid('json');
    await harnessPool.getOrCreate(threadId, workspaceId);
    return c.json({ ok: true });
  })
  .get('/threads/:threadId/messages', async (c) => {
    const threadId = c.req.param('threadId');

    // Ensure harness is alive — get workspaceId from DB
    if (!harnessPool.get(threadId)) {
      const memory = await storage.getStore('memory');
      const thread = await memory?.getThreadById({ threadId });
      if (!thread) return c.json({ error: 'Thread not found' }, 404);
      const workspaceId = (thread.metadata as any)?.workspaceId;
      if (!workspaceId) return c.json({ error: 'Thread missing workspaceId metadata' }, 422);
      await harnessPool.getOrCreate(threadId, workspaceId);
    }

    const data = await harnessPool.getMessages(threadId);
    return c.json(data);
  });
