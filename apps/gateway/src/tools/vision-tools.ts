import { createTool } from '@mastra/core/tools';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod/v4';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { db, visionConfigs, eq } from '@hatch/database';
import { HATCH_HOME, mastra } from '../services/agent-factory.js';
import type { HarnessRequestContext } from '@hatch/harness';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWorkspaceId(requestContext: any): string {
  const harnessCtx = requestContext?.get('harness') as HarnessRequestContext | undefined;
  if (!harnessCtx?.resourceId) {
    throw new Error('Missing workspaceId — harness context not available');
  }
  return harnessCtx.resourceId;
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// ─── Tool ───────────────────────────────────────────────────────────────────

const readImageTool = createTool({
  id: 'read_image',
  description:
    'Read and describe an image file using the configured vision model. ' +
    'Use this when the user shares or references an image (png, jpg, gif, webp) and you need to understand its contents.',
  inputSchema: z.object({
    label: z.string().describe('Short action label (e.g. "Analyzing screenshot"). Present progressive form.'),
    path: z.string().describe('Workspace-relative file path, e.g. "knowledge/threads/abc/photo.png"'),
    prompt: z
      .string()
      .optional()
      .describe('What to focus on — e.g. "Extract all visible text", "Describe the chart data", "What does this UI show?"'),
  }),
  execute: async (input, context) => {
    const workspaceId = getWorkspaceId(context?.requestContext);

    // Load vision config
    const [config] = await db
      .select()
      .from(visionConfigs)
      .where(eq(visionConfigs.workspaceId, workspaceId));

    if (!config?.model) {
      return { error: 'No vision model configured. Ask the user to set one in Settings → Vision Model.' };
    }

    // Read image from disk
    const filePath = join(HATCH_HOME, 'workspaces', workspaceId, input.path);
    if (!existsSync(filePath)) {
      return { error: `Image not found: ${input.path}` };
    }

    const ext = extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext];
    if (!mimeType) {
      return { error: `Unsupported image format: ${ext}. Supported: png, jpg, gif, webp.` };
    }

    const imageBuffer = readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');

    const userPrompt = input.prompt
      ?? 'Describe this image in detail. Include all visible text, data, layout, and structure.';

    // Use a Mastra Agent with the vision model
    const visionAgent = new Agent({
      mastra,
      id: `vision-${workspaceId}`,
      name: 'Vision',
      instructions: 'You are a vision model. Describe images accurately and thoroughly.',
      model: {
        id: config.model as `${string}/${string}`,
        apiKey: config.apiKey ?? undefined,
      },
    });

    const response = await visionAgent.generate([
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:${mimeType};base64,${base64}` },
          { type: 'text', text: userPrompt },
        ],
      },
    ], { maxTokens: config.maxTokens ?? 1024 });

    return { description: response.text };
  },
});

// ─── Export ─────────────────────────────────────────────────────────────────

export const visionTools = {
  readImage: readImageTool,
};
