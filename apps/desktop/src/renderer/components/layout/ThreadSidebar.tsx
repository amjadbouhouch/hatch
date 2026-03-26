import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  BellIcon,
  BookOpenIcon,
  CalendarClockIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreads } from "../../hooks/use-threads.js";
import { useActiveTab } from "../../stores/ui-store.js";
import { useWorkspaces } from "../../hooks/use-workspaces.js";
import { useSchedules } from "../../hooks/use-schedules.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type ThreadStatus = "idle" | "working" | "completed" | "awaiting-input" | "error";

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

// ─── Status Helpers ──────────────────────────────────────────────────────────

function statusLabel(status: ThreadStatus): string | null {
  switch (status) {
    case "working":
      return "Working";
    case "awaiting-input":
      return "Awaiting";
    case "error":
      return "Error";
    default:
      return null;
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapRunningToStatus(running: boolean): ThreadStatus {
  return running ? "working" : "idle";
}

// ─── Workspace section links ────────────────────────────────────────────────

const WORKSPACE_SECTIONS = [
  { label: "Skills", path: "skills", icon: SparklesIcon },
  { label: "Schedules", path: "schedules", icon: CalendarClockIcon },
  { label: "Knowledge", path: "knowledge", icon: BookOpenIcon },
  { label: "Settings", path: "settings", icon: SettingsIcon },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function ThreadSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: threads } = useThreads();
  const { data: workspaces } = useWorkspaces();
  const activeTab = useActiveTab();
  const activeWorkspaceId = activeTab?.workspaceId ?? null;
  const activeThreadId = activeTab?.threadId ?? null;
  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId);
  const { data: schedules } = useSchedules(activeWorkspaceId ?? undefined);
  const activeScheduleCount = useMemo(
    () => schedules?.filter((s) => s.enabled).length ?? 0,
    [schedules],
  );

  // Filter threads for the active workspace and sort by most recent
  const filteredThreads = useMemo(() => {
    if (!threads || !Array.isArray(threads) || !activeWorkspaceId) return [];
    return threads
      .filter((t) => (t.workspaceId || DEFAULT_WORKSPACE_ID) === activeWorkspaceId)
      .map((t) => ({
        threadId: t.threadId,
        title: t.title || "New Thread",
        status: mapRunningToStatus(t.running),
        lastActivityAt: t.lastActivityAt,
      }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [threads, activeWorkspaceId]);

  const handleCreateThread = () => {
    if (!activeWorkspaceId) return;
    const newThreadId = crypto.randomUUID();
    navigate(`/${activeWorkspaceId}/${newThreadId}?new=true`);
  };

  return (
    <Sidebar side="left" collapsible="offcanvas" className="border-r border-border">
      {/* Header — h-[52px] matches macOS traffic lights, pl-[90px] clears them */}
      <SidebarHeader className="drag-region h-[52px] flex-row items-center justify-between px-4 py-0 pl-[90px]">
        <span className="font-semibold text-sm truncate">
          {activeWorkspace?.name ?? "Workspace"}
        </span>
        <div className="no-drag flex items-center gap-1">
          <button
            aria-label="Notifications"
            className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
          >
            <BellIcon className="size-4" />
          </button>
        </div>
      </SidebarHeader>

      {/* Content — section links + thread list */}
      <SidebarContent>
        {/* Workspace section links */}
        <SidebarGroup className="pb-0">
          <SidebarMenu>
            {WORKSPACE_SECTIONS.map((section) => {
              const sectionPath = `/${activeWorkspaceId}/${section.path}`;
              const isSectionActive = pathname.startsWith(sectionPath);
              const badge =
                section.path === "schedules" && activeScheduleCount > 0
                  ? activeScheduleCount
                  : null;

              return (
                <SidebarMenuItem key={section.path}>
                  <SidebarMenuButton
                    size="sm"
                    isActive={isSectionActive}
                    onClick={() => navigate(sectionPath)}
                    className="h-7 gap-2 px-2 text-xs"
                  >
                    <section.icon className="size-3.5 shrink-0" />
                    <span className="flex-1">{section.label}</span>
                    {badge != null && (
                      <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] font-medium tabular-nums text-success-foreground">
                        {badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Threads */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Threads
          </SidebarGroupLabel>
          <SidebarMenu>
            {/* New Thread button */}
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                onClick={handleCreateThread}
                className="gap-2 px-2 py-1.5 text-muted-foreground hover:text-foreground"
              >
                <PlusIcon className="size-3.5 shrink-0" />
                <span className="text-xs font-medium">New Thread</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Thread list */}
            {filteredThreads.map((thread) => {
              const isActive = thread.threadId === activeThreadId;
              const label = statusLabel(thread.status);

              return (
                <SidebarMenuItem key={thread.threadId}>
                  <SidebarMenuButton
                    size="sm"
                    isActive={isActive}
                    onClick={() => navigate(`/${activeWorkspaceId}/${thread.threadId}`)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    {label ? (
                      <span
                        className={cn(
                          "text-[10px] font-medium shrink-0",
                          thread.status === "working" &&
                            "text-info-foreground animate-pulse",
                          thread.status === "awaiting-input" &&
                            "text-primary",
                          thread.status === "error" &&
                            "text-destructive-foreground"
                        )}
                      >
                        {label}
                      </span>
                    ) : (
                      <MessageSquareIcon className="size-3 shrink-0 text-muted-foreground/60" />
                    )}

                    <span className="flex-1 truncate min-w-0">
                      {thread.title}
                    </span>

                    <span
                      className={cn(
                        "text-[10px] shrink-0 tabular-nums",
                        isActive
                          ? "text-foreground/70"
                          : "text-muted-foreground/60"
                      )}
                    >
                      {formatTimeAgo(thread.lastActivityAt)}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            {/* Empty state */}
            {filteredThreads.length === 0 && activeWorkspaceId && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No threads yet. Start a new one.
                </p>
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter />
    </Sidebar>
  );
}
