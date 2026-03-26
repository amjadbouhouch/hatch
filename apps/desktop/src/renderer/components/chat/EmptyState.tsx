import { EggIcon } from "lucide-react";
import { ChatHeader } from "../layout/ChatHeader";
import { useActiveTab } from "../../stores/ui-store.js";
import { useWorkspaces } from "../../hooks/use-workspaces.js";

export function EmptyState() {
  const activeTab = useActiveTab();
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.find((w) => w.id === activeTab?.workspaceId);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      {/* Drag region */}
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <EggIcon className="size-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Start a conversation in{" "}
            <span className="font-medium text-foreground">
              {activeWorkspace?.name ?? "your workspace"}
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
