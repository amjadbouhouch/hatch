import { LocalFilesystem } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { createSandbox, destroySandbox, getSandbox, touchSandbox } from './sandbox-store.js';

export const app = new Hono();

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', service: 'sandbox-service' }));

// ─── Create & start a sandbox ────────────────────────────────────────────────

app.post('/sandboxes', async (c) => {
  try {
    const body = await c.req.json();
    const sandbox = await createSandbox(body);
    const info = await sandbox.getInfo();
    return c.json(info, 201);
  } catch (err: any) {
    const status = err.code === 'DOCKER_UNAVAILABLE' ? 503 : 500;
    return c.json({ error: err.message, code: err.code ?? 'UNKNOWN' }, status);
  }
});

// ─── Get sandbox info ────────────────────────────────────────────────────────

app.get('/sandboxes/:id', async (c) => {
  const sandbox = getSandbox(c.req.param('id'));
  if (!sandbox) return c.json({ error: 'Sandbox not found' }, 404);

  try {
    const info = await sandbox.getInfo();
    return c.json(info);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Execute command ─────────────────────────────────────────────────────────

app.post('/sandboxes/:id/exec', async (c) => {
  const sandbox = getSandbox(c.req.param('id'));
  if (!sandbox) return c.json({ error: 'Sandbox not found' }, 404);

  try {
    touchSandbox(c.req.param('id'));
    const { command, args, options } = await c.req.json();
    const result = await sandbox.executeCommand(command, args, {
      timeout: options?.timeout,
      env: options?.env,
      cwd: options?.cwd,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message, code: err.code ?? 'UNKNOWN' }, 500);
  }
});

// ─── Mount filesystem ────────────────────────────────────────────────────────

app.post('/sandboxes/:id/mount', async (c) => {
  const sandbox = getSandbox(c.req.param('id'));
  if (!sandbox) return c.json({ error: 'Sandbox not found' }, 404);

  try {
    touchSandbox(c.req.param('id'));
    const { hostPath, mountPath } = await c.req.json();
    const fs = new LocalFilesystem({ basePath: hostPath, contained: true });
    const result = await sandbox.mount(fs, mountPath);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Destroy sandbox ─────────────────────────────────────────────────────────

app.delete('/sandboxes/:id', async (c) => {
  try {
    const destroyed = await destroySandbox(c.req.param('id'));
    if (!destroyed) return c.json({ error: 'Sandbox not found' }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
