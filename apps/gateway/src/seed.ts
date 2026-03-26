import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, workspaces, migrate } from '@hatch/database';
import { DEFAULT_SOUL, DEFAULT_IDENTITY, DEFAULT_MEMORY, DEFAULT_SKILLS } from './templates.js';
import { HATCH_HOME, DEFAULT_WORKSPACE_ID } from './services/agent-factory.js';
import { installSkillToWorkspace } from './routes/skills.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run migrations + seed the default workspace on first run.
 * Idempotent — safe to call on every startup.
 */
export async function seed(): Promise<void> {
  // 1. Run migrations
  // In dev (tsx): __dirname = apps/gateway/src → ../../packages/database/drizzle
  // In prod (dist): __dirname = apps/gateway/dist → ../../packages/database/drizzle
  // Both resolve via the node_modules symlink to packages/database
  const migrationsFolder = join(__dirname, '..', 'node_modules', '@hatch', 'database', 'drizzle');
  migrate(db, { migrationsFolder });

  // 2. Upsert default workspace in DB
  const [created] = await db
    .insert(workspaces)
    .values({ id: DEFAULT_WORKSPACE_ID, name: 'Default' })
    .onConflictDoNothing()
    .returning();

  if (created) {
    console.log(`[seed] workspace created: ${created.name} (${created.id})`);
  }

  // 3. Write SOUL.md + IDENTITY.md if they don't exist yet
  const wsDir = join(HATCH_HOME, 'workspaces', DEFAULT_WORKSPACE_ID);
  mkdirSync(wsDir, { recursive: true });

  const soulPath = join(wsDir, 'SOUL.md');
  const identityPath = join(wsDir, 'IDENTITY.md');

  if (!existsSync(soulPath)) {
    writeFileSync(soulPath, DEFAULT_SOUL);
    console.log(`[seed] wrote ${soulPath}`);
  }

  if (!existsSync(identityPath)) {
    writeFileSync(identityPath, DEFAULT_IDENTITY);
    console.log(`[seed] wrote ${identityPath}`);
  }

  // 4. Scaffold knowledge/ and memory/ directories
  const knowledgeDir = join(wsDir, 'knowledge');
  const memoryDir = join(wsDir, 'memory');
  const dailyDir = join(memoryDir, 'daily');
  mkdirSync(knowledgeDir, { recursive: true });
  mkdirSync(dailyDir, { recursive: true });

  const memoryPath = join(memoryDir, 'MEMORY.md');
  if (!existsSync(memoryPath)) {
    writeFileSync(memoryPath, DEFAULT_MEMORY);
    console.log(`[seed] wrote ${memoryPath}`);
  }

  // 5. Install default skills (only on first workspace creation)
  if (created) {
    for (const s of DEFAULT_SKILLS) {
      const result = await installSkillToWorkspace(DEFAULT_WORKSPACE_ID, s.skillId, s.owner, s.repo);
      if (result.ok) {
        console.log(`[seed] installed skill: ${s.skillId}`);
      } else {
        console.warn(`[seed] failed to install skill: ${s.skillId} — ${result.error}`);
      }
    }
  }
}
