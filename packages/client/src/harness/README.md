# @wingen/client/harness

Zustand store, SSE connector, and React hook for real-time agent conversations via the Harness backend. Works on both web (Next.js) and mobile (React Native / Expo).

## Overview

The Harness is the server-side agent orchestration layer (`@wingen/harness`). It manages multi-mode AI agents where each mode has its own model, tools, and permissions. The backend exposes a pool of harness instances behind REST endpoints (`/harness/*`) and a single SSE stream (`GET /harness/events`).

```
Client sends message  -->  POST /harness/send  -->  Harness runs agent
                                                         |
                                                    SSE events stream back
                                                         |
                                              agent_start, message_update,
                                              tool_start/end, state_changed,
                                              agent_end, ...
                                                         |
                                              Client store updates  -->  UI re-renders
```

There are two thread types:

| Type     | Purpose                               | Modes           | Tools                                         | State                             |
| -------- | ------------------------------------- | --------------- | --------------------------------------------- | --------------------------------- |
| **DM**   | Open-ended conversation with an agent | ops, plan, fast | Full toolset (CRUD, KB, scheduling, etc.)     | Permissions, model prefs          |
| **Task** | Guided subtask completion (checklist) | checklist       | `suggest-subtask-ui`, `save-user-answer-tool` | Permissions, `executedSubtasks[]` |

## Architecture

```
@wingen/client/harness
  createHarnessStore()      Zustand store factory (event handling, thread state, HTTP actions)
  createSSEConnector()      SSE connection manager (fetch + ReadableStream, auto-reconnect)
  createUseThreadHarness()  React hook factory (per-thread selectors + bound actions)
  types                     HarnessMessage, ThreadState, HarnessStore, etc.
  utils                     extractPreviewFromContent, extractMessageText
```

Factory pattern injects platform-specific concerns (auth, URL, callbacks) at setup time. All event handling, state management, and SSE parsing is shared across platforms.

## Setup

### 1. Create the store

Create a single file that wires up the store, SSE connector, and hook for your platform:

```typescript
// stores/harness.ts
import {
  createHarnessStore,
  createSSEConnector,
  createUseThreadHarness,
} from '@wingen/client/harness';

const config = {
  apiUrl: 'https://api.example.com',
  getAuthHeaders: () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  }),
  onAgentComplete: ({ threadId }) => {
    // Web: play notification sound, show toast
    // Mobile: trigger haptics
  },
};

export const useHarnessStore = createHarnessStore(config);

const sse = createSSEConnector(useHarnessStore, config);
export const connectSSE = sse.connect;
export const disconnectSSE = sse.disconnect;

export const useThreadHarness = createUseThreadHarness(useHarnessStore);
```

### 2. Connect SSE at app root

Connect once when the user is authenticated. SSE auto-reconnects on connection loss (5s interval).

```tsx
import { connectSSE, disconnectSSE } from '@/stores/harness';

useEffect(() => {
  if (isAuthenticated) {
    connectSSE();
    return () => disconnectSSE();
  }
}, [isAuthenticated]);
```

### 3. Use in components

```tsx
import { useThreadHarness } from '@/stores/harness';

function ChatThread({ threadId, agentId, resourceId }) {
  const { messages, streamingMessage, status, isLoading, sendMessage } = useThreadHarness({
    threadId,
    agentId,
    resourceId,
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
      {streamingMessage && <Message message={streamingMessage} streaming />}
      <Input onSubmit={(text) => sendMessage(text)} />
    </>
  );
}
```

## Usage: DM Thread

A DM thread is an open-ended conversation with an AI agent. It has full tools, multiple modes (ops/plan/fast), and supports tool approvals, questions, and plan reviews.

```tsx
function DMThread({ threadId, agentId, resourceId }) {
  const {
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
    harnessState,
    sendMessage,
    abort,
    approveTool,
    answerQuestion,
    approvePlan,
  } = useThreadHarness({ threadId, agentId, resourceId });

  // --- Messages ---
  // messages: HarnessMessage[] — full conversation history
  // streamingMessage: HarnessMessage | null — the in-flight assistant message (updates in real-time)

  // --- Status ---
  // status: 'idle' | 'submitting' | 'streaming' | 'waiting-approval'
  //   idle              Agent is not running
  //   submitting        User message sent, waiting for agent_start
  //   streaming         Agent is generating (text, tool calls)
  //   waiting-approval  Agent paused, needs user input (tool approval, question, plan)

  // --- Tool execution ---
  // toolStates: Map<toolCallId, ToolState>
  // Each ToolState has: { toolCallId, toolName, args, status: 'running' | 'completed' | 'error', result? }
  // Use this to render tool execution cards with live status indicators.

  // --- Interactive approvals ---
  if (pendingToolApproval) {
    // Agent wants to execute a tool that requires permission
    // Show: toolName, args, approve/deny buttons
    return (
      <ToolApprovalCard
        tool={pendingToolApproval}
        onApprove={() => approveTool('allow')}
        onDeny={() => approveTool('deny')}
      />
    );
  }

  if (pendingQuestion) {
    // Agent asked the user a question (free-text or multiple-choice)
    // pendingQuestion: { questionId, question, options?: { label, description }[] }
    return (
      <QuestionCard
        question={pendingQuestion}
        onAnswer={(answer) => answerQuestion(pendingQuestion.questionId, answer)}
      />
    );
  }

  if (pendingPlanApproval) {
    // Agent submitted a plan for review
    // pendingPlanApproval: { planId, title, plan (markdown) }
    return (
      <PlanReviewCard
        plan={pendingPlanApproval}
        onApprove={() => approvePlan(pendingPlanApproval.planId, 'approved')}
        onReject={(feedback) => approvePlan(pendingPlanApproval.planId, 'rejected', feedback)}
      />
    );
  }

  // --- Harness state ---
  // harnessState: HarnessSchemas.HarnessState (typed from @wingen/shared)
  // Contains: yolo, permissionRules, currentModelId, executedSubtasks
  // Updates arrive via SSE state_changed events — no polling needed.

  // --- Follow-ups ---
  // followUpCount: number — messages queued while agent is busy
  // When > 0, the agent will process them after the current run completes.

  // --- Actions ---
  // sendMessage(content)  — send or queue a user message
  // abort()               — stop current generation

  return <>{/* render messages, input, etc. */}</>;
}
```

## Usage: Task Thread

A task thread guides a field user through completing subtasks (checklist mode). It uses a restricted tool set and tracks progress via `harnessState.executedSubtasks`.

```tsx
function TaskThread({ taskId, agentId, resourceId, totalSubtasks }) {
  const { messages, streamingMessage, status, isLoading, harnessState, sendMessage } =
    useThreadHarness({
      threadId: taskId, // threadId === taskId by convention
      agentId,
      resourceId,
      type: 'task', // creates a checklist-mode harness
    });

  // --- Progress tracking ---
  // harnessState.executedSubtasks: string[] — IDs of subtasks the user has answered
  // Updated in real-time via SSE when save-user-answer-tool runs.
  // On harness init, seeded from DB if the harness was previously swept from the pool.
  const { executedSubtasks } = harnessState;
  const completedCount = executedSubtasks.length;
  const progress = totalSubtasks > 0 ? completedCount / totalSubtasks : 0;

  // --- Render progress bar ---
  return (
    <div>
      <ProgressBar value={progress} />
      <span>
        {completedCount} / {totalSubtasks} completed
      </span>

      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
      {streamingMessage && <Message message={streamingMessage} streaming />}

      <Input onSubmit={(text) => sendMessage(text)} />
    </div>
  );
}
```

### Task thread lifecycle

1. **Init** (`type: 'task'`) — harness creates a single-mode "checklist" harness with restricted tools
2. **Agent guides user** — calls `suggest-subtask-ui` (renders interactive input), waits for user answer
3. **User answers** — agent calls `save-user-answer-tool` which:
   - Validates the answer
   - Writes to DB (`subtask.userAnswer`, `score`, `agentFeedback`, `status: IN_PROGRESS`)
   - Updates `harnessState.executedSubtasks` (instant SSE push to client)
   - Promotes parent task `PENDING` to `IN_PROGRESS` on first answer
4. **Repeat** until all subtasks are answered
5. **Submit** — final `submit()` call runs image analysis, computes task score, sets `COMPLETED`

### Checking if a specific subtask was completed

```tsx
const isSubtaskDone = (subtaskId: string) => harnessState.executedSubtasks.includes(subtaskId);
```

## Direct Store Access

For thread previews, global state, or use outside React components:

```typescript
import { useHarnessStore } from '@/stores/harness';

// In a React component — reactive
const isConnected = useHarnessStore((s) => s.isConnected);
const threadState = useHarnessStore((s) => s.getThread(threadId));
const executedSubtasks = useHarnessStore(
  (s) => s.threads.get(threadId)?.harnessState.executedSubtasks ?? []
);

// Outside React — imperative
const state = useHarnessStore.getState();
await state.loadThreadPreviews(['thread-1', 'thread-2']);
```

## Harness State

`harnessState` is a typed object (`HarnessSchemas.HarnessState` from `@wingen/shared`) that flows through the entire stack:

```
@wingen/shared/harnessSchemas.ts    Single source of truth (zod schema + inferred types)
         |
         +---> api/harnessService.ts          Harness constructor stateSchema
         +---> backend-shared/tools           Tool reads/writes via HarnessContext
         +---> packages/client/harness        ThreadState.harnessState, useThreadHarness return
```

The schema is defined once in `@wingen/shared`. Adding a new field to the state schema automatically types it everywhere.

### Fields

| Field              | Type                    | Default | Description                                   |
| ------------------ | ----------------------- | ------- | --------------------------------------------- |
| `yolo`             | `boolean`               | `true`  | Auto-approve all tool calls                   |
| `permissionRules`  | `{ categories, tools }` | `{}`    | Per-category and per-tool permission policies |
| `currentModelId`   | `string`                | `''`    | Active model for the current mode             |
| `executedSubtasks` | `string[]`              | `[]`    | IDs of answered subtasks (task threads only)  |

### How state updates reach the client

1. Tool or harness calls `setState({ executedSubtasks: [...] })`
2. Harness validates against the zod schema, persists to thread metadata
3. Harness emits `state_changed` event with `{ state, changedKeys }`
4. SSE relay broadcasts to connected clients
5. Client store merges into `ThreadState.harnessState`
6. React re-renders via zustand selector

## API Reference

### `createHarnessStore(config)`

Returns a Zustand `StoreApi<HarnessStore>`.

**Config:**

| Field             | Type                           | Required | Description                                                |
| ----------------- | ------------------------------ | -------- | ---------------------------------------------------------- |
| `apiUrl`          | `string`                       | yes      | Base URL for the API                                       |
| `getAuthHeaders`  | `() => Record<string, string>` | yes      | Returns auth headers per request (supports token rotation) |
| `onAgentComplete` | `(info: { threadId }) => void` | no       | Called when an agent run completes successfully            |

**Store actions:**

| Action               | Signature                                                 | Description                                   |
| -------------------- | --------------------------------------------------------- | --------------------------------------------- |
| `initThread`         | `(threadId, agentId, resourceId, opts?) => Promise<void>` | Load history + status, replay buffered events |
| `handleEvent`        | `(event: HarnessSSEEvent) => void`                        | Process a single SSE event                    |
| `sendMessage`        | `(threadId, agentId, content) => Promise<void>`           | Send or queue a user message                  |
| `abort`              | `(threadId) => void`                                      | Stop current generation                       |
| `approveTool`        | `(threadId, decision) => void`                            | Approve or deny a pending tool call           |
| `answerQuestion`     | `(threadId, questionId, answer) => void`                  | Answer an agent question                      |
| `approvePlan`        | `(threadId, planId, response, feedback?) => void`         | Approve or reject a plan                      |
| `loadThreadPreviews` | `(threadIds: string[]) => Promise<void>`                  | Bulk-load last assistant message per thread   |

### `createSSEConnector(store, config)`

Returns `{ connect, disconnect }`. Call `connect()` once when authenticated. Auto-reconnects on failure (5s interval). Uses `fetch().body.getReader()` (not `EventSource`) to support custom auth headers.

### `createUseThreadHarness(store)`

Returns a React hook: `useThreadHarness(options) => UseThreadHarnessReturn`.

**Options:**

| Field        | Type             | Required | Description                      |
| ------------ | ---------------- | -------- | -------------------------------- |
| `threadId`   | `string`         | yes      | Thread to connect to             |
| `agentId`    | `string`         | yes      | Agent instance ID                |
| `resourceId` | `string`         | yes      | Resource scope                   |
| `type`       | `'dm' \| 'task'` | no       | Thread type (defaults to `'dm'`) |

**Return value:**

| Field                 | Type                                    | Description                                                   |
| --------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `messages`            | `HarnessMessage[]`                      | Conversation history                                          |
| `streamingMessage`    | `HarnessMessage \| null`                | In-flight assistant message                                   |
| `toolStates`          | `Map<string, ToolState>`                | Live tool execution states                                    |
| `status`              | `HarnessStatus`                         | `'idle' \| 'submitting' \| 'streaming' \| 'waiting-approval'` |
| `isLoading`           | `boolean`                               | `true` during initial thread load                             |
| `isConnected`         | `boolean`                               | SSE connection status                                         |
| `pendingToolApproval` | `PendingToolApproval \| null`           | Tool awaiting user approval                                   |
| `pendingQuestion`     | `PendingQuestion \| null`               | Agent question awaiting answer                                |
| `pendingPlanApproval` | `PendingPlanApproval \| null`           | Plan awaiting review                                          |
| `followUpCount`       | `number`                                | Queued messages while agent is busy                           |
| `harnessState`        | `HarnessSchemas.HarnessState`           | Live harness state (permissions, model, executedSubtasks)     |
| `sendMessage`         | `(content: string) => void`             | Send a user message                                           |
| `abort`               | `() => void`                            | Abort current generation                                      |
| `approveTool`         | `(decision) => void`                    | Respond to tool approval                                      |
| `answerQuestion`      | `(questionId, answer) => void`          | Answer agent question                                         |
| `approvePlan`         | `(planId, response, feedback?) => void` | Respond to plan approval                                      |

## Utilities

```typescript
import { extractMessageText, extractPreviewFromContent } from '@wingen/client/harness';

// Extract plain text from a message (filters out tool_call, thinking, etc.)
const text = extractMessageText(message);

// Extract preview text + tool call count from raw content
// Handles: HarnessMessageContent[], string, and Mastra DB format
const { textPreview, toolCallCount } = extractPreviewFromContent(rawContent);
```

## SSE Event Handling

The store handles 30+ event types. Key events and their effects:

| Event                    | Store Effect                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| `agent_start`            | `status: 'streaming'`, clear tool states                            |
| `message_start`          | Create `streamingMessage`                                           |
| `message_update`         | Update `streamingMessage.content`                                   |
| `message_end`            | Move `streamingMessage` to `messages[]`                             |
| `agent_end`              | `status: 'idle'`, commit streaming message, clear pending approvals |
| `user_message`           | Append user message (with 5s dedup window)                          |
| `tool_start`             | Add to `toolStates` with `status: 'running'`                        |
| `tool_end`               | Update tool state to `'completed'` or `'error'`                     |
| `tool_approval_required` | Set `pendingToolApproval`, `status: 'waiting-approval'`             |
| `ask_question`           | Set `pendingQuestion`, `status: 'waiting-approval'`                 |
| `plan_approval_required` | Set `pendingPlanApproval`, `status: 'waiting-approval'`             |
| `state_changed`          | Merge `data.state` into `harnessState`                              |
| `follow_up_queued`       | Update `followUpCount`                                              |
