import { loadAgentFiles, buildInstructions } from '@hatch/harness';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Workspace, LocalFilesystem, WORKSPACE_TOOLS, LocalSandbox } from '@mastra/core/workspace';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { embed } from 'ai';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { scheduleTools } from '../tools/schedule-tools.js';
import { Mastra } from '@mastra/core';

export const HATCH_HOME = process.env.HATCH_HOME ?? join(homedir(), '.hatch');
export const DEFAULT_MODEL = process.env.HATCH_MODEL ?? 'openrouter/xiaomi/mimo-v2-pro:nitro';

// Shared storage — persists threads, messages, workflow snapshots
export const storage = new LibSQLStore({
  id: 'hatch-storage',
  url: `file:${join(HATCH_HOME, 'hatch.db')}`,
});


export const vectorStore = new LibSQLVector({
  id: `hatch-vector-store`,
  url: `file:${join(HATCH_HOME, 'vectors.db')}`,
});


export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

export const HARNESS_MODES = [
  { id: 'chat', name: 'Chat', color: '#7c3aed', default: true as const, defaultModelId: DEFAULT_MODEL },
] as const;

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

  // Embedder for indexing + search
  const embedder = async (text: string) => {
    const { embedding } = await embed({
      model: new ModelRouterEmbeddingModel({
        modelId: 'openai/text-embedding-3-small',
        providerId: 'openrouter',
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
      dimension: 1536
    })
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
        console.log(`onInit called for ${id}`)
      }
    }),
    sandbox: new LocalSandbox({
      workingDirectory: basePath,
      instructions(opts) {
        return opts.defaultInstructions + `\n All your work must be inside projects folder.`
      },
      // workingDirectory: projects,
      env: {
        // NODE_ENV: 'development',
      },
    }),
    bm25: true,
    vectorStore,
    skills(context) {
      return skillPaths
    },
    embedder,
    tools: {
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
      [WORKSPACE_TOOLS.SEARCH.INDEX]: { enabled: false },
    },
  });
  await ws.init();
  return ws
}


export const mastra = new Mastra({
  storage,
  vectors: {
    vectorStore
  },
})

export function createAgent(workspaceId: string): Agent {
  const { soul, identity } = loadAgentFiles(HATCH_HOME, workspaceId);
  const instructions = buildInstructions(soul, identity);

  return new Agent({
    mastra,
    id: `hatch-${workspaceId}`,
    name: 'Hatch',
    instructions,
    model: DEFAULT_MODEL,
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

        }
      },
    }),
    workspace({ requestContext, mastra, }) {
      return createWorkspace(workspaceId)
    },
  });
}
