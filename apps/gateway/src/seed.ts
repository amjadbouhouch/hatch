import { mkdirSync, writeFileSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, workspaces, workspaceModes, modelConfigs, embeddingConfigs, eq, migrate } from '@hatch/database';
import { DEFAULT_MEMORY, DEFAULT_SKILLS, DEFAULT_MODEL_CONFIG, DEFAULT_EMBEDDING_CONFIG, getTemplate } from './templates.js';
import { HATCH_HOME, DEFAULT_SKILLS_DIR, DEFAULT_WORKSPACE_ID } from './services/agent-factory.js';
import { installSkillToWorkspace, installDefaultSkills } from './routes/skills.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_SKILLS_DIR = join(__dirname, '../default-skills');

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

  // 2. Sync bundled default skills → HATCH_HOME/default-skills/
  if (existsSync(BUNDLED_SKILLS_DIR)) {
    mkdirSync(DEFAULT_SKILLS_DIR, { recursive: true });
    for (const entry of readdirSync(BUNDLED_SKILLS_DIR, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const src = join(BUNDLED_SKILLS_DIR, entry.name);
        const dest = join(DEFAULT_SKILLS_DIR, entry.name);
        cpSync(src, dest, { recursive: true, force: true });
      }
    }
    console.log('[seed] synced default skills to', DEFAULT_SKILLS_DIR);
  }

  // 3. Upsert default workspace in DB
  const [created] = await db
    .insert(workspaces)
    .values({ id: DEFAULT_WORKSPACE_ID, name: 'Default' })
    .onConflictDoNothing()
    .returning();

  if (created) {
    console.log(`[seed] workspace created: ${created.name} (${created.id})`);
  }

  // 4. Seed default configs
  if (created) {
    await db
      .insert(modelConfigs)
      .values({ workspaceId: DEFAULT_WORKSPACE_ID, ...DEFAULT_MODEL_CONFIG })
      .onConflictDoNothing();
    await db
      .insert(embeddingConfigs)
      .values({ workspaceId: DEFAULT_WORKSPACE_ID, ...DEFAULT_EMBEDDING_CONFIG })
      .onConflictDoNothing();
    console.log('[seed] default configs created');
  }

  // 5. Write SOUL.md + IDENTITY.md if they don't exist yet
  const defaultTpl = getTemplate('blank');
  const wsDir = join(HATCH_HOME, 'workspaces', DEFAULT_WORKSPACE_ID);
  mkdirSync(wsDir, { recursive: true });

  const soulPath = join(wsDir, 'SOUL.md');
  const identityPath = join(wsDir, 'IDENTITY.md');

  if (!existsSync(soulPath)) {
    writeFileSync(soulPath, defaultTpl.soul);
    console.log(`[seed] wrote ${soulPath}`);
  }

  if (!existsSync(identityPath)) {
    writeFileSync(identityPath, defaultTpl.identity);
    console.log(`[seed] wrote ${identityPath}`);
  }

  // 6. Scaffold knowledge/ and memory/ directories
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

  // 7. Install external skills (only on first workspace creation)
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

  // 8. Sync bundled default skills (every startup — keeps them up to date)
  await installDefaultSkills(DEFAULT_WORKSPACE_ID);
  console.log('[seed] synced bundled default skills');

  // 9. Seed default workspace modes (if none exist)
  const existingModes = await db.select().from(workspaceModes).where(
    eq(workspaceModes.workspaceId, DEFAULT_WORKSPACE_ID),
  );
  if (existingModes.length === 0) {
    for (const mode of defaultTpl.modes) {
      await db.insert(workspaceModes).values({
        workspaceId: DEFAULT_WORKSPACE_ID,
        modeId: mode.modeId,
        name: mode.name,
        isDefault: mode.isDefault,
        color: mode.color,
        prompt: mode.prompt,
        sortOrder: mode.sortOrder,
      });
    }
    console.log('[seed] seeded default workspace modes');
  }
}
