import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { DockerSandbox } from './docker-sandbox.js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOST_DIR = '/tmp/hatch-sandbox-test';
const EXTRA_MOUNT_DIR = '/tmp/hatch-sandbox-extra';

// Prepare host directories with test files
mkdirSync(HOST_DIR, { recursive: true });
mkdirSync(EXTRA_MOUNT_DIR, { recursive: true });
writeFileSync(join(HOST_DIR, 'hello.txt'), 'written on host\n');
writeFileSync(join(EXTRA_MOUNT_DIR, 'data.csv'), 'name,age\nalice,30\nbob,25\n');

const sandbox = new DockerSandbox({
  image: 'hatch-sandbox',
  workingDirectory: HOST_DIR,
});

// Primary filesystem via `filesystem`, extra mount via `mounts` on the Workspace's onMount
const workspace = new Workspace({
  id: 'test-ws',
  name: 'Test Workspace',
  filesystem: new LocalFilesystem({ basePath: HOST_DIR }),
  sandbox,
});

async function run() {
  // ─── Init workspace ───────────────────────────────────────────────────────
  console.log('--- Init workspace ---');
  const t0 = performance.now();
  await workspace.init();
  console.log(`Workspace init: ${(performance.now() - t0).toFixed(0)}ms`);

  // ─── Mount extra directory manually ───────────────────────────────────────
  console.log('\n--- Mounting /data ---');
  const mountResult = await sandbox.mount(
    new LocalFilesystem({ basePath: EXTRA_MOUNT_DIR }),
    '/data',
  );
  console.log('Mount result:', mountResult);

  // ─── Verify primary filesystem (bind mount from workingDirectory) ─────────
  console.log('\n--- Read host file from container ---');
  const cat = await sandbox.executeCommand('cat', ['/workspace/hello.txt']);
  console.log('stdout:', JSON.stringify(cat.stdout));
  console.log('success:', cat.success);

  // ─── Verify extra mount is visible in container ───────────────────────────
  console.log('\n--- Read extra mount from container ---');
  const data = await sandbox.executeCommand('cat', ['/data/data.csv']);
  console.log('stdout:', JSON.stringify(data.stdout));
  console.log('success:', data.success);

  // ─── Write from container → read on host ──────────────────────────────────
  console.log('\n--- Write in container, read on host ---');
  await sandbox.executeCommand('sh', [
    '-c',
    '"echo created-in-docker > /workspace/from-container.txt"',
  ]);
  const hostContent = readFileSync(join(HOST_DIR, 'from-container.txt'), 'utf-8');
  console.log('host read:', JSON.stringify(hostContent));

  // ─── Write to extra mount from container → read on host ───────────────────
  console.log('\n--- Write to extra mount in container, read on host ---');
  await sandbox.executeCommand('sh', [
    '-c',
    '"echo extra-mount-write > /data/output.txt"',
  ]);
  const extraContent = readFileSync(join(EXTRA_MOUNT_DIR, 'output.txt'), 'utf-8');
  console.log('host read:', JSON.stringify(extraContent));

  // ─── Python reads the mounted CSV ─────────────────────────────────────────
  console.log('\n--- Python reads mounted CSV ---');
  const py = await sandbox.executeCommand('python3', [
    '-c',
    '"import pandas as pd; df = pd.read_csv(\'/data/data.csv\'); print(df.to_string())"',
  ]);
  console.log(py.stdout);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  console.log('--- Destroying workspace ---');
  await workspace.destroy();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  workspace.destroy().catch(() => {});
  process.exit(1);
});
