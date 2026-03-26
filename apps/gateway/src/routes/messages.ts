import { Hono } from 'hono';
import { zValidator } from '../middleware/zod-validator.js';
import { SendMessageBody, FollowUpBody } from '@hatch/shared';
import { harnessPool } from '../services/harness-pool.js';
import { storage } from '../services/agent-factory.js';

/** Resolve workspaceId for a thread — checks pool first, then thread metadata. */
async function resolveWorkspaceId(threadId: string, hint?: string): Promise<string | undefined> {
  const pooled = harnessPool.get(threadId);
  if (pooled) return pooled.workspaceId;
  if (hint) return hint;

  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });
  return (thread?.metadata as any)?.workspaceId ?? undefined;
}

export const messageRoutes = new Hono()
  .post('/send', zValidator('json', SendMessageBody), async (c) => {
    const { content, threadId, workspaceId } = c.req.valid('json');

    const resolvedThreadId = threadId ?? crypto.randomUUID();
    const resolvedWsId = await resolveWorkspaceId(resolvedThreadId, workspaceId);
    const entry = await harnessPool.getOrCreate(resolvedThreadId, resolvedWsId);

    harnessPool.send(entry.threadId, content);
    return c.json({ threadId: entry.threadId });
  })
  .post('/follow-up', zValidator('json', FollowUpBody), async (c) => {
    const { content, threadId } = c.req.valid('json');

    // Ensure harness exists — recover from pool eviction or gateway restart
    if (!harnessPool.get(threadId)) {
      const wsId = await resolveWorkspaceId(threadId);
      if (wsId) {
        await harnessPool.getOrCreate(threadId, wsId);
      } else {
        return c.json({ error: 'thread not found' as const }, 404);
      }
    }

    harnessPool.send(threadId, content);
    return c.json({ queued: harnessPool.get(threadId)?.harness.isRunning() ?? false });
  });
