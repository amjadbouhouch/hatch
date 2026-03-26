// ─── Harness Client ──────────────────────────────────────────────────────────
// Shared harness store, SSE connector, and React hook for web-app and mobile.
//
// Usage:
//   import { createHarnessStore, createSSEConnector, createUseThreadHarness } from '@wingen/client/harness';
//
//   const store = createHarnessStore({ apiUrl, getAuthHeaders, onAgentComplete });
//   const { connect, disconnect } = createSSEConnector(store, { apiUrl, getAuthHeaders });
//   const useThreadHarness = createUseThreadHarness(store);

export { createHarnessStore } from './createHarnessStore';
export { createSSEConnector } from './connectSSE';
export { createUseThreadHarness } from './useThreadHarness';
export type { UseThreadHarnessReturn } from './useThreadHarness';

// Types
export type {
  HarnessClientConfig,
  HarnessStore,
  HarnessMessage,
  HarnessStatus,
  HarnessMessageContent,
  TextContent,
  ToolCallContent,
  ToolState,
  ThreadState,
  ThreadPreview,
  PendingToolApproval,
  PendingQuestion,
  PendingPlanApproval,
} from './types';

// Utilities
export { extractPreviewFromContent, extractMessageText } from './utils';
