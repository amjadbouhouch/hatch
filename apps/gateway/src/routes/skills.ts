import { Hono } from 'hono';
import { z } from 'zod';
import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { zValidator } from '../middleware/zod-validator.js';
import { db, skills, eq, and } from '@hatch/database';
import { HATCH_HOME, DEFAULT_SKILLS_DIR } from '../services/agent-factory.js';

const SKILLS_SH_API = 'https://skills-api-production.up.railway.app';

// ─── External API types (skills.sh) ────────────────────────────────────────

type BrowseSkill = {
  source: string;
  skillId: string;
  name: string;
  installs: number;
  owner: string;
  repo: string;
  githubUrl: string;
  displayName: string;
};

type BrowsePage = {
  skills: BrowseSkill[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type SkillSource = {
  source: string;
  owner: string;
  repo: string;
  skillCount: number;
  totalInstalls: number;
};

type SkillSourcesPage = {
  sources: SkillSource[];
  total: number;
};

type SkillContentResponse = {
  source: string;
  skillId: string;
  path: string;
  metadata: { name: string; description: string };
  instructions: string;
  raw: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Install a single skill from skills.sh into a workspace (disk + DB). */
export async function installSkillToWorkspace(
  workspaceId: string,
  skillId: string,
  owner: string,
  repo: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const contentRes = await fetch(
      `${SKILLS_SH_API}/api/skills/${owner}/${repo}/${skillId}/content`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!contentRes.ok) return { ok: false, error: 'Failed to fetch skill content' };

    const content = (await contentRes.json()) as {
      raw: string;
      metadata: { name: string; description: string };
    };

    const skillDir = join(getSkillsDir(workspaceId), skillId);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), content.raw, 'utf-8');

    const existing = await db
      .select()
      .from(skills)
      .where(and(eq(skills.name, skillId), eq(skills.workspaceId, workspaceId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(skills).values({
        name: skillId,
        description: content.metadata?.description,
        content: `${owner}/${repo}`,
        workspaceId,
      });
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Install failed' };
  }
}

/** Install all bundled default skills into a workspace (disk + DB). */
export async function installDefaultSkills(workspaceId: string): Promise<void> {
  if (!existsSync(DEFAULT_SKILLS_DIR)) return;

  for (const entry of readdirSync(DEFAULT_SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const skillId = entry.name;
    const srcDir = join(DEFAULT_SKILLS_DIR, skillId);
    const srcSkillMd = join(srcDir, 'SKILL.md');
    if (!existsSync(srcSkillMd)) continue;

    // Copy entire skill directory (SKILL.md + scripts/ etc.)
    const destDir = join(getSkillsDir(workspaceId), skillId);
    mkdirSync(destDir, { recursive: true });
    cpSync(srcDir, destDir, { recursive: true, force: true });

    // Parse metadata for DB record
    const raw = readFileSync(srcSkillMd, 'utf-8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    let description = '';
    if (fmMatch) {
      const descMatch = fmMatch[1].match(/^description:\s*["']?(.+?)["']?$/m);
      if (descMatch) description = descMatch[1].trim();
    }

    // Upsert DB record
    const existing = await db
      .select()
      .from(skills)
      .where(and(eq(skills.name, skillId), eq(skills.workspaceId, workspaceId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(skills).values({
        name: skillId,
        description,
        content: 'bundled',
        workspaceId,
      });
    }
  }
}

export function getSkillsDir(workspaceId: string): string {
  return join(HATCH_HOME, 'workspaces', workspaceId, 'skills');
}

function listInstalledFromDisk(workspaceId: string) {
  const dir = getSkillsDir(workspaceId);
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const skillMd = join(dir, d.name, 'SKILL.md');
      if (!existsSync(skillMd)) return null;

      const raw = readFileSync(skillMd, 'utf-8');
      // Parse YAML frontmatter
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      let name = d.name;
      let description = '';
      if (fmMatch) {
        const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
        const descMatch = fmMatch[1].match(/^description:\s*["']?(.+?)["']?$/m);
        if (nameMatch) name = nameMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
      }

      return { name: d.name, displayName: name, description, path: d.name };
    })
    .filter(Boolean);
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export const skillRoutes = new Hono()

  // Browse all skills (paginated)
  .get('/skills/browse', async (c) => {
    const page = Number(c.req.query('page') ?? 1);
    const pageSize = Number(c.req.query('pageSize') ?? 25);
    const source = c.req.query('source') ?? '';

    const empty: BrowsePage = { skills: [], total: 0, page: 1, pageSize, totalPages: 0 };
    try {
      const url = new URL(`${SKILLS_SH_API}/api/skills`);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));
      if (source) url.searchParams.set('source', source);

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return c.json(empty);
      return c.json(await res.json() as BrowsePage);
    } catch {
      return c.json(empty);
    }
  })

  // Search skills
  .get('/skills/search', async (c) => {
    const q = c.req.query('q') ?? '';
    const page = Number(c.req.query('page') ?? 1);
    const pageSize = Number(c.req.query('pageSize') ?? 25);

    const empty: BrowsePage = { skills: [], total: 0, page: 1, pageSize, totalPages: 0 };
    if (!q.trim()) return c.json(empty);

    try {
      const url = new URL(`${SKILLS_SH_API}/api/skills`);
      url.searchParams.set('query', q);
      url.searchParams.set('page', String(page));
      url.searchParams.set('pageSize', String(pageSize));

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return c.json(empty);
      return c.json(await res.json() as BrowsePage);
    } catch {
      return c.json(empty);
    }
  })

  // Top sources (for filter dropdown)
  .get('/skills/sources', async (c) => {
    const empty: SkillSourcesPage = { sources: [], total: 0 };
    try {
      const res = await fetch(`${SKILLS_SH_API}/api/skills/sources/top?pageSize=50`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return c.json(empty);
      return c.json(await res.json() as SkillSourcesPage);
    } catch {
      return c.json(empty);
    }
  })

  // Skill content/preview
  .get('/skills/content/:owner/:repo/:skillId', async (c) => {
    try {
      const { owner, repo, skillId } = c.req.param();
      const res = await fetch(
        `${SKILLS_SH_API}/api/skills/${owner}/${repo}/${skillId}/content`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!res.ok) return c.json({ error: 'Not found' }, 404);
      return c.json(await res.json() as SkillContentResponse);
    } catch {
      return c.json({ error: 'Request timed out' }, 504);
    }
  })

  // Installed skill content (read SKILL.md from disk)
  .get('/skills/installed/:workspaceId/:skillId/content', async (c) => {
    const { workspaceId, skillId } = c.req.param();
    const skillMd = join(getSkillsDir(workspaceId), skillId, 'SKILL.md');

    if (!existsSync(skillMd)) {
      return c.json({ error: 'Not found' }, 404);
    }

    const raw = readFileSync(skillMd, 'utf-8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    let name = skillId;
    let description = '';
    let instructions = raw;

    if (fmMatch) {
      const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
      const descMatch = fmMatch[1].match(/^description:\s*["']?(.+?)["']?$/m);
      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
      instructions = raw.slice(fmMatch[0].length).trim();
    }

    return c.json({ skillId, metadata: { name, description }, instructions, raw });
  })

  // List installed skills for a workspace (filesystem-based)
  .get('/skills/installed/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const installed = listInstalledFromDisk(workspaceId);
    return c.json(installed);
  })

  // Install a skill to a workspace
  .post(
    '/skills/install',
    zValidator(
      'json',
      z.object({
        workspaceId: z.string().uuid(),
        skillId: z.string().min(1),
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
    ),
    async (c) => {
      const { workspaceId, skillId, owner, repo } = c.req.valid('json');
      const result = await installSkillToWorkspace(workspaceId, skillId, owner, repo);
      if (!result.ok) return c.json({ error: result.error }, 502);
      return c.json({ ok: true, name: skillId }, 201);
    },
  )

  // Uninstall a skill from a workspace
  .post(
    '/skills/uninstall',
    zValidator(
      'json',
      z.object({
        workspaceId: z.string().uuid(),
        skillId: z.string().min(1),
      }),
    ),
    async (c) => {
      const { workspaceId, skillId } = c.req.valid('json');

      // 1. Remove from disk
      const skillDir = join(getSkillsDir(workspaceId), skillId);
      rmSync(skillDir, { recursive: true, force: true });

      // 2. Remove from DB
      await db
        .delete(skills)
        .where(and(eq(skills.name, skillId), eq(skills.workspaceId, workspaceId)));

      return c.json({ ok: true });
    },
  );
