import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CommandDialog,
  Command,
  CommandList,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  PlusIcon,
  FolderIcon,
  CodeIcon,
  MegaphoneIcon,
  FileIcon,
  ArrowLeftIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useUIStore, useActiveTab } from "../../stores/ui-store.js";
import { useWorkspaces, useCreateWorkspace, useWorkspaceTemplates } from "../../hooks/use-workspaces.js";
import type { WorkspaceTemplate } from "../../client/api-types.js";

const ICON_MAP: Record<string, typeof FileIcon> = {
  file: FileIcon,
  code: CodeIcon,
  megaphone: MegaphoneIcon,
  folder: FolderIcon,
};

// ─── Animation variants ─────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]; // quart

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { duration: 0.2, ease: EASE_OUT },
      opacity: { duration: 0.15 },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    transition: {
      x: { duration: 0.15, ease: EASE_OUT },
      opacity: { duration: 0.1 },
    },
  }),
};

// ─── Draggable Tab ──────────────────────────────────────────────────────────

function TabItem({
  tabId,
  label,
  index,
  isActive,
  onClick,
  onClose,
}: {
  tabId: string;
  label: string;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const { ref, isDragSource } = useSortable({ id: tabId, index });

  return (
    <div
      ref={ref}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "group/tab no-drag cursor-pointer rounded-md pl-2.5 pr-1.5 py-1 text-xs font-medium whitespace-nowrap select-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center gap-1",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        isDragSource && "opacity-50"
      )}
    >
      <span>{label}</span>
      <button
        aria-label="Close tab"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/tab:opacity-100 hover:bg-foreground/10"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

// ─── Palette step types ─────────────────────────────────────────────────────

type PaletteStep = "search" | "pick-template" | "confirm-name";
const STEP_ORDER: PaletteStep[] = ["search", "pick-template", "confirm-name"];
function stepIndex(step: PaletteStep): number {
  return STEP_ORDER.indexOf(step);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ChatHeader() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [step, setStep] = useState<PaletteStep>("search");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("blank");
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const directionRef = useRef(1);

  const { data: workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const { data: templates } = useWorkspaceTemplates();
  const createWorkspace = useCreateWorkspace();

  const tabs = useUIStore((s) => s.tabs);
  const activeTabId = useUIStore((s) => s.activeTabId);
  const addTab = useUIStore((s) => s.addTab);
  const removeTab = useUIStore((s) => s.removeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const reorderTabs = useUIStore((s) => s.reorderTabs);
  const activeTab = useActiveTab();

  // Cmd+K / Ctrl+K to open palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Build workspace name lookup
  const wsNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workspaces) {
      for (const ws of workspaces) map.set(ws.id, ws.name);
    }
    return map;
  }, [workspaces]);

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  // Navigate to a tab's content
  const navigateToTab = useCallback(
    (tabId: string, workspaceId: string, threadId: string | null) => {
      setActiveTab(tabId);
      if (threadId) {
        navigate(`/${workspaceId}/${threadId}`);
      } else {
        const newThreadId = crypto.randomUUID();
        navigate(`/${workspaceId}/${newThreadId}?new=true`);
      }
    },
    [setActiveTab, navigate]
  );

  // Open a workspace in a new tab
  const openInNewTab = useCallback(
    (workspaceId: string) => {
      addTab(workspaceId);
      const newThreadId = crypto.randomUUID();
      navigate(`/${workspaceId}/${newThreadId}?new=true`);
    },
    [addTab, navigate]
  );

  // ── Palette navigation ──

  const goTo = (nextStep: PaletteStep) => {
    directionRef.current = stepIndex(nextStep) > stepIndex(step) ? 1 : -1;
    setStep(nextStep);
  };

  const resetPalette = () => {
    setStep("search");
    setSelectedTemplate("blank");
    setNewName("");
    setCreateError(null);
    directionRef.current = 1;
  };

  const handleOpenPalette = () => {
    resetPalette();
    setPaletteOpen(true);
  };

  const handleSelectWorkspace = (wsId: string) => {
    setPaletteOpen(false);
    openInNewTab(wsId);
  };

  const handlePickTemplate = (tpl: WorkspaceTemplate) => {
    setSelectedTemplate(tpl.id);
    setNewName(tpl.id === 'blank' ? 'New Workspace' : `My ${tpl.name} Workspace`);
    goTo("confirm-name");
  };

  const handleCreateWorkspace = () => {
    const name = newName.trim();
    if (!name) return;
    if (workspaces?.some((ws) => ws.name.toLowerCase() === name.toLowerCase())) {
      setCreateError("A workspace with that name already exists");
      return;
    }
    setCreateError(null);
    createWorkspace.mutate(
      { name, template: selectedTemplate as "blank" | "coder" | "marketing" },
      {
        onSuccess: (data) => {
          setPaletteOpen(false);
          resetPalette();
          const result = data as { id: string };
          openInNewTab(result.id);
        },
        onError: () => {
          setCreateError("Failed to create workspace. Please try again.");
        },
      }
    );
  };

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Left side: trigger + tabs */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <SidebarTrigger className="no-drag size-7 shrink-0" />

          {tabs.length > 0 ? (
            <DragDropProvider
              onDragEnd={(event) => {
                if (event.canceled) return;
                const { source, target } = event.operation;
                if (source && target && source.id !== target.id) {
                  const newOrder = [...tabIds];
                  const fromIdx = newOrder.indexOf(source.id as string);
                  const toIdx = newOrder.indexOf(target.id as string);
                  if (fromIdx !== -1 && toIdx !== -1) {
                    newOrder.splice(fromIdx, 1);
                    newOrder.splice(toIdx, 0, source.id as string);
                    reorderTabs(newOrder);
                  }
                }
              }}
            >
              <nav
                aria-label="Workspaces"
                className="no-drag flex items-center gap-1 overflow-x-auto"
              >
                {tabs.map((tab, index) => (
                  <TabItem
                    key={tab.id}
                    tabId={tab.id}
                    label={wsNameMap.get(tab.workspaceId) ?? "Workspace"}
                    index={index}
                    isActive={tab.id === activeTabId}
                    onClick={() => navigateToTab(tab.id, tab.workspaceId, tab.threadId)}
                    onClose={() => removeTab(tab.id)}
                  />
                ))}
              </nav>
            </DragDropProvider>
          ) : isLoadingWorkspaces ? (
            <div className="flex items-center gap-1">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="no-drag size-7 shrink-0"
                onClick={handleOpenPalette}
              >
                <PlusIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New tab</TooltipContent>
          </Tooltip>
        </div>

      </div>

      {/* ── Command palette with animated steps ── */}
      <CommandDialog
        open={paletteOpen}
        onOpenChange={(open) => {
          setPaletteOpen(open);
          if (!open) resetPalette();
        }}
        title={
          step === "pick-template" ? "Pick a Template"
          : step === "confirm-name" ? "Name Your Workspace"
          : "Open Workspace"
        }
        description={
          step === "pick-template" ? "Choose a template to start from"
          : step === "confirm-name" ? "Edit the name and press Enter to create"
          : "Pick a workspace to open in a new tab"
        }
      >
        <Command className="overflow-hidden">
          <div className="relative">
            <AnimatePresence
              mode="popLayout"
              initial={false}
              custom={directionRef.current}
            >
              {/* ── Step 1: Search / pick workspace ── */}
              {step === "search" && (
                <motion.div
                  key="search"
                  custom={directionRef.current}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"

                >
                  <CommandInput placeholder="Search workspaces..." />
                  <CommandList>
                    <CommandEmpty>No workspaces found.</CommandEmpty>
                    {workspaces && workspaces.length > 0 && (
                      <CommandGroup heading="Workspaces">
                        {workspaces.map((ws) => (
                          <CommandItem
                            key={ws.id}
                            onSelect={() => handleSelectWorkspace(ws.id)}
                          >
                            <FolderIcon className="size-4 text-muted-foreground" />
                            <span>{ws.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {workspaces && workspaces.length > 0 && <CommandSeparator />}
                    <CommandGroup heading="Actions">
                      <CommandItem onSelect={() => goTo("pick-template")}>
                        <PlusIcon className="size-4 text-muted-foreground" />
                        <span>Create new workspace</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </motion.div>
              )}

              {/* ── Step 2: Pick template ── */}
              {step === "pick-template" && (
                <motion.div
                  key="pick-template"
                  custom={directionRef.current}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"

                >
                  <div className="flex items-center gap-2 border-b border-border px-3 h-10">
                    <button
                      onClick={() => goTo("search")}
                      aria-label="Go back"
                      className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <ArrowLeftIcon className="size-3.5" />
                    </button>
                    <span className="text-sm text-muted-foreground">Pick a template</span>
                  </div>
                  <CommandInput className="sr-only" aria-hidden tabIndex={-1} />
                  <CommandList>
                    <CommandGroup heading="Templates">
                      {(templates ?? []).map((t) => {
                        const Icon = ICON_MAP[t.icon] ?? FileIcon;
                        return (
                          <CommandItem
                            key={t.id}
                            onSelect={() => handlePickTemplate(t)}
                          >
                            <Icon className="size-4 text-muted-foreground" />
                            <div className="flex-1">
                              <span>{t.name}</span>
                              <p className="text-[11px] text-muted-foreground/60">{t.description}</p>
                            </div>
                            <div className="flex gap-1">
                              {t.modes.map((m) => (
                                <span key={m.modeId} className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                              ))}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </motion.div>
              )}

              {/* ── Step 3: Confirm name ── */}
              {step === "confirm-name" && (
                <motion.div
                  key="confirm-name"
                  custom={directionRef.current}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"

                >
                  <div className="p-1 pb-0">
                    <div className="flex items-center gap-2 rounded-lg border border-input/30 bg-input/30 px-2 h-8">
                      <button
                        onClick={() => goTo("pick-template")}
                        aria-label="Go back"
                        className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <ArrowLeftIcon className="size-3.5" />
                      </button>
                      <input
                        autoFocus
                        aria-label="Workspace name"
                        maxLength={100}
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value);
                          if (createError) setCreateError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" || e.key === "Tab") return;
                          e.stopPropagation();
                          if (e.key === "Enter" && newName.trim()) {
                            handleCreateWorkspace();
                          }
                        }}
                        disabled={createWorkspace.isPending}
                        placeholder="Workspace name..."
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <CommandList>
                    <div className="px-3 py-3 space-y-2">
                      {createError && (
                        <p role="alert" className="text-xs text-destructive">
                          {createError}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {(() => {
                          const tpl = templates?.find((t) => t.id === selectedTemplate);
                          const Icon = ICON_MAP[tpl?.icon ?? 'file'] ?? FileIcon;
                          return (
                            <>
                              <Icon className="size-3.5" />
                              <span>Using: {tpl?.name ?? selectedTemplate} template</span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {createWorkspace.isPending ? "Creating…" : "⏎ Enter to create"}
                      </div>
                    </div>
                  </CommandList>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
