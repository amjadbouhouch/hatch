import { Hono } from 'hono';
import { HATCH_VERSION } from '@hatch/shared';

export const healthRoutes = new Hono()
  .get('/health', (c) =>
    c.json({ status: 'ok' as const, version: HATCH_VERSION }),
  );
