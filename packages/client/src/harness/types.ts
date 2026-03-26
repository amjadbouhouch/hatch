import type { HarnessEvent, HarnessMessageContent } from '@hatch/shared';

// Re-export for consumers
export type { HarnessEvent, HarnessMessageContent };

// SSE events include threadId from the gateway relay
export type HarnessSSEEvent = HarnessEvent & { threadId: string };

// Extract content subtypes
export type TextContent = Extract<HarnessMessageContent, { type: 'text' }>;
export type ToolCallContent = Extract<HarnessMessageContent, { type: 'tool_call' }>;

// ─── Harness State (client-side subset) ─────────────────────────────────────

export interface HarnessState {
  yolo: boolean;
  permissionRules: { categories: Record<string, string>; tools: Record<string, string> };
  currentModelId: string;
  turns: { startedAt: number; endedAt: number | null }[];
}

// ─── Core Types ──────────────────────────────────────────────────────────────

export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant';
  content: HarnessMessageContent[];
  createdAt: string;
}

export interface ToolState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  status: 'running' | 'completed' | 'error';
  result?: unknown;
  isError?: boolean;
}

export interface PendingToolApproval {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface PendingQuestion {
  questionId: string;
  question: string;
  options?: { label: string; description?: string }[];
}

export interface PendingPlanApproval {
  planId: string;
  title: string;
  plan: string;
}

export type HarnessStatus =
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'waiting-approval';

export interface ThreadState {
  messages: HarnessMessage[];
  streamingMessage: HarnessMessage | null;
  toolStates: Map<string, ToolState>;
  status: HarnessStatus;
  isLoading: boolean;
  pendingToolApproval: PendingToolApproval | null;
  pendingQuestion: PendingQuestion | null;
  pendingPlanApproval: PendingPlanApproval | null;
  followUpCount: number;
  pendingFollowUps: HarnessMessage[];
  harnessState: HarnessState;
}

export interface ThreadPreview {
  content: unknown;
  status: HarnessStatus;
  toolCallCount: number;
  textPreview: string;
  createdAt: string;
  messageCount: number;
}

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface HarnessStore {
  isConnected: boolean;
  threads: Map<string, ThreadState>;
  threadPreviews: Map<string, ThreadPreview>;

  getThread: (threadId: string) => ThreadState;
  setConnected: (v: boolean) => void;
  loadThreadPreviews: (threadIds: string[]) => Promise<void>;
  initThread: (threadId: string, resourceId: string, opts?: { type?: 'dm' | 'task' }) => Promise<void>;
  handleEvent: (data: HarnessSSEEvent) => void;
  sendMessage: (threadId: string, content: string) => Promise<void>;
  abort: (threadId: string) => void;
  approveTool: (threadId: string, decision: 'allow' | 'deny') => void;
  answerQuestion: (threadId: string, questionId: string, answer: string) => void;
  approvePlan: (threadId: string, planId: string, response: 'approved' | 'rejected', feedback?: string) => void;
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface HarnessClientConfig {
  apiUrl: string;
  getAuthHeaders: () => Record<string, string>;
  onAgentComplete?: (info: { threadId: string }) => void;
}
