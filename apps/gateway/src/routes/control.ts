import { Hono } from 'hono';
import { zValidator } from '../middleware/zod-validator.js';
import { AbortBody, ToolApprovalBody, AnswerBody, PlanApprovalBody, SwitchModeBody } from '@hatch/shared';
import { harnessPool } from '../services/harness-pool.js';
import { storage } from '../services/agent-factory.js';

export const controlRoutes = new Hono()
  .post('/abort', zValidator('json', AbortBody), async (c) => {
    const { threadId } = c.req.valid('json');
    const aborted = harnessPool.abort(threadId);
    return c.json({ aborted });
  })
  .get('/status/:threadId', async (c) => {
    const threadId = c.req.param('threadId');
    // Ensure harness is alive — create from DB if not in pool
    if (!harnessPool.get(threadId)) {
      const memory = await storage.getStore('memory');
      const thread = await memory?.getThreadById({ threadId });
      if (thread) {
        const workspaceId = (thread.metadata as any)?.workspaceId;
        if (workspaceId) {
          await harnessPool.getOrCreate(threadId, workspaceId);
        }
      }
    }
    return c.json(harnessPool.getStatus(threadId));
  })
  .post('/tool-approval', zValidator('json', ToolApprovalBody), async (c) => {
    const { threadId, decision } = c.req.valid('json');
    const ok = harnessPool.approveTool(threadId, decision);
    return c.json({ ok });
  })
  .post('/answer', zValidator('json', AnswerBody), async (c) => {
    const { threadId, questionId, answer } = c.req.valid('json');
    const ok = harnessPool.answerQuestion(threadId, questionId, answer);
    return c.json({ ok });
  })
  .post('/plan-approval', zValidator('json', PlanApprovalBody), async (c) => {
    const { threadId, planId, response, feedback } = c.req.valid('json');
    const ok = await harnessPool.approvePlan(threadId, planId, response, feedback);
    return c.json({ ok });
  })
  .post('/switch-mode', zValidator('json', SwitchModeBody), async (c) => {
    const { threadId, modeId } = c.req.valid('json');
    const ok = await harnessPool.switchMode(threadId, modeId);
    return c.json({ ok });
  });
