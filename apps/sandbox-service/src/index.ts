import { serve } from '@hono/node-server';
import { app } from './routes.js';
import { destroyAll, startReaper } from './sandbox-store.js';

const PORT = Number(process.env.SANDBOX_SERVICE_PORT) || 3100;

// Graceful shutdown — destroy all active sandboxes to prevent orphaned containers
const shutdown = async () => {
  console.log('[sandbox-service] shutting down, destroying active sandboxes…');
  await destroyAll();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`@hatch/sandbox-service — http://localhost:${PORT}`);
  startReaper();
});
