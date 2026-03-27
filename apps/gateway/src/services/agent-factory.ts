import { db, embeddingConfigs, eq, modelConfigs } from '@hatch/database';
import { buildInstructions, loadAgentFiles } from '@hatch/harness';
import type { HarnessModelSettings } from '@hatch/harness';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { LocalFilesystem, LocalSandbox, Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { embed } from 'ai';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { scheduleTools } from '../tools/schedule-tools.js';

export const HATCH_HOME = process.env.HATCH_HOME ?? join(homedir(), '.hatch');
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

export async function createWorkspace(workspaceId: string): Promise<Workspace> {
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

  const skillPaths = [skillsDir];

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

  const ws = new Workspace({
    id,
    searchIndexName,
    name: `Workspace ${workspaceId}`,
    filesystem: new LocalFilesystem({
      basePath,
      contained: true,
      onInit({ filesystem }) {
        console.log(`onInit called for ${id}`);
      },
    }),
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
      instructions(opts) {
        return opts.defaultInstructions + `\n All your work must be inside projects folder.`;
      },
      env: {},
    }),
    bm25: true,
    vectorStore,
    skills(context) {
      return skillPaths;
    },
    embedder,
    tools: {
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
      [WORKSPACE_TOOLS.SEARCH.INDEX]: { enabled: false },
    },
  });
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

  const instructions = buildInstructions(soul, identity);

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
    instructions,
    model: {
      id: config.model as `${string}/${string}`,
      apiKey: config.apiKey ?? undefined,
    },
    tools: scheduleTools,
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
