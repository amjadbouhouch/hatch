import { Hono } from 'hono';
import { z } from 'zod/v4';
import {
  mkdirSync,
  rmSync,
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { join, relative, extname, basename, dirname } from 'node:path';
import { zValidator } from '../middleware/zod-validator.js';
import { HATCH_HOME } from '../services/agent-factory.js';
import { indexFile, removeFileIndex } from '../services/knowledge-indexer.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.json', '.csv', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function getWorkspaceDir(workspaceId: string): string {
  return join(HATCH_HOME, 'workspaces', workspaceId);
}

function getKnowledgeDir(workspaceId: string): string {
  return join(HATCH_HOME, 'workspaces', workspaceId, 'knowledge');
}

/** Resolve and validate a path stays inside the given root dir */
function safePath(rootDir: string, relPath: string): string | null {
  const resolved = join(rootDir, relPath);
  if (!resolved.startsWith(rootDir)) return null;
  return resolved;
}

interface TreeItem {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: string[];
}

/** Build a flat tree record from a directory */
function buildTree(rootDir: string, rootId: string, rootName: string): { items: Record<string, TreeItem>; rootId: string } {
  const items: Record<string, TreeItem> = {};

  function walk(dirPath: string, parentId: string) {
    if (!existsSync(dirPath)) return;

    const entries = readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    const childIds: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relPath = relative(rootDir, fullPath);
      const id = relPath.replace(/\\/g, '/'); // normalize for Windows

      if (entry.isDirectory()) {
        items[id] = { name: entry.name, type: 'directory', children: [] };
        childIds.push(id);
        walk(fullPath, id);
      } else {
        const stat = statSync(fullPath);
        items[id] = { name: entry.name, type: 'file', size: stat.size };
        childIds.push(id);
      }
    }

    // Update parent's children
    if (items[parentId]) {
      items[parentId].children = childIds;
    }
  }

  items[rootId] = { name: rootName, type: 'directory', children: [] };
  walk(rootDir, rootId);

  return { items, rootId };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export const knowledgeRoutes = new Hono()

  // Get folder/file tree (full workspace)
  .get('/knowledge/:workspaceId/tree', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const wsDir = getWorkspaceDir(workspaceId);
    mkdirSync(wsDir, { recursive: true });
    const tree = buildTree(wsDir, 'workspace', 'workspace');
    return c.json(tree);
  })

  // Read file content for preview
  .get('/knowledge/:workspaceId/file/:path{.+}', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const filePath = c.req.param('path');
    const wsDir = getWorkspaceDir(workspaceId);

    const resolved = safePath(wsDir, filePath);
    if (!resolved) {
      return c.json({ error: 'Invalid path' }, 400);
    }

    if (!existsSync(resolved)) {
      return c.json({ error: 'Not found' }, 404);
    }

    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      return c.json({ error: 'Cannot preview a directory' }, 400);
    }

    // Only read text-based files
    const ext = extname(resolved).toLowerCase();
    const textExtensions = new Set(['.md', '.txt', '.json', '.csv']);
    if (!textExtensions.has(ext)) {
      return c.json({
        name: filePath.split('/').pop() ?? filePath,
        path: filePath,
        size: stat.size,
        content: null,
        message: 'Binary file — preview not available',
      });
    }

    const content = readFileSync(resolved, 'utf-8');
    return c.json({
      name: filePath.split('/').pop() ?? filePath,
      path: filePath,
      size: stat.size,
      content,
    });
  })

  // Download raw file
  .get('/knowledge/:workspaceId/download/:path{.+}', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const filePath = c.req.param('path');
    const wsDir = getWorkspaceDir(workspaceId);

    const resolved = safePath(wsDir, filePath);
    if (!resolved) return c.json({ error: 'Invalid path' }, 400);
    if (!existsSync(resolved)) return c.json({ error: 'Not found' }, 404);
    if (statSync(resolved).isDirectory()) return c.json({ error: 'Cannot download a directory' }, 400);

    const fileName = basename(resolved);
    const buffer = readFileSync(resolved);
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    c.header('Content-Type', 'application/octet-stream');
    return c.body(buffer);
  })

  // Upload file(s) — accepts JSON with base64 content
  .post(
    '/knowledge/:workspaceId/upload',
    zValidator(
      'json',
      z.object({
        files: z.array(
          z.object({
            name: z.string().min(1),
            content: z.string().min(1), // base64-encoded
            path: z.string().default(''), // subfolder path
          }),
        ).min(1),
      }),
    ),
    async (c) => {
      const workspaceId = c.req.param('workspaceId');
      const { files } = c.req.valid('json');
      const knowledgeDir = getKnowledgeDir(workspaceId);

      const results: Array<{ name: string; path: string; size: number; ok: boolean; error?: string }> = [];

      for (const file of files) {
        const ext = extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          results.push({ name: file.name, path: file.path, size: 0, ok: false, error: `Unsupported file type: ${ext}` });
          continue;
        }

        const buffer = Buffer.from(file.content, 'base64');
        if (buffer.length > MAX_FILE_SIZE) {
          results.push({ name: file.name, path: file.path, size: buffer.length, ok: false, error: 'File exceeds 10 MB limit' });
          continue;
        }

        const targetDir = file.path
          ? safePath(knowledgeDir, file.path)
          : knowledgeDir;

        if (!targetDir) {
          results.push({ name: file.name, path: file.path, size: 0, ok: false, error: 'Invalid path' });
          continue;
        }

        mkdirSync(targetDir, { recursive: true });
        const filePath = join(targetDir, basename(file.name));

        // Final safety check
        if (!filePath.startsWith(knowledgeDir)) {
          results.push({ name: file.name, path: file.path, size: 0, ok: false, error: 'Invalid path' });
          continue;
        }

        writeFileSync(filePath, buffer);
        const relFromWorkspace = `knowledge/${file.path ? file.path + '/' : ''}${basename(file.name)}`.replace(/\/+/g, '/');
        results.push({
          name: file.name,
          path: relative(knowledgeDir, filePath).replace(/\\/g, '/'),
          size: buffer.length,
          ok: true,
        });
        // Index async — don't block the response
        indexFile(workspaceId, relFromWorkspace).catch((err) =>
          console.error(`[knowledge] index error for "${relFromWorkspace}":`, err),
        );
      }

      return c.json({ results }, 201);
    },
  )

  // Create folder
  .post(
    '/knowledge/:workspaceId/mkdir',
    zValidator(
      'json',
      z.object({
        path: z.string().min(1),
      }),
    ),
    async (c) => {
      const workspaceId = c.req.param('workspaceId');
      const { path } = c.req.valid('json');
      const knowledgeDir = getKnowledgeDir(workspaceId);

      const targetDir = safePath(knowledgeDir, path);
      if (!targetDir) {
        return c.json({ error: 'Invalid path' }, 400);
      }

      mkdirSync(targetDir, { recursive: true });
      return c.json({ ok: true, path });
    },
  )

  // Move / rename file or folder
  .post(
    '/knowledge/:workspaceId/move',
    zValidator(
      'json',
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
      }),
    ),
    async (c) => {
      const workspaceId = c.req.param('workspaceId');
      const { from, to } = c.req.valid('json');
      const knowledgeDir = getKnowledgeDir(workspaceId);

      const fromPath = safePath(knowledgeDir, from);
      const toPath = safePath(knowledgeDir, to);

      if (!fromPath || !toPath) {
        return c.json({ error: 'Invalid path' }, 400);
      }

      if (!existsSync(fromPath)) {
        return c.json({ error: 'Source not found' }, 404);
      }

      // Ensure target parent directory exists
      mkdirSync(dirname(toPath), { recursive: true });
      renameSync(fromPath, toPath);

      const wsDir = join(HATCH_HOME, 'workspaces', workspaceId);
      const oldRel = relative(wsDir, fromPath).replace(/\\/g, '/');
      const newRel = relative(wsDir, toPath).replace(/\\/g, '/');
      removeFileIndex(workspaceId, oldRel).catch((err) =>
        console.error(`[knowledge] remove index error for "${oldRel}":`, err),
      );
      indexFile(workspaceId, newRel).catch((err) =>
        console.error(`[knowledge] index error for "${newRel}":`, err),
      );

      return c.json({ ok: true, from, to });
    },
  )

  // Delete file or folder
  .post(
    '/knowledge/:workspaceId/delete',
    zValidator(
      'json',
      z.object({
        path: z.string().min(1),
      }),
    ),
    async (c) => {
      const workspaceId = c.req.param('workspaceId');
      const { path } = c.req.valid('json');
      const wsDir = getWorkspaceDir(workspaceId);

      // Only allow deleting inside knowledge/ or projects/
      const normalizedPath = path.replace(/\\/g, '/');
      if (!normalizedPath.startsWith('knowledge/') && !normalizedPath.startsWith('projects/')) {
        return c.json({ error: 'Cannot delete files outside knowledge/ and projects/' }, 403);
      }

      const targetPath = safePath(wsDir, path);
      if (!targetPath) {
        return c.json({ error: 'Invalid path' }, 400);
      }

      if (!existsSync(targetPath)) {
        return c.json({ error: 'Not found' }, 404);
      }

      // Collect files to un-index before removing from disk
      const filesToRemove: string[] = [];
      if (statSync(targetPath).isDirectory()) {
        // Walk directory to find all files
        const walkForDelete = (dir: string) => {
          for (const e of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, e.name);
            if (e.isDirectory()) walkForDelete(full);
            else filesToRemove.push(relative(wsDir, full).replace(/\\/g, '/'));
          }
        };
        walkForDelete(targetPath);
      } else {
        filesToRemove.push(relative(wsDir, targetPath).replace(/\\/g, '/'));
      }

      rmSync(targetPath, { recursive: true, force: true });

      // Remove indexes async
      for (const f of filesToRemove) {
        removeFileIndex(workspaceId, f).catch((err) =>
          console.error(`[knowledge] remove index error for "${f}":`, err),
        );
      }
      return c.json({ ok: true });
    },
  )

;
