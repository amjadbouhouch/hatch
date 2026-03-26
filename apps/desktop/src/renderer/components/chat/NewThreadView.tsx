import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import {
  ScrambleText,
  type ScrambleTextHandle,
} from "@/components/unlumen-ui/scramble-text";
import { ChatHeader } from "../layout/ChatHeader";
import { BotIcon, EggIcon } from "lucide-react";
import { useSendMessage } from "../../hooks/use-threads.js";
import { useWorkspaces } from "../../hooks/use-workspaces.js";
import { useQueryClient } from "@tanstack/react-query";

const GREETINGS = [
  "What can I help you build?",
  "Ready to hatch something new",
  "Let's ship something great",
  "What are we working on?",
  "Describe your next feature",
  "Got a bug? Let's squash it",
  "Paste some code, I'll review it",
  "What's on your mind?",
  "Let's figure this out together",
  "Tell me about your project",
  "Ready when you are",
  "What should we tackle first?",
];

export function NewThreadView() {
  const { workspaceId, threadId } = useParams<{ workspaceId: string; threadId: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const scrambleRef = useRef<ScrambleTextHandle>(null);
  const sendMessage = useSendMessage();
  const queryClient = useQueryClient();
  const { data: workspacesList } = useWorkspaces();
  const workspaceName = workspacesList?.find((w) => w.id === workspaceId)?.name ?? "this";

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (!message.text?.trim()) return;

      // Send message via gateway — it auto-creates the thread
      sendMessage.mutate(
        { content: message.text, threadId, workspaceId },
        {
          onSuccess: (data) => {
            const resolvedThreadId = (data as any).threadId || threadId;
            // Invalidate threads list so sidebar picks up the new thread
            queryClient.invalidateQueries({ queryKey: ['threads'] });
            // Navigate to the real thread (remove ?new=true)
            navigate(`/${workspaceId}/${resolvedThreadId}`, { replace: true });
          },
        }
      );
    },
    [sendMessage, threadId, workspaceId, navigate, queryClient]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    []
  );

  const isSubmitDisabled = useMemo(() => !text.trim(), [text]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      {/* Header */}
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      {/* Centered greeting + input */}
      <div className="flex flex-1 flex-col items-center justify-center px-3 sm:px-5">
        <div className="w-full max-w-3xl space-y-8">
          {/* Greeting */}
          <div className="space-y-3 text-center">
            <EggIcon className="size-10 text-primary/40 mx-auto" />
            <h1 className="text-2xl font-semibold text-foreground h-9 flex items-center justify-center">
              <ScrambleText
                ref={scrambleRef}
                text={greeting}
                scrambledClassName="text-primary"
                scrambleSpeed={30}
              />
            </h1>
            <p className="text-sm text-muted-foreground">
              Start a conversation in <span className="font-medium text-foreground">{workspaceName}</span> workspace.
            </p>
          </div>

          {/* Input */}
          <PromptInput onSubmit={handleSubmit} className="rounded-md bg-background/50 backdrop-blur">
            <PromptInputBody>
              <PromptInputTextarea
                autoFocus
                onChange={handleTextChange}
                value={text}
                placeholder="Ask anything..."
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton variant="ghost">
                  <BotIcon className="size-4" />
                  <span>Hatch Agent</span>
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit disabled={isSubmitDisabled} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
