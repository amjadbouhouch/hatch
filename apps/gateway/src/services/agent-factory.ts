import { db, embeddingConfigs, eq, modelConfigs, workspaceModes, workspaces } from '@hatch/database';
import { buildInstructions, loadAgentFiles } from '@hatch/harness';
import type { HarnessModelSettings } from '@hatch/harness';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { LocalFilesystem, LocalSandbox, Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { DockerSandbox } from './docker-sandbox.js';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { embed } from 'ai';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { scheduleTools } from '../tools/schedule-tools.js';
import { visionTools } from '../tools/vision-tools.js';

export const HATCH_HOME = process.env.HATCH_HOME ?? join(homedir(), '.hatch');
export const DEFAULT_SKILLS_DIR = join(HATCH_HOME, 'default-skills');
export const HATCH_DB_DIR = join(HATCH_HOME, '.db');

// Ensure db directory exists
mkdirSync(HATCH_DB_DIR, { recursive: true });

// Shared storage — persists threads, messages, workflow snapshots
export const storage = new LibSQLStore({
  id: 'hatch-storage',
  url: `file:${join(HATCH_DB_DIR, 'mastra.db')}`,
});

export const vectorStore = new LibSQLVector({
  id: `hatch-vector-store`,
  url: `file:${join(HATCH_DB_DIR, 'vectors.db')}`,
});

export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';


async function loadModelConfig(workspaceId: string) {
  const [row] = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.workspaceId, workspaceId));
  return row ?? null;
}

async function loadEmbeddingConfig(workspaceId: string) {
  const [row] = await db
    .select()
    .from(embeddingConfigs)
    .where(eq(embeddingConfigs.workspaceId, workspaceId));
  return row ?? null;
}

// ─── Workspace ──────────────────────────────────────────────────────────────

async function loadProjectPath(workspaceId: string): Promise<string | null> {
  const [row] = await db.select({ projectPath: workspaces.projectPath }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return row?.projectPath ?? null;
}

export async function createWorkspace(workspaceId: string) {
  const basePath = join(HATCH_HOME, 'workspaces', workspaceId);
  const skillsDir = join(basePath, 'skills');
  const knowledgeDir = join(basePath, 'knowledge');
  const memoryDir = join(basePath, 'memory');
  const projects = join(basePath, 'projects');

  // Ensure directories exist
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(knowledgeDir, { recursive: true });
  mkdirSync(projects, { recursive: true });
  mkdirSync(join(memoryDir, 'daily'), { recursive: true });

  // Load embedding config from DB
  const embeddingConfig = await loadEmbeddingConfig(workspaceId);
  const embeddingModel = embeddingConfig?.model ?? 'openrouter/openai/text-embedding-3-small';
  const embeddingDimension = embeddingConfig?.dimension ?? 1536;

  // Parse "provider/model" for ModelRouterEmbeddingModel
  const slashIdx = embeddingModel.indexOf('/');
  const embProviderId = slashIdx > 0 ? embeddingModel.slice(0, slashIdx) : 'openrouter';
  const embModelId = slashIdx > 0 ? embeddingModel.slice(slashIdx + 1) : embeddingModel;

  const embedder = async (text: string) => {
    const { embedding } = await embed({
      model: new ModelRouterEmbeddingModel({
        modelId: embModelId,
        providerId: embProviderId,
      }),
      value: text,
    });
    return embedding;
  };

  const searchIndexName = `ws_${workspaceId.replace(/-/g, '')}`;
  const indexes = await vectorStore.listIndexes();
  if (!indexes.includes(searchIndexName)) {
    await vectorStore.createIndex({
      indexName: searchIndexName,
      dimension: embeddingDimension,
    });
  }

  const id = `ws-${workspaceId}`;

  // Check if this workspace has a linked project (coding mode)
  const projectPath = await loadProjectPath(workspaceId);
  const isProjectMode = projectPath && existsSync(projectPath);

  let ws;

  if (isProjectMode) {
    // ── Project mode: LocalFilesystem + LocalSandbox + LSP ──
    // Agent works directly on the host project — no Docker
    ws = new Workspace({
      id,
      searchIndexName,
      name: `Workspace ${workspaceId}`,
      filesystem: new LocalFilesystem({
        basePath: projectPath,
        contained: true,
        allowedPaths: [basePath],
      }),
      sandbox: new LocalSandbox({
        workingDirectory: projectPath,
      }),
      lsp: true,
      bm25: true,
      vectorStore,
      skills() {
        return [join(basePath, 'skills')];
      },
      embedder,
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
        [WORKSPACE_TOOLS.SEARCH.INDEX]: { enabled: false },
      },
    });
  } else {
    // ── Sandbox mode: Mounts + Docker ──
    // General workspace with isolated Docker sandbox
    ws = new Workspace({
      id,
      searchIndexName,
      name: `Workspace ${workspaceId}`,
      mounts: {
        '/workspace': new LocalFilesystem({
          basePath,
          contained: true,
        }),
      },
      sandbox: new DockerSandbox({
        id: workspaceId,
        containerName: `hatch-sandbox-${workspaceId}`,
        image: 'hatch-sandbox',
        resourceLimits: {
          memory: process.env.SANDBOX_MEMORY ?? '512m',
          cpus: process.env.SANDBOX_CPUS ?? '1',
          pidsLimit: Number(process.env.SANDBOX_PIDS_LIMIT) || 256,
          tmpfsSize: process.env.SANDBOX_TMPFS_SIZE ?? '100m',
        },
        networkOptions: {
          network: process.env.SANDBOX_NETWORK ?? 'bridge',
        },
        readOnly: process.env.SANDBOX_READ_ONLY !== 'false',
        instructions(opts) {
          return opts.defaultInstructions + `\n All your work must be inside projects folder.`;
        },
      }),
      bm25: true,
      vectorStore,
      skills() {
        return ['/workspace/skills'];
      },
      embedder,
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
        [WORKSPACE_TOOLS.SEARCH.INDEX]: { enabled: false },
      },
    });
  }

  await ws.init();
  return ws;
}

// ─── Mastra ─────────────────────────────────────────────────────────────────

export const mastra = new Mastra({
  storage,
  vectors: {
    vectorStore,
  },
});

export interface CreateAgentResult {
  agent: Agent;
  modelSettings: HarnessModelSettings;
}

export async function createAgent(workspaceId: string): Promise<CreateAgentResult> {
  const { soul, identity } = loadAgentFiles(HATCH_HOME, workspaceId);

  const projectPath = await loadProjectPath(workspaceId);
  const baseInstructions = buildInstructions(soul, identity, { projectPath });

  // Pre-load mode prompts from DB for dynamic instructions
  const dbModes = await db.select().from(workspaceModes).where(eq(workspaceModes.workspaceId, workspaceId));
  const modePrompts = new Map(dbModes.filter((m) => m.prompt).map((m) => [m.modeId, m.prompt!]));

  const config = await loadModelConfig(workspaceId);
  if (!config?.model) {
    throw new Error(`No model configured for workspace ${workspaceId}. Go to Settings → Model & Keys.`);
  }

  // Build modelSettings from DB config (only include defined values)
  const modelSettings: HarnessModelSettings = {};
  if (config.temperature != null) modelSettings.temperature = config.temperature;
  if (config.topP != null) modelSettings.topP = config.topP;
  if (config.topK != null) modelSettings.topK = config.topK;
  if (config.maxTokens != null) modelSettings.maxOutputTokens = config.maxTokens;
  if (config.maxRetries != null) modelSettings.maxRetries = config.maxRetries;
  if (config.seed != null) modelSettings.seed = config.seed;
  if (config.frequencyPenalty != null) modelSettings.frequencyPenalty = config.frequencyPenalty;
  if (config.presencePenalty != null) modelSettings.presencePenalty = config.presencePenalty;

  const agent = new Agent({
    mastra,
    id: `hatch-${workspaceId}`,
    name: 'Hatch',
    instructions: ({ requestContext }) => {
      const modeId = (requestContext as any)?.get?.('harness')?.modeId;
      const modePrompt = modeId ? modePrompts.get(modeId) : undefined;
      return modePrompt ? `${baseInstructions}\n\n---\n\n${modePrompt}` : baseInstructions;
    },
    model: {
      id: config.model as `${string}/${string}`,
      apiKey: config.apiKey ?? undefined,
    },
    tools: { ...scheduleTools, ...visionTools },
    memory: new Memory({
      storage,
      options: {
        generateTitle: true,
        lastMessages: 40,
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: {
            model: 'openrouter/google/gemini-2.5-flash',
          },
          reflection: {
            model: 'openrouter/google/gemini-2.5-flash',
          },
        },
      },
    }),
    workspace({ requestContext, mastra }) {
      return createWorkspace(workspaceId);
    },
  });

  return { agent, modelSettings };
}
