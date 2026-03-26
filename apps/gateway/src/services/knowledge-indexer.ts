import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import { join, relative, extname } from 'node:path';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { embedMany } from 'ai';
import { HATCH_HOME, vectorStore } from './agent-factory.js';
import { db, workspaces } from '@hatch/database';

// ─── Config ──────────────────────────────────────────────────────────────────

const TAG = '[indexer]';
const MANIFEST_FILE = '_meta.json';
const SKIP_FILES = new Set([MANIFEST_FILE, '.DS_Store']);
const INDEXABLE_DIRS = ['skills', 'knowledge', 'memory'];
const INDEXABLE_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv', '.html', '.htm', '.tex', '.xml', '.yaml', '.yml', '.toml']);
const CHUNK_THRESHOLD = 1500;
const CHUNK_MAX_SIZE = 512;
const CHUNK_OVERLAP = 50;
const CRON_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

type IndexManifest = Record<string, string>; // relativePath → MD5

export type ReindexResult = {
  indexed: number;
  skipped: number;
  removed: number;
  errors: number;
};

// ─── Embedder ────────────────────────────────────────────────────────────────

const embeddingModel = new ModelRouterEmbeddingModel({
  modelId: 'openai/text-embedding-3-small',
  providerId: 'openrouter',
});

async function embedTextBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
  const start = Date.now();
  const { embeddings } = await embedMany({ model: embeddingModel, values: texts });
  console.log(`${TAG} embedMany ${texts.length} texts (${totalChars} chars) → dim=${embeddings[0]?.length} in ${Date.now() - start}ms`);
  return embeddings;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIndexName(workspaceId: string): string {
  return `ws_${workspaceId.replace(/-/g, '')}`;
}

function getWorkspaceDir(workspaceId: string): string {
  return join(HATCH_HOME, 'workspaces', workspaceId);
}

function contentHash(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

function loadManifest(workspaceDir: string): IndexManifest {
  const p = join(workspaceDir, MANIFEST_FILE);
  try {
    const manifest = JSON.parse(readFileSync(p, 'utf-8'));
    console.log(`${TAG} manifest loaded — ${Object.keys(manifest).length} entries from ${p}`);
    return manifest;
  } catch {
    console.log(`${TAG} manifest not found or invalid at ${p} — starting fresh`);
    return {};
  }
}

function saveManifest(workspaceDir: string, manifest: IndexManifest): void {
  const p = join(workspaceDir, MANIFEST_FILE);
  writeFileSync(p, JSON.stringify(manifest, null, 2));
  console.log(`${TAG} manifest saved — ${Object.keys(manifest).length} entries to ${p}`);
}

async function ensureIndex(indexName: string): Promise<void> {
  const indexes = await vectorStore.listIndexes();
  if (!indexes.includes(indexName)) {
    console.log(`${TAG} creating vector index "${indexName}" (dim=1536)`);
    await vectorStore.createIndex({ indexName, dimension: 1536 });
  }
}

/** Simple text chunker — splits by sentences/paragraphs, respects overlap */
function chunkText(text: string): { content: string; index: number }[] {
  if (text.length <= CHUNK_THRESHOLD) {
    return [{ content: text, index: 0 }];
  }

  const chunks: { content: string; index: number }[] = [];
  let start = 0;
  let idx = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_MAX_SIZE, text.length);

    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('.\n'),
      );
      if (lastBreak > CHUNK_MAX_SIZE * 0.3) {
        end = start + lastBreak + 1;
      }
    }

    chunks.push({ content: text.slice(start, end), index: idx++ });
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  console.log(`${TAG} chunked ${text.length} chars → ${chunks.length} chunks (max=${CHUNK_MAX_SIZE}, overlap=${CHUNK_OVERLAP})`);
  return chunks;
}

/** Walk indexable directories and return relative paths from workspace root */
function listIndexableFiles(workspaceDir: string): string[] {
  const files: string[] = [];

  for (const dir of INDEXABLE_DIRS) {
    const absDir = join(workspaceDir, dir);
    if (!existsSync(absDir)) continue;
    walkDir(absDir, workspaceDir, files);
  }

  if (files.length > 0) {
    console.log(`${TAG} found ${files.length} indexable files in [${INDEXABLE_DIRS.join(', ')}]`);
  }
  return files;
}

function walkDir(dirPath: string, baseDir: string, out: string[]): void {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_FILES.has(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, out);
    } else if (INDEXABLE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      out.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
    }
  }
}

// ─── Core: batch embed + upsert ──────────────────────────────────────────────

async function embedFileContent(
  indexName: string,
  relPath: string,
  content: string,
): Promise<void> {
  const chunks = chunkText(content);
  const isChunked = chunks.length > 1;

  if (isChunked) {
    // Delete old chunks first (file may have changed chunk count)
    try {
      await vectorStore.deleteVectors({ indexName, filter: { source: relPath } });
      console.log(`${TAG} cleared old chunks for "${relPath}"`);
    } catch (err) {
      console.log(`${TAG} no old chunks to clear for "${relPath}" (${err instanceof Error ? err.message : err})`);
    }
  }

  // Build ids, texts, metadata for the batch
  const ids: string[] = [];
  const texts: string[] = [];
  const metadatas: Record<string, unknown>[] = [];

  for (const chunk of chunks) {
    const id = isChunked ? `${relPath}__chunk_${chunk.index}` : relPath;
    ids.push(id);
    texts.push(chunk.content);
    metadatas.push(
      isChunked
        ? { id, text: chunk.content, source: relPath, chunkIndex: chunk.index }
        : { id, text: chunk.content, source: relPath },
    );
  }

  console.log(`${TAG} indexing "${relPath}" — ${chunks.length} ${isChunked ? 'chunks' : 'vector'} (${content.length} chars)`);

  // Single embedMany call for all chunks
  const embedStart = Date.now();
  const vectors = await embedTextBatch(texts);
  const embedMs = Date.now() - embedStart;

  // Single bulk upsert
  const upsertStart = Date.now();
  await vectorStore.upsert({ indexName, vectors, metadata: metadatas, ids });
  const upsertMs = Date.now() - upsertStart;

  console.log(`${TAG} indexed "${relPath}" — ${chunks.length} vectors, embed=${embedMs}ms upsert=${upsertMs}ms`);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Full incremental reindex for a workspace. Only processes changed/new files. */
export async function reindexWorkspace(
  workspaceId: string,
  opts?: { force?: boolean },
): Promise<ReindexResult> {
  const workspaceDir = getWorkspaceDir(workspaceId);
  const indexName = getIndexName(workspaceId);
  const startTime = Date.now();

  console.log(`${TAG} reindex start — workspace=${workspaceId} index=${indexName} force=${!!opts?.force}`);

  if (!existsSync(workspaceDir)) {
    return { indexed: 0, skipped: 0, removed: 0, errors: 0 };
  }

  const prevManifest = opts?.force ? {} : loadManifest(workspaceDir);
  const prevCount = Object.keys(prevManifest).length;
  const files = listIndexableFiles(workspaceDir);

  // Nothing on disk and nothing in manifest — skip entirely
  if (files.length === 0 && prevCount === 0) {
    return { indexed: 0, skipped: 0, removed: 0, errors: 0 };
  }

  await ensureIndex(indexName);

  if (opts?.force) {
    console.log(`${TAG} force mode — ignoring previous manifest`);
  }

  const nextManifest: IndexManifest = {};
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  for (const relPath of files) {
    try {
      const absPath = join(workspaceDir, relPath);
      const content = readFileSync(absPath, 'utf-8');
      const hash = contentHash(content);

      if (prevManifest[relPath] === hash) {
        nextManifest[relPath] = hash;
        skipped++;
        continue;
      }

      const isNew = !(relPath in prevManifest);
      console.log(`${TAG} ${isNew ? 'NEW' : 'CHANGED'}: ${relPath} (${content.length} chars, hash=${hash.slice(0, 8)}${isNew ? '' : ` prev=${prevManifest[relPath]?.slice(0, 8)}`})`);

      await embedFileContent(indexName, relPath, content);
      nextManifest[relPath] = hash;
      indexed++;
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      console.error(`${TAG} FAILED to index "${relPath}": ${msg}`);
    }
  }

  // Detect deleted files
  const removedPaths = Object.keys(prevManifest).filter((p) => !(p in nextManifest));
  if (removedPaths.length > 0) {
    console.log(`${TAG} ${removedPaths.length} files removed since last index: ${removedPaths.join(', ')}`);
  }
  for (const removedPath of removedPaths) {
    try {
      await vectorStore.deleteVectors({ indexName, filter: { source: removedPath } });
      // Also try deleting by exact id (non-chunked files)
      try { await vectorStore.deleteVector({ indexName, id: removedPath }); } catch { /* noop */ }
      console.log(`${TAG} deleted vectors for removed file: ${removedPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} FAILED to delete vectors for "${removedPath}": ${msg}`);
    }
  }

  saveManifest(workspaceDir, nextManifest);

  const durationMs = Date.now() - startTime;
  console.log(
    `${TAG} reindex done — workspace=${workspaceId} indexed=${indexed} skipped=${skipped} removed=${removedPaths.length} errors=${errors} prev_manifest=${prevCount} new_manifest=${Object.keys(nextManifest).length} duration=${durationMs}ms`,
  );

  return { indexed, skipped, removed: removedPaths.length, errors };
}

/** Index a single file (call after upload). */
export async function indexFile(workspaceId: string, relPath: string): Promise<void> {
  const startTime = Date.now();
  const workspaceDir = getWorkspaceDir(workspaceId);
  const indexName = getIndexName(workspaceId);
  const absPath = join(workspaceDir, relPath);

  console.log(`${TAG} indexFile start — workspace=${workspaceId} path="${relPath}"`);

  if (!INDEXABLE_EXTENSIONS.has(extname(relPath).toLowerCase())) {
    console.log(`${TAG} indexFile — skipping non-text file: "${relPath}"`);
    return;
  }

  if (!existsSync(absPath)) {
    console.log(`${TAG} indexFile — file not found: ${absPath} — skipping`);
    return;
  }

  await ensureIndex(indexName);

  const content = readFileSync(absPath, 'utf-8');
  console.log(`${TAG} indexFile — read ${content.length} chars from "${relPath}"`);

  await embedFileContent(indexName, relPath, content);

  // Update manifest
  const manifest = loadManifest(workspaceDir);
  manifest[relPath] = contentHash(content);
  saveManifest(workspaceDir, manifest);

  console.log(`${TAG} indexFile done — "${relPath}" in ${Date.now() - startTime}ms`);
}

/** Remove a single file's vectors (call after delete). */
export async function removeFileIndex(workspaceId: string, relPath: string): Promise<void> {
  const startTime = Date.now();
  const workspaceDir = getWorkspaceDir(workspaceId);
  const indexName = getIndexName(workspaceId);

  console.log(`${TAG} removeFileIndex start — workspace=${workspaceId} path="${relPath}"`);

  await ensureIndex(indexName);

  // Delete chunked vectors by source filter
  try {
    await vectorStore.deleteVectors({ indexName, filter: { source: relPath } });
    console.log(`${TAG} removeFileIndex — deleted vectors by filter source="${relPath}"`);
  } catch (err) {
    console.log(`${TAG} removeFileIndex — deleteVectors filter failed for "${relPath}": ${err instanceof Error ? err.message : err}`);
  }
  // Delete non-chunked vector by id
  try {
    await vectorStore.deleteVector({ indexName, id: relPath });
    console.log(`${TAG} removeFileIndex — deleted vector by id="${relPath}"`);
  } catch (err) {
    console.log(`${TAG} removeFileIndex — deleteVector id failed for "${relPath}": ${err instanceof Error ? err.message : err}`);
  }

  // Update manifest
  const manifest = loadManifest(workspaceDir);
  const hadEntry = relPath in manifest;
  delete manifest[relPath];
  saveManifest(workspaceDir, manifest);

  console.log(`${TAG} removeFileIndex done — "${relPath}" (was in manifest: ${hadEntry}) in ${Date.now() - startTime}ms`);
}

// ─── Cron ────────────────────────────────────────────────────────────────────

let cronTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function cronTick(): Promise<void> {
  if (isRunning) {
    console.log(`${TAG} cron tick skipped — previous tick still running`);
    return;
  }
  isRunning = true;
  const tickStart = Date.now();
  console.log(`${TAG} cron tick start`);
  try {
    const rows = await db.select({ id: workspaces.id }).from(workspaces);
    console.log(`${TAG} cron — found ${rows.length} workspace(s) to check`);
    for (const row of rows) {
      await reindexWorkspace(row.id);
    }
    console.log(`${TAG} cron tick done — ${rows.length} workspace(s) processed in ${Date.now() - tickStart}ms`);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error(`${TAG} cron tick FAILED: ${msg}`);
  } finally {
    isRunning = false;
  }
}

export function startIndexCron(): void {
  if (cronTimer) return;
  console.log(`${TAG} cron started — interval=${CRON_INTERVAL_MS / 1000 / 60}min, dirs=[${INDEXABLE_DIRS.join(', ')}]`);
  cronTimer = setInterval(() => { cronTick(); }, CRON_INTERVAL_MS);
  // Run once on startup
  cronTick();
}

export function stopIndexCron(): void {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log(`${TAG} cron stopped`);
  }
}
