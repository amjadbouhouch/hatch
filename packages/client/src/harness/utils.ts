import type { HarnessMessage, HarnessMessageContent, TextContent } from './types';

/** Extract preview text + tool count from content.
 *  Handles three shapes:
 *  1. HarnessMessageContent[] (SSE / normalized store)
 *  2. string (legacy / plain text)
 *  3. Mastra DB format { format: 2, parts: [...], content: "text" } (cold-load previews)
 */
export function extractPreviewFromContent(content: unknown): {
  textPreview: string;
  toolCallCount: number;
} {
  if (typeof content === 'string') return { textPreview: content, toolCallCount: 0 };
  if (Array.isArray(content)) {
    let textPreview = '';
    let toolCallCount = 0;
    for (const part of content as HarnessMessageContent[]) {
      if (part.type === 'text') textPreview += part.text;
      if (part.type === 'tool_call') toolCallCount++;
    }
    return { textPreview, toolCallCount };
  }
  // Mastra DB format: { format: 2, parts: [...], content: "plain text" }
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;
    if (typeof obj.content === 'string') {
      const parts = Array.isArray(obj.parts) ? (obj.parts as { type: string }[]) : [];
      let toolCallCount = 0;
      for (const part of parts) {
        if (part.type === 'tool-call') toolCallCount++;
      }
      return { textPreview: obj.content, toolCallCount };
    }
  }
  return { textPreview: '', toolCallCount: 0 };
}

/** Extract plain text from a harness message. */
export function extractMessageText(message: HarnessMessage | null): string {
  if (!message) return '';
  return message.content
    .filter((p): p is TextContent => p.type === 'text')
    .map((p) => p.text)
    .join('');
}
