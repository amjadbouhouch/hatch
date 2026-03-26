import { create } from 'zustand';
import type {
  HarnessClientConfig,
  HarnessSSEEvent,
  HarnessState,
  HarnessStore,
  HarnessMessage,
  HarnessStatus,
  ThreadState,
  ThreadPreview,
} from './types';
import { extractPreviewFromContent, extractMessageText } from './utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_HARNESS_STATE: HarnessState = {
  yolo: true,
  permissionRules: { categories: {}, tools: {} },
  currentModelId: '',
  turns: [],
};

function createEmptyThread(loading: boolean): ThreadState {
  return {
    messages: [],
    streamingMessage: null,
    toolStates: new Map(),
    status: 'idle',
    isLoading: loading,
    pendingToolApproval: null,
    pendingQuestion: null,
    pendingPlanApproval: null,
    followUpCount: 0,
    pendingFollowUps: [],
    harnessState: DEFAULT_HARNESS_STATE,
  };
}

type SetState = (fn: (state: HarnessStore) => Partial<HarnessStore>) => void;

function updateThread(
  set: SetState,
  get: () => HarnessStore,
  threadId: string,
  updater: (t: ThreadState) => Partial<ThreadState>
) {
  set((state) => {
    const current = state.threads.get(threadId) || createEmptyThread(false);
    const patch = updater(current);
    if (Object.keys(patch).length === 0) return state;
    const threads = new Map(state.threads);
    threads.set(threadId, { ...current, ...patch });
    return { threads };
  });
}

// ─── HTTP helpers (use injected config) ──────────────────────────────────────

function createHttpClient(config: HarnessClientConfig) {
  function apiUrl(path: string): string {
    return `${config.apiUrl}/${path}`;
  }

  async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.getAuthHeaders() },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`POST /${path} failed (${res.status}): ${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json() as Promise<T>;
    return undefined as unknown as T;
  }

  async function apiGet<T = unknown>(path: string): Promise<T> {
    const res = await fetch(apiUrl(path), { headers: config.getAuthHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`GET /${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  return { apiUrl, apiPost, apiGet };
}

// ─── Store Factory ───────────────────────────────────────────────────────────

// Track which threads are already initializing to avoid double-init
const initializingThreads = new Set<string>();

export function createHarnessStore(config: HarnessClientConfig) {
  const { apiPost, apiGet } = createHttpClient(config);

  return create<HarnessStore>((set, get) => ({
    isConnected: false,
    threads: new Map(),
    threadPreviews: new Map(),

    getThread: (threadId: string) => {
      return get().threads.get(threadId) || createEmptyThread(false);
    },

    setConnected: (v: boolean) => set({ isConnected: v }),

    // ── Load thread previews (no-op — sidebar uses TanStack Query) ──

    loadThreadPreviews: async (_threadIds: string[]) => {
      // Not needed when using TanStack Query for thread listing
    },

    // ── Init thread (switch + load history + load status + replay buffer) ──

    initThread: async (threadId: string, resourceId: string, opts?: { type?: 'dm' | 'task' }) => {
      const existing = get().threads.get(threadId);
      if (existing && !existing.isLoading && existing.messages.length > 0) return;
      if (initializingThreads.has(threadId)) return;

      initializingThreads.add(threadId);
      updateThread(set, get, threadId, () => createEmptyThread(true));

      try {
        // Load message history + in-flight status in parallel
        // (GET /threads/:id/messages ensures the harness pool entry exists)
        const [data, statusData] = await Promise.all([
          apiGet<{ messages: any[] }>(`threads/${threadId}/messages`),
          apiGet<{
            running: boolean;
            pending: { question: any; toolApproval: any; planApproval: any };
            runBuffer: any[];
            harnessState: Record<string, unknown> | null;
          }>(`status/${threadId}`),
        ]);

        const history: HarnessMessage[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: Array.isArray(m.content)
            ? m.content
            : typeof m.content === 'string'
              ? [{ type: 'text' as const, text: m.content }]
              : [],
          createdAt:
            typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
        }));

        // 3. Apply history + in-flight state in one update
        let resolvedStatus: HarnessStatus = statusData.running ? 'streaming' : 'idle';
        if (
          statusData.pending?.toolApproval ||
          statusData.pending?.question ||
          statusData.pending?.planApproval
        ) {
          resolvedStatus = 'waiting-approval';
        }

        updateThread(set, get, threadId, (t) => {
          // Merge: keep any SSE messages that arrived before history loaded
          const historyIds = new Set(history.map((m: HarnessMessage) => m.id));
          const sseOnly = t.messages.filter((m) => !historyIds.has(m.id));
          const merged = [...history, ...sseOnly];

          return {
            messages: merged,
            isLoading: false,
            status: resolvedStatus,
            pendingToolApproval: statusData.pending?.toolApproval || null,
            pendingQuestion: statusData.pending?.question || null,
            pendingPlanApproval: statusData.pending?.planApproval || null,
            ...(statusData.harnessState && {
              harnessState: { ...t.harnessState, ...statusData.harnessState } as HarnessState,
            }),
          };
        });

        // 4. Replay buffered events
        if (statusData.runBuffer?.length) {
          for (const event of statusData.runBuffer) {
            get().handleEvent({ ...event, threadId } as HarnessSSEEvent);
          }
        }
      } catch (err) {
        console.error('[harnessStore] initThread error:', err);
        updateThread(set, get, threadId, () => ({ isLoading: false }));
      } finally {
        initializingThreads.delete(threadId);
      }
    },

    // ── Global event handler (routes by threadId) ──

    handleEvent: (data: HarnessSSEEvent) => {
      const { threadId } = data;
      if (!threadId) return;

      if (data.type !== 'usage_update') {
        console.log(
          `[harness] ${data.type}`,
          'threadId' in data ? threadId.slice(0, 8) : '',
          Date.now()
        );
      }

      switch (data.type) {
        case 'agent_start':
          updateThread(set, get, threadId, (t) => {
            // If there are pending follow-ups, the agent is now processing the first one
            // Move it from pending to committed messages
            if (t.pendingFollowUps.length > 0) {
              const [next, ...rest] = t.pendingFollowUps;
              return {
                messages: [...t.messages, next],
                pendingFollowUps: rest,
                status: 'streaming' as const,
                toolStates: new Map(),
              };
            }
            return {
              status: 'streaming' as const,
              toolStates: new Map(),
            };
          });
          set((state) => {
            const next = new Map(state.threadPreviews);
            const existing = next.get(threadId);
            next.set(threadId, {
              content: existing?.content ?? null,
              status: 'streaming',
              toolCallCount: 0,
              textPreview: existing?.textPreview ?? '',
              createdAt: existing?.createdAt ?? new Date().toISOString(),
              messageCount: existing?.messageCount ?? 0,
            });
            return { threadPreviews: next };
          });
          break;

        case 'follow_up_queued':
          updateThread(set, get, threadId, () => ({
            followUpCount: data.count,
          }));
          break;

        case 'agent_end':
          updateThread(set, get, threadId, (t) => {
            let messages = t.streamingMessage
              ? (() => {
                  const next = [...t.messages];
                  const idx = next.findIndex((m) => m.id === t.streamingMessage!.id);
                  if (idx >= 0) {
                    next[idx] = t.streamingMessage!;
                  } else {
                    next.push(t.streamingMessage!);
                  }
                  return next;
                })()
              : [...t.messages];

            // When a follow-up exits the pending queue, stamp it with the
            // current time so it sorts/displays after the agent response.
            // Invariant: the last followUpCount user messages are the pending
            // queue; the one exiting now is at [length - followUpCount].
            if (t.followUpCount > 0) {
              const userMessages = messages.filter((m) => m.role === 'user');
              const exitingIndex = Math.max(0, userMessages.length - t.followUpCount);
              if (exitingIndex < userMessages.length) {
                const exitingMsg = userMessages[exitingIndex];
                const now = new Date().toISOString();
                messages = messages.map((m) =>
                  m.id === exitingMsg.id ? { ...m, createdAt: now } : m
                );
              }
            }

            return {
              messages,
              status: 'idle',
              streamingMessage: null,
              pendingToolApproval: null,
              pendingQuestion: null,
              pendingPlanApproval: null,
              followUpCount: Math.max(0, t.followUpCount - 1),
            };
          });
          set((state) => {
            const next = new Map(state.threadPreviews);
            const existing = next.get(threadId);
            if (existing) {
              next.set(threadId, { ...existing, status: 'idle' });
            }
            return { threadPreviews: next };
          });
          // Platform-specific completion callback
          if (data.reason !== 'aborted' && data.reason !== 'error') {
            config.onAgentComplete?.({ threadId });
          }
          break;

        case 'user_message':
          updateThread(set, get, threadId, (t) => {
            const incomingText = data.content;

            // If this matches a pending follow-up, skip — it's already tracked there
            // and will be moved to messages when the agent picks it up (agent_start)
            const isPending = t.pendingFollowUps.some(
              (m) => extractMessageText(m) === incomingText
            );
            if (isPending) return {};

            // Otherwise check for duplicate (normal non-follow-up message)
            const isDuplicate = t.messages.some(
              (m) =>
                m.role === 'user' &&
                extractMessageText(m) === incomingText &&
                Math.abs(
                  new Date(m.createdAt).getTime() - new Date(data.createdAt).getTime()
                ) < 5000
            );
            if (isDuplicate) return {};
            const newMessages = [
              ...t.messages,
              {
                id: crypto.randomUUID(),
                role: 'user' as const,
                content: [{ type: 'text' as const, text: data.content }],
                createdAt: data.createdAt,
              },
            ];
            return { messages: newMessages };
          });
          break;

        case 'message_start':
          updateThread(set, get, threadId, () => ({
            streamingMessage: {
              id: data.message.id || crypto.randomUUID(),
              role: 'assistant' as const,
              content: Array.isArray(data.message.content) ? data.message.content : [],
              createdAt: String(data.message.createdAt || new Date().toISOString()),
            },
            status: 'streaming' as const,
          }));
          break;

        case 'message_update': {
          const { message: msg } = data;
          updateThread(set, get, threadId, (t) => {
            // Auto-create streamingMessage if message_start was never received
            if (!t.streamingMessage || t.streamingMessage.id !== msg.id) {
              return {
                streamingMessage: {
                  id: msg.id || crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: Array.isArray(msg.content) ? msg.content : [],
                  createdAt: String(msg.createdAt || new Date().toISOString()),
                },
                status: 'streaming' as const,
              };
            }
            return {
              streamingMessage: { ...t.streamingMessage, content: msg.content },
            };
          });
          if (msg.content) {
            const { textPreview, toolCallCount } = extractPreviewFromContent(msg.content);
            set((state) => {
              const next = new Map(state.threadPreviews);
              const existing = next.get(threadId);
              next.set(threadId, {
                content: msg.content,
                status: 'streaming',
                toolCallCount,
                textPreview,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                messageCount: existing?.messageCount ?? 0,
              });
              return { threadPreviews: next };
            });
          }
          break;
        }

        case 'message_end': {
          const { message: msg } = data;
          const finalMessage: HarnessMessage = {
            id: msg.id || crypto.randomUUID(),
            role: 'assistant' as const,
            content: Array.isArray(msg.content) ? msg.content : [],
            createdAt: String(msg.createdAt || new Date().toISOString()),
          };
          updateThread(set, get, threadId, (t) => {
            const messages = [...t.messages];
            const idx = messages.findIndex((m) => m.id === finalMessage.id);
            if (idx >= 0) {
              messages[idx] = finalMessage;
            } else {
              messages.push(finalMessage);
            }
            return { messages, streamingMessage: null };
          });
          if (msg.content) {
            const { textPreview, toolCallCount } = extractPreviewFromContent(msg.content);
            set((state) => {
              const next = new Map(state.threadPreviews);
              const existingPreview = state.threadPreviews.get(threadId);
              next.set(threadId, {
                content: msg.content,
                status: existingPreview?.status ?? 'idle',
                toolCallCount,
                textPreview,
                createdAt: String(msg.createdAt || new Date().toISOString()),
                messageCount: (existingPreview?.messageCount ?? 0) + 1,
              });
              return { threadPreviews: next };
            });
          }
          break;
        }

        case 'tool_start':
          updateThread(set, get, threadId, (t) => {
            const next = new Map(t.toolStates);
            next.set(data.toolCallId, {
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
              status: 'running',
            });
            return { toolStates: next };
          });
          set((state) => {
            const next = new Map(state.threadPreviews);
            const existing = next.get(threadId);
            if (existing) {
              next.set(threadId, { ...existing, toolCallCount: existing.toolCallCount + 1 });
            }
            return { threadPreviews: next };
          });
          break;

        case 'tool_end':
          updateThread(set, get, threadId, (t) => {
            const next = new Map(t.toolStates);
            const existing = next.get(data.toolCallId);
            if (existing) {
              next.set(data.toolCallId, {
                ...existing,
                status: data.isError ? 'error' : 'completed',
                result: data.result,
                isError: data.isError,
              });
            }
            return { toolStates: next };
          });
          break;

        case 'tool_approval_required':
          updateThread(set, get, threadId, () => ({
            pendingToolApproval: {
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
            },
            status: 'waiting-approval' as const,
          }));
          break;

        case 'ask_question':
          updateThread(set, get, threadId, () => ({
            pendingQuestion: {
              questionId: data.questionId,
              question: data.question,
              options: data.options,
            },
            status: 'waiting-approval' as const,
          }));
          break;

        case 'plan_approval_required':
          updateThread(set, get, threadId, () => ({
            pendingPlanApproval: {
              planId: data.planId,
              title: data.title,
              plan: data.plan,
            },
            status: 'waiting-approval' as const,
          }));
          break;

        case 'state_changed':
          updateThread(set, get, threadId, (t) => ({
            harnessState: { ...t.harnessState, ...data.state } as HarnessState,
          }));
          break;

        // Informational events — no state change needed
        case 'usage_update':
        case 'mode_changed':
        case 'model_changed':
        case 'info':
        case 'error':
        case 'plan_approved':
        case 'tool_update':
        case 'tool_input_start':
        case 'tool_input_delta':
        case 'tool_input_end':
        case 'shell_output':
        case 'thread_changed':
        case 'thread_created':
        case 'thread_deleted':
        case 'display_state_changed':
        case 'task_updated':
        // Subagent events
        case 'subagent_start':
        case 'subagent_text_delta':
        case 'subagent_tool_start':
        case 'subagent_tool_end':
        case 'subagent_end':
        case 'subagent_model_changed':
        // Workspace events
        case 'workspace_status_changed':
        case 'workspace_ready':
        case 'workspace_error':
        // Ongoing Memory events
        case 'om_status':
        case 'om_observation_start':
        case 'om_observation_end':
        case 'om_observation_failed':
        case 'om_reflection_start':
        case 'om_reflection_end':
        case 'om_reflection_failed':
        case 'om_model_changed':
        case 'om_buffering_start':
        case 'om_buffering_end':
        case 'om_buffering_failed':
        case 'om_activation':
          break;
      }
    },

    // ── Actions ─────────────────────────────────────────────────────────────

    sendMessage: async (threadId: string, content: string) => {
      const userMsg: HarnessMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: content }],
        createdAt: new Date().toISOString(),
      };
      updateThread(set, get, threadId, (t) => {
        const isBusy = t.status === 'streaming' || t.status === 'submitting';
        if (isBusy) {
          // Queue as pending follow-up — don't add to messages yet
          return {
            pendingFollowUps: [...t.pendingFollowUps, userMsg],
            followUpCount: t.followUpCount + 1,
          };
        }
        const base = [...t.messages];
        if (t.streamingMessage) {
          base.push(t.streamingMessage);
        }
        base.push(userMsg);
        return {
          messages: base,
          streamingMessage: null,
          status: 'submitting' as const,
        };
      });

      try {
        await apiPost('send', { threadId, content });
      } catch (error) {
        console.error('[harnessStore] sendMessage error:', error);
        updateThread(set, get, threadId, () => ({ status: 'idle' }));
      }
    },

    abort: async (threadId: string) => {
      try {
        await apiPost('abort', { threadId });
        updateThread(set, get, threadId, () => ({
          status: 'idle',
          streamingMessage: null,
        }));
      } catch (error) {
        console.error('[harnessStore] abort error:', error);
      }
    },

    approveTool: async (threadId: string, decision: 'allow' | 'deny') => {
      try {
        await apiPost('tool-approval', { threadId, decision });
        updateThread(set, get, threadId, () => ({
          pendingToolApproval: null,
          status: 'streaming',
        }));
      } catch (error) {
        console.error('[harnessStore] approveTool error:', error);
      }
    },

    answerQuestion: async (threadId: string, questionId: string, answer: string) => {
      try {
        await apiPost('answer', { threadId, questionId, answer });
        updateThread(set, get, threadId, () => ({
          pendingQuestion: null,
          status: 'streaming',
        }));
      } catch (error) {
        console.error('[harnessStore] answerQuestion error:', error);
      }
    },

    approvePlan: async (
      threadId: string,
      planId: string,
      response: 'approved' | 'rejected',
      feedback?: string
    ) => {
      try {
        await apiPost('plan-approval', { threadId, planId, response, feedback });
        updateThread(set, get, threadId, () => ({
          pendingPlanApproval: null,
          status: 'streaming',
        }));
      } catch (error) {
        console.error('[harnessStore] approvePlan error:', error);
      }
    },
  }));
}
