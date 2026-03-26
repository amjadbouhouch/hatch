import { serve } from '@hono/node-server';
import { HATCH_VERSION } from '@hatch/shared';
import { app, auth } from './app.js';
import { printAuthInfo } from './auth/resolve.js';
import { harnessPool } from './services/harness-pool.js';
import { startIndexCron } from './services/knowledge-indexer.js';
import { seed } from './seed.js';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  await seed();
  harnessPool.startSweeper();
  startIndexCron();

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`@hatch/gateway v${HATCH_VERSION} — http://localhost:${PORT}`);
    printAuthInfo(auth, PORT);
  });
}

start().catch((err) => {
  console.error('[gateway] failed to start:', err);
  process.exit(1);
});
