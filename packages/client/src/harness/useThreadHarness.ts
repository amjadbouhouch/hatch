import { useEffect, useCallback, useRef } from 'react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';
import type {
  HarnessState,
  HarnessStore,
  HarnessMessage,
  ToolState,
  HarnessStatus,
  PendingToolApproval,
  PendingQuestion,
  PendingPlanApproval,
} from './types';

interface UseThreadHarnessOptions {
  threadId: string;
  resourceId: string;
  type?: 'dm' | 'task';
}

export interface UseThreadHarnessReturn {
  messages: HarnessMessage[];
  streamingMessage: HarnessMessage | null;
  toolStates: Map<string, ToolState>;
  status: HarnessStatus;
  isLoading: boolean;
  isConnected: boolean;
  pendingToolApproval: PendingToolApproval | null;
  pendingQuestion: PendingQuestion | null;
  pendingPlanApproval: PendingPlanApproval | null;
  followUpCount: number;
  pendingFollowUps: HarnessMessage[];
  harnessState: HarnessState;
  currentModeId: string | null;
  sendMessage: (content: string) => void;
  abort: () => void;
  approveTool: (decision: 'allow' | 'deny') => void;
  answerQuestion: (questionId: string, answer: string) => void;
  approvePlan: (planId: string, response: 'approved' | 'rejected', feedback?: string) => void;
  switchMode: (modeId: string) => void;
}

const EMPTY_TOOL_STATES = new Map<string, ToolState>();
const EMPTY_MESSAGES: HarnessMessage[] = [];
const DEFAULT_HARNESS_STATE: HarnessState = {
  yolo: true,
  permissionRules: { categories: {}, tools: {} },
  currentModelId: '',
  turns: [],
};

/**
 * Creates a platform-agnostic `useThreadHarness` hook bound to a specific store instance.
 *
 * Usage:
 * ```ts
 * const useThreadHarness = createUseThreadHarness(myHarnessStore);
 * // Then in a component:
 * const { messages, sendMessage } = useThreadHarness({ threadId, resourceId });
 * ```
 */
export function createUseThreadHarness(store: StoreApi<HarnessStore>) {
  return function useThreadHarness({
    threadId,
    resourceId,
    type,
  }: UseThreadHarnessOptions): UseThreadHarnessReturn {
    const initThread = useStore(store, (s) => s.initThread);
    const initRef = useRef(false);

    // Initialize thread on first mount (or when threadId changes)
    useEffect(() => {
      initRef.current = false;
    }, [threadId]);

    useEffect(() => {
      if (!initRef.current) {
        initRef.current = true;
        initThread(threadId, resourceId, type ? { type } : undefined);
      }
    }, [threadId, resourceId, type, initThread]);

    // Select individual properties to avoid useShallow issues with Map values.
    const messages = useStore(
      store,
      (s) => s.threads.get(threadId)?.messages ?? EMPTY_MESSAGES
    );
    const streamingMessage = useStore(
      store,
      (s) => s.threads.get(threadId)?.streamingMessage ?? null
    );
    const toolStates = useStore(
      store,
      (s) => s.threads.get(threadId)?.toolStates ?? EMPTY_TOOL_STATES
    );
    const status = useStore(
      store,
      (s) => s.threads.get(threadId)?.status ?? ('idle' as HarnessStatus)
    );
    const isLoading = useStore(store, (s) => s.threads.get(threadId)?.isLoading ?? true);
    const pendingToolApproval = useStore(
      store,
      (s) => s.threads.get(threadId)?.pendingToolApproval ?? null
    );
    const pendingQuestion = useStore(
      store,
      (s) => s.threads.get(threadId)?.pendingQuestion ?? null
    );
    const pendingPlanApproval = useStore(
      store,
      (s) => s.threads.get(threadId)?.pendingPlanApproval ?? null
    );
    const followUpCount = useStore(
      store,
      (s) => s.threads.get(threadId)?.followUpCount ?? 0
    );
    const pendingFollowUps = useStore(
      store,
      (s) => s.threads.get(threadId)?.pendingFollowUps ?? EMPTY_MESSAGES
    );
    const harnessState = useStore(
      store,
      (s) => s.threads.get(threadId)?.harnessState ?? DEFAULT_HARNESS_STATE
    );
    const currentModeId = useStore(
      store,
      (s) => s.threads.get(threadId)?.currentModeId ?? null
    );
    const isConnected = useStore(store, (s) => s.isConnected);

    // Bound actions
    const storeSend = useStore(store, (s) => s.sendMessage);
    const storeAbort = useStore(store, (s) => s.abort);
    const storeApproveTool = useStore(store, (s) => s.approveTool);
    const storeAnswerQuestion = useStore(store, (s) => s.answerQuestion);
    const storeApprovePlan = useStore(store, (s) => s.approvePlan);
    const storeSwitchMode = useStore(store, (s) => s.switchMode);

    const sendMessage = useCallback(
      (content: string) => storeSend(threadId, content),
      [storeSend, threadId]
    );
    const abort = useCallback(() => storeAbort(threadId), [storeAbort, threadId]);
    const approveTool = useCallback(
      (decision: 'allow' | 'deny') => storeApproveTool(threadId, decision),
      [storeApproveTool, threadId]
    );
    const answerQuestion = useCallback(
      (questionId: string, answer: string) => storeAnswerQuestion(threadId, questionId, answer),
      [storeAnswerQuestion, threadId]
    );
    const approvePlan = useCallback(
      (planId: string, response: 'approved' | 'rejected', feedback?: string) =>
        storeApprovePlan(threadId, planId, response, feedback),
      [storeApprovePlan, threadId]
    );
    const switchMode = useCallback(
      (modeId: string) => storeSwitchMode(threadId, modeId),
      [storeSwitchMode, threadId]
    );

    return {
      messages,
      streamingMessage,
      toolStates,
      status,
      isLoading,
      isConnected,
      pendingToolApproval,
      pendingQuestion,
      pendingPlanApproval,
      followUpCount,
      pendingFollowUps,
      harnessState,
      currentModeId,
      sendMessage,
      abort,
      approveTool,
      answerQuestion,
      approvePlan,
      switchMode,
    };
  };
}
