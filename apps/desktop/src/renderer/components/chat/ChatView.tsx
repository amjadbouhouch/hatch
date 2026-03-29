import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageActions,
  MessageAction,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  ChainOfThoughtContent,
} from "@/components/ai-elements/chain-of-thought";
import { ChatHeader } from "../layout/ChatHeader";
import { cn } from "@/lib/utils";
import { BotIcon, ShieldAlertIcon, HelpCircleIcon, ClipboardListIcon, CheckCircle2Icon, LoaderIcon, AlertCircleIcon, CopyIcon, CheckIcon, ClockIcon, WrenchIcon, RotateCwIcon, PaperclipIcon, DownloadIcon, FileIcon, type LucideProps } from "lucide-react";
import { useUploadKnowledge } from "../../hooks/use-knowledge.js";
import type { UploadFile } from "../../hooks/use-knowledge.js";
import { useWorkspaceModes } from "../../hooks/use-workspaces.js";
import { getClient } from "../../client/api.js";
import { toast } from "sonner";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useThreadHarness } from "../../stores/harness.js";
import type { HarnessMessage, HarnessMessageContent } from "@hatch/client/harness";

// ─── Content Grouping ────────────────────────────────────────────────────────

type ContentSegment =
  | { kind: "text"; block: HarnessMessageContent; index: number }
  | { kind: "thinking"; block: HarnessMessageContent; index: number }
  | { kind: "tool-group"; items: { block: HarnessMessageContent; index: number }[] };

function groupContentIntoSegments(content: HarnessMessageContent[]): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let currentGroup: { block: HarnessMessageContent; index: number }[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const hasToolCall = currentGroup.some(({ block }) => block.type === "tool_call");
    if (hasToolCall) {
      segments.push({ kind: "tool-group", items: [...currentGroup] });
    } else {
      for (const item of currentGroup) {
        if (item.block.type === "thinking") {
          segments.push({ kind: "thinking", block: item.block, index: item.index });
        }
      }
    }
    currentGroup = [];
  };

  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type === "text") {
      flushGroup();
      segments.push({ kind: "text", block, index: i });
    } else {
      currentGroup.push({ block, index: i });
    }
  }
  flushGroup();

  return segments;
}

// ─── Tool Group (ChainOfThought) ────────────────────────────────────────────

const SpinnerIcon = forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
  <LoaderIcon ref={ref} {...props} className={cn(props.className, "animate-spin")} />
));

function ToolGroupView({
  items,
  toolResults,
  toolStates,
}: {
  items: { block: HarnessMessageContent; index: number }[];
  toolResults: Map<string, any>;
  toolStates?: Map<string, any>;
}) {
  const toolCalls = items.filter(({ block }) => block.type === "tool_call");
  const toolCount = toolCalls.length;
  const hasRunning = toolCalls.some(({ block }) => {
    if (block.type !== "tool_call") return false;
    const result = toolResults.get(block.id);
    const liveState = toolStates?.get(block.id);
    return liveState?.status === "running" || (!result && !liveState);
  });

  const headerLabel = hasRunning
    ? `Using ${toolCount} tool${toolCount !== 1 ? "s" : ""}...`
    : `Used ${toolCount} tool${toolCount !== 1 ? "s" : ""}`;

  return (
    <ChainOfThought defaultOpen={hasRunning}>
      <ChainOfThoughtHeader>{headerLabel}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {toolCalls.map(({ block, index }) => {
          if (block.type !== "tool_call") return null;
          const result = toolResults.get(block.id);
          const liveState = toolStates?.get(block.id);
          const isRunning = liveState?.status === "running" || (!result && !liveState);
          const isError = result?.isError || liveState?.status === "error";
          const stepStatus = isRunning ? ("active" as const) : ("complete" as const);

          return (
            <ChainOfThoughtStep
              key={index}
              label={block.name}
              status={stepStatus}
              icon={isError ? AlertCircleIcon : isRunning ? SpinnerIcon : CheckCircle2Icon}
            />
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}

// ─── Content Renderers ───────────────────────────────────────────────────────

function renderMessageContent(content: HarnessMessageContent[], toolStates?: Map<string, any>) {
  const toolResults = new Map<string, any>();
  for (const block of content) {
    if (block.type === "tool_result") {
      toolResults.set(block.id, block);
    }
  }

  const segments = groupContentIntoSegments(content);

  return segments.map((seg, i) => {
    switch (seg.kind) {
      case "text":
        return <MessageResponse key={i}>{seg.block.type === "text" ? seg.block.text : ""}</MessageResponse>;
      case "thinking":
        return (
          <Reasoning key={i}>
            <ReasoningTrigger />
            <ReasoningContent>{seg.block.type === "thinking" ? seg.block.thinking : ""}</ReasoningContent>
          </Reasoning>
        );
      case "tool-group":
        return (
          <ToolGroupView
            key={i}
            items={seg.items}
            toolResults={toolResults}
            toolStates={toolStates}
          />
        );
      default:
        return null;
    }
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { clearTimeout(timerRef.current); }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // clipboard API may be unavailable in some contexts
    });
  }, [text]);

  return (
    <MessageAction tooltip="Copy" onClick={handleCopy}>
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </MessageAction>
  );
}

// ─── File path detection & download ──────────────────────────────────────────

const FILE_PATH_RE = /(?:^|\s|`)((?:projects|knowledge|memory)\/[^\s`]+\.\w+)/g;

function extractFilePaths(text: string): string[] {
  const paths = new Set<string>();
  for (const match of text.matchAll(FILE_PATH_RE)) {
    paths.add(match[1]);
  }
  return [...paths];
}

function FileDownloadChip({ path, workspaceId }: { path: string; workspaceId: string }) {
  const filename = path.split("/").pop() ?? path;
  const handleDownload = useCallback(async () => {
    try {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].download[':path{.+}'].$get({
        param: { workspaceId, path },
      });
      if (!res.ok) { toast.error("Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  }, [path, workspaceId]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/50 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
    >
      <FileIcon className="size-3 shrink-0 text-muted-foreground/60" />
      <span className="truncate max-w-[200px]">{filename}</span>
      <DownloadIcon className="size-3 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

// ─── Message View ────────────────────────────────────────────────────────────

function HarnessMessageView({ msg, toolStates, workspaceId }: { msg: HarnessMessage; toolStates?: Map<string, any>; workspaceId?: string }) {
  const textContent = useMemo(() => {
    return msg.content
      .filter((c): c is Extract<HarnessMessageContent, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }, [msg.content]);

  const filePaths = useMemo(() => {
    if (msg.role !== "assistant" || !textContent) return [];
    return extractFilePaths(textContent);
  }, [msg.role, textContent]);

  return (
    <Message from={msg.role} key={msg.id}>
      <MessageContent>{renderMessageContent(msg.content, toolStates)}</MessageContent>
      {filePaths.length > 0 && workspaceId && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {filePaths.map((p) => (
            <FileDownloadChip key={p} path={p} workspaceId={workspaceId} />
          ))}
        </div>
      )}
      {textContent && (
        <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={textContent} />
        </MessageActions>
      )}
    </Message>
  );
}

// ─── Approval Banners ────────────────────────────────────────────────────────

function ToolApprovalBanner({
  approval,
  onDecision,
}: {
  approval: { toolCallId: string; toolName: string; args: unknown };
  onDecision: (decision: "allow" | "deny") => void;
}) {
  return (
    <div className="mx-auto my-4 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
        <ShieldAlertIcon className="size-4" />
        Tool approval required: <span className="font-mono">{approval.toolName}</span>
      </div>
      <pre aria-label="Tool arguments" className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-xs">
        {JSON.stringify(approval.args, null, 2)}
      </pre>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onDecision("allow")}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Allow
        </button>
        <button
          onClick={() => onDecision("deny")}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function QuestionBanner({
  question,
  onAnswer,
}: {
  question: { questionId: string; question: string; options?: { label: string; description?: string }[] };
  onAnswer: (questionId: string, answer: string) => void;
}) {
  const [input, setInput] = useState("");

  return (
    <div className="mx-auto my-4 max-w-3xl rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-400">
        <HelpCircleIcon className="size-4" />
        {question.question}
      </div>
      {question.options?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {question.options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onAnswer(question.questionId, opt.label)}
              className="rounded-md border border-border bg-muted/50 px-3 py-1 text-xs hover:bg-muted"
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            aria-label={question.question}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                onAnswer(question.questionId, input.trim());
              }
            }}
            className="flex-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
            placeholder="Type your answer..."
          />
          <button
            onClick={() => input.trim() && onAnswer(question.questionId, input.trim())}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            Answer
          </button>
        </div>
      )}
    </div>
  );
}

function PlanApprovalBanner({
  plan,
  onDecision,
}: {
  plan: { planId: string; title: string; plan: string };
  onDecision: (planId: string, response: "approved" | "rejected", feedback?: string) => void;
}) {
  return (
    <div className="mx-auto my-4 max-w-3xl rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-400">
        <ClipboardListIcon className="size-4" />
        Plan approval: {plan.title}
      </div>
      <div className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-3 text-xs whitespace-pre-wrap">
        {plan.plan}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onDecision(plan.planId, "approved")}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Approve
        </button>
        <button
          onClick={() => onDecision(plan.planId, "rejected")}
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Session Stats ──────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}

function SessionStats({
  turns,
  toolCallCount,
}: {
  turns: { startedAt: number; endedAt: number | null }[];
  toolCallCount: number;
}) {
  const [now, setNow] = useState(Date.now());
  const isRunning = turns.length > 0 && turns[turns.length - 1].endedAt === null;

  // Reset `now` immediately when a new turn starts to avoid stale timestamp
  useEffect(() => {
    if (isRunning) setNow(Date.now());
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const totalMs = useMemo(() => {
    const current = isRunning ? Date.now() : now;
    let total = 0;
    for (const t of turns) {
      total += (t.endedAt ?? current) - t.startedAt;
    }
    return Math.max(0, total);
  }, [turns, now, isRunning]);

  if (turns.length === 0) return null;

  return (
    <div className="mb-2 inline-flex items-center gap-3 rounded-md border border-border/50 bg-muted/50 px-3 py-1.5 text-[11px] text-foreground backdrop-blur">
      <span className="flex items-center gap-1">
        <ClockIcon className={cn("size-3", isRunning && "animate-pulse text-primary/60")} />
        {formatDuration(totalMs)}
      </span>
      <span className="text-border">·</span>
      <span className="flex items-center gap-1">
        <WrenchIcon className="size-3" />
        {toolCallCount} tool{toolCallCount !== 1 ? "s" : ""}
      </span>
      <span className="text-border">·</span>
      <span className="flex items-center gap-1">
        <RotateCwIcon className="size-3" />
        {turns.length} turn{turns.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ─── Attachment helpers (must be rendered inside <PromptInput>) ───────────────

function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton variant="ghost" onClick={() => attachments.openFileDialog()}>
      <PaperclipIcon className="size-4" />
      <span>Attach</span>
    </PromptInputButton>
  );
}

function StagedAttachments() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <div className="px-3 pt-2">
      <Attachments variant="inline">
        {attachments.files.map((file) => (
          <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </div>
  );
}

/** Reports attachment count to parent via callback so submit-disabled can account for files */
function AttachmentCountReporter({ onChange }: { onChange: (count: number) => void }) {
  const attachments = usePromptInputAttachments();
  const count = attachments.files.length;
  useEffect(() => { onChange(count); }, [count, onChange]);
  return null;
}

// ─── Mode Switcher ───────────────────────────────────────────────────────────

interface ModeSwitcherProps {
  modes: Array<{ modeId: string; name: string; color: string | null }>;
  currentModeId: string | null;
  onSwitch: (modeId: string) => void;
}

function ModeSwitcher({ modes, currentModeId, onSwitch }: ModeSwitcherProps) {
  // Fall back to the default mode if no mode_changed event received yet
  const activeId = currentModeId ?? modes.find((m) => (m as any).isDefault)?.modeId ?? modes[0]?.modeId;

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5">
      {modes.map((mode) => {
        const isActive = mode.modeId === activeId;
        return (
          <button
            key={mode.modeId}
            type="button"
            onClick={() => !isActive && onSwitch(mode.modeId)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: mode.color ?? "#6b7280" }}
            />
            {mode.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export function ChatView() {
  const { workspaceId, threadId } = useParams<{ workspaceId: string; threadId: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [attachmentCount, setAttachmentCount] = useState(0);

  const harness = useThreadHarness({
    threadId: threadId!,
    resourceId: workspaceId || DEFAULT_WORKSPACE_ID,
  });

  const {
    messages,
    streamingMessage,
    toolStates,
    status,
    isLoading,
    pendingToolApproval,
    pendingQuestion,
    pendingPlanApproval,
    sendMessage,
    abort,
    approveTool,
    answerQuestion,
    approvePlan,
    pendingFollowUps,
    harnessState,
    currentModeId,
    switchMode,
  } = harness;

  const { data: workspaceModes } = useWorkspaceModes(workspaceId);

  const uploadKnowledge = useUploadKnowledge();

  const promptStatus = useMemo(() => {
    if (status === "submitting") return "submitted" as const;
    if (status === "streaming") return "streaming" as const;
    return "ready" as const;
  }, [status]);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text?.trim() ?? "";
      const files = message.files ?? [];
      if (!text && files.length === 0) return;

      let combinedText = text;

      if (files.length > 0 && workspaceId && threadId) {
        const uploadFiles: UploadFile[] = files.map((f) => ({
          name: f.filename ?? "attachment",
          content: f.url?.split(",")[1] ?? "",
          path: `knowledge/threads/${threadId}`,
        }));

        try {
          const result = await uploadKnowledge.mutateAsync({
            workspaceId,
            files: uploadFiles,
          });

          const refs = result.results
            .filter((r) => r.ok)
            .map((r) => `[File: knowledge/threads/${threadId}/${r.name}]`);

          if (refs.length > 0) {
            combinedText = combinedText
              ? `${combinedText}\n\n${refs.join("\n")}`
              : refs.join("\n");
          }
        } catch {
          // Upload failed — send text only if any
          if (!combinedText) return;
        }
      }

      sendMessage(combinedText);
      setText("");
    },
    [sendMessage, workspaceId, threadId, uploadKnowledge]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  // Show stop button only when streaming with empty input
  const isStreaming = status === "streaming" || status === "submitting";
  const showStop = isStreaming && !text.trim();
  const hasContent = !!text.trim() || attachmentCount > 0;
  const isSubmitDisabled = showStop ? false : !hasContent;

  // All messages to render (committed + streaming)
  const allMessages = useMemo(() => {
    const result = [...messages];
    if (streamingMessage) result.push(streamingMessage);
    return result;
  }, [messages, streamingMessage]);

  // Count total tool calls across all messages
  const totalToolCalls = useMemo(() => {
    let count = 0;
    for (const msg of allMessages) {
      for (const block of msg.content) {
        if (block.type === "tool_call") count++;
      }
    }
    return count;
  }, [allMessages]);

  // Redirect to NewThreadView if thread has no messages (must be in useEffect, not render body)
  const shouldRedirect = !isLoading && messages.length === 0;
  useEffect(() => {
    if (shouldRedirect) {
      navigate(`/${workspaceId}/${threadId}?new=true`, { replace: true });
    }
  }, [shouldRedirect, navigate, workspaceId, threadId]);

  if (shouldRedirect || isLoading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
          <ChatHeader />
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-sm text-muted-foreground animate-pulse">Loading thread...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      {/* Top bar */}
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      {/* Messages + floating input */}
      <div className="relative min-h-0 flex-1">
        <Conversation className="h-full">
          <ConversationContent className="mx-auto w-full min-w-0 max-w-3xl px-3 pb-52 sm:px-5">
            {allMessages.map((msg) => (
              <HarnessMessageView key={msg.id} msg={msg} toolStates={toolStates} workspaceId={workspaceId} />
            ))}

            {/* Approval banners — inside scroll area */}
            {pendingToolApproval && (
              <ToolApprovalBanner approval={pendingToolApproval} onDecision={approveTool} />
            )}
            {pendingQuestion && (
              <QuestionBanner question={pendingQuestion} onAnswer={answerQuestion} />
            )}
            {pendingPlanApproval && (
              <PlanApprovalBanner plan={pendingPlanApproval} onDecision={approvePlan} />
            )}

          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Floating input */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pt-8 pb-4 sm:px-5">
          <div className="pointer-events-auto mx-auto w-full min-w-0 max-w-3xl">
            {/* Session stats */}
            <SessionStats turns={harnessState.turns} toolCallCount={totalToolCalls} />
            {/* Pending follow-up messages */}
            {pendingFollowUps.length > 0 && (
              <div className="mb-2 inline-flex flex-col gap-1">
                {pendingFollowUps.map((msg) => {
                  const msgText = msg.content.find((c) => c.type === "text");
                  return (
                    <div
                      key={msg.id}
                      className="inline-flex items-center gap-2 rounded-md border border-border/50 bg-muted/50 px-3 py-1.5 text-xs backdrop-blur"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-primary/60 animate-pulse" />
                      <span className="flex-1 truncate text-muted-foreground">
                        {msgText?.type === "text" ? msgText.text : ""}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">queued</span>
                    </div>
                  );
                })}
              </div>
            )}
            <PromptInput
              onSubmit={handleSubmit}
              accept=".md,.txt,.pdf,.json,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp"
              maxFileSize={10 * 1024 * 1024}
              maxFiles={10}
              multiple
              className="rounded-md bg-background backdrop-blur"
            >
              <AttachmentCountReporter onChange={setAttachmentCount} />
              <StagedAttachments />
              <PromptInputBody>
                <PromptInputTextarea onChange={handleTextChange} value={text} />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <AttachButton />
                  {workspaceModes && workspaceModes.length > 1 ? (
                    <ModeSwitcher
                      modes={workspaceModes}
                      currentModeId={currentModeId}
                      onSwitch={switchMode}
                    />
                  ) : (
                    <PromptInputButton variant="ghost">
                      <BotIcon className="size-4" />
                      <span>Hatch Agent</span>
                    </PromptInputButton>
                  )}
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={isSubmitDisabled}
                  status={promptStatus}
                  onStop={showStop ? abort : undefined}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
}
