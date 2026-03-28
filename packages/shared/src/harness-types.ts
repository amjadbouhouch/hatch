// ─── Harness Types (shared between server @hatch/harness and client @hatch/client) ──

// =============================================================================
// Token Usage
// =============================================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// Threads
// =============================================================================

export interface HarnessThread {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  tokenUsage?: TokenUsage;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Messages
// =============================================================================

export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: HarnessMessageContent[];
  createdAt: Date;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
}

export type HarnessMessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; result: unknown; isError: boolean }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string }
  | {
    type: 'om_observation_start';
    tokensToObserve: number;
    operationType?: 'observation' | 'reflection';
  }
  | {
    type: 'om_observation_end';
    tokensObserved: number;
    observationTokens: number;
    durationMs: number;
    operationType?: 'observation' | 'reflection';
    observations?: string;
    currentTask?: string;
    suggestedResponse?: string;
  }
  | {
    type: 'om_observation_failed';
    error: string;
    tokensAttempted?: number;
    operationType?: 'observation' | 'reflection';
  };

// =============================================================================
// Workspace
// =============================================================================

export type WorkspaceStatus = 'initializing' | 'ready' | 'error' | 'destroyed';

// =============================================================================
// Display State
// =============================================================================

export interface HarnessDisplayState {
  isRunning: boolean;
  currentMessage: HarnessMessage | null;
  tokenUsage: TokenUsage | null;
}

// =============================================================================
// Events (SSE)
// =============================================================================

export type HarnessEvent =
  | { type: 'mode_changed'; modeId: string; previousModeId: string }
  | { type: 'model_changed'; modelId: string; scope?: 'global' | 'thread' | 'mode'; modeId?: string }
  | { type: 'thread_changed'; threadId: string; previousThreadId: string | null }
  | { type: 'thread_created'; thread: HarnessThread }
  | { type: 'thread_deleted'; threadId: string }
  | { type: 'thread_renamed'; threadId: string; title: string }
  | { type: 'state_changed'; state: Record<string, unknown>; changedKeys: string[] }
  | { type: 'agent_start' }
  | { type: 'agent_end'; reason?: 'complete' | 'aborted' | 'error' }
  | { type: 'message_start'; message: HarnessMessage }
  | { type: 'message_update'; message: HarnessMessage }
  | { type: 'message_end'; message: HarnessMessage }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_approval_required'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'tool_end'; toolCallId: string; result: unknown; isError: boolean }
  | { type: 'tool_input_start'; toolCallId: string; toolName: string }
  | { type: 'tool_input_delta'; toolCallId: string; argsTextDelta: string; toolName?: string }
  | { type: 'tool_input_end'; toolCallId: string }
  | { type: 'shell_output'; toolCallId: string; output: string; stream: 'stdout' | 'stderr' }
  | { type: 'usage_update'; usage: TokenUsage }
  | { type: 'info'; message: string }
  | { type: 'error'; error: Error; errorType?: string; retryable?: boolean; retryDelay?: number }
  | { type: 'follow_up_queued'; count: number }
  | { type: 'user_message'; content: string; createdAt: string }
  | { type: 'workspace_status_changed'; status: WorkspaceStatus; error?: Error }
  | { type: 'workspace_ready'; workspaceId: string; workspaceName: string }
  | { type: 'workspace_error'; error: Error }
  | {
    type: 'om_status';
    windows: {
      active: {
        messages: { tokens: number; threshold: number };
        observations: { tokens: number; threshold: number };
      };
      buffered: {
        observations: {
          status: 'idle' | 'running' | 'complete';
          chunks: number;
          messageTokens: number;
          projectedMessageRemoval: number;
          observationTokens: number;
        };
        reflection: {
          status: 'idle' | 'running' | 'complete';
          inputObservationTokens: number;
          observationTokens: number;
        };
      };
    };
    recordId: string;
    threadId: string;
    stepNumber: number;
    generationCount: number;
  }
  | { type: 'om_observation_start'; cycleId: string; operationType: 'observation' | 'reflection'; tokensToObserve: number }
  | { type: 'om_observation_end'; cycleId: string; durationMs: number; tokensObserved: number; observationTokens: number; observations?: string; currentTask?: string; suggestedResponse?: string }
  | { type: 'om_observation_failed'; cycleId: string; error: string; durationMs: number }
  | { type: 'om_reflection_start'; cycleId: string; tokensToReflect: number }
  | { type: 'om_reflection_end'; cycleId: string; durationMs: number; compressedTokens: number; observations?: string }
  | { type: 'om_reflection_failed'; cycleId: string; error: string; durationMs: number }
  | { type: 'om_model_changed'; role: 'observer' | 'reflector'; modelId: string }
  | { type: 'om_buffering_start'; cycleId: string; operationType: 'observation' | 'reflection'; tokensToBuffer: number }
  | { type: 'om_buffering_end'; cycleId: string; operationType: 'observation' | 'reflection'; tokensBuffered: number; bufferedTokens: number; observations?: string }
  | { type: 'om_buffering_failed'; cycleId: string; operationType: 'observation' | 'reflection'; error: string }
  | { type: 'om_activation'; cycleId: string; operationType: 'observation' | 'reflection'; chunksActivated: number; tokensActivated: number; observationTokens: number; messagesActivated: number; generationCount: number }
  | { type: 'sandbox_access_request'; questionId: string; path: string; reason: string }
  | { type: 'ask_question'; questionId: string; question: string; options?: Array<{ label: string; description?: string }> }
  | { type: 'plan_approval_required'; planId: string; title: string; plan: string }
  | { type: 'plan_approved' }
  | { type: 'subagent_start'; toolCallId: string; agentType: string; task: string; modelId: string }
  | { type: 'subagent_text_delta'; toolCallId: string; agentType: string; textDelta: string }
  | { type: 'subagent_tool_start'; toolCallId: string; agentType: string; subToolName: string; subToolArgs: unknown }
  | { type: 'subagent_tool_end'; toolCallId: string; agentType: string; subToolName: string; subToolResult: unknown; isError: boolean }
  | { type: 'subagent_end'; toolCallId: string; agentType: string; result: string; isError: boolean; durationMs: number }
  | { type: 'subagent_model_changed'; modelId: string; scope: 'global' | 'thread'; agentType?: string }
  | { type: 'task_updated'; tasks: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed'; activeForm: string }> }
  | { type: 'display_state_changed'; displayState: HarnessDisplayState };

export type HarnessEventListener = (event: HarnessEvent) => void | Promise<void>;
