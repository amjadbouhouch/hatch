import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChatHeader } from "../layout/ChatHeader";
import {
  SearchIcon,
  SparklesIcon,
  DownloadIcon,
  Loader2Icon,
  PackageOpenIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  useBrowseSkills,
  useSkillSources,
  useSkillContent,
  useInstalledSkills,
  useInstalledSkillContent,
  useInstallSkill,
  useUninstallSkill,
  type BrowseSkill,
  type InstalledSkill,
} from "../../hooks/use-skills.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// ─── Component ──────────────────────────────────────────────────────────────

type Tab = "browse" | "installed";

export function SkillsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();
  const [source, setSource] = useState("");
  const [previewSkill, setPreviewSkill] = useState<BrowseSkill | null>(null);
  const [previewInstalled, setPreviewInstalled] = useState<InstalledSkill | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const browse = useBrowseSkills(debouncedSearch, source);
  const sources = useSkillSources();
  const installed = useInstalledSkills(workspaceId);
  const installSkill = useInstallSkill();
  const uninstallSkill = useUninstallSkill();

  const installedNames = useMemo(
    () => new Set(installed.data?.map((s) => s.name) ?? []),
    [installed.data],
  );

  const installedCount = installed.data?.length ?? 0;

  const browseSkills = useMemo(
    () => browse.data?.pages.flatMap((p) => p.skills ?? []).filter(Boolean) ?? [],
    [browse.data],
  );

  const totalCount = browse.data?.pages[0]?.total ?? 0;

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      setDebounceTimer(setTimeout(() => setDebouncedSearch(value), 300));
    },
    [debounceTimer],
  );

  const handleInstall = useCallback(
    (skill: BrowseSkill) => {
      if (!workspaceId) return;
      installSkill.mutate({
        workspaceId,
        skillId: skill.skillId,
        owner: skill.owner,
        repo: skill.repo,
      });
    },
    [workspaceId, installSkill],
  );

  const handleUninstall = useCallback(
    (skillId: string) => {
      if (!workspaceId) return;
      uninstallSkill.mutate({ workspaceId, skillId });
    },
    [workspaceId, uninstallSkill],
  );

  // Infinite scroll
  useEffect(() => {
    if (tab !== "browse" || browse.isLoading) return;
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && browse.hasNextPage && !browse.isFetchingNextPage) {
          browse.fetchNextPage();
        }
      },
      { root, rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, browse.isLoading, browse.hasNextPage, browse.isFetchingNextPage, browse.fetchNextPage]);

  const isLoading = tab === "browse" ? browse.isLoading : installed.isLoading;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-1">
            <TabButton active={tab === "browse"} onClick={() => { setTab("browse"); setSearch(""); setDebouncedSearch(""); }}>
              Browse
              {totalCount > 0 && tab === "browse" && (
                <span className="ml-1.5 text-[10px] text-muted-foreground/50 tabular-nums">
                  {totalCount.toLocaleString()}
                </span>
              )}
            </TabButton>
            <TabButton active={tab === "installed"} onClick={() => { setTab("installed"); setSearch(""); setDebouncedSearch(""); }}>
              Installed
              {installedCount > 0 && (
                <Badge
                  variant={tab === "installed" ? "default" : "secondary"}
                  className="ml-1.5 h-4 min-w-[18px] px-1 text-[10px]"
                >
                  {installedCount}
                </Badge>
              )}
            </TabButton>
          </div>

          {tab === "browse" && (
            <div className="flex items-center gap-2">
              <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : v)}>
                <SelectTrigger size="sm" className="h-8 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {(sources.data?.sources ?? []).map((s) => (
                    <SelectItem key={s.source} value={s.source}>
                      <span className="truncate">{s.source}</span>
                      <span className="ml-1.5 text-muted-foreground/50 tabular-nums">{s.skillCount}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative w-[220px]">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search skills..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkillCardSkeleton key={i} />
              ))}
            </div>
          ) : tab === "browse" ? (
            browseSkills.length === 0 ? (
              <EmptyState message={debouncedSearch ? "No skills found." : "Could not load skills."} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {browseSkills.map((skill, idx) => (
                    <SkillCard
                      key={`${skill.skillId}-${idx}`}
                      name={skill.displayName}
                      source={skill.source}
                      installs={skill.installs}
                      installed={installedNames.has(skill.name)}
                      onClick={() => setPreviewSkill(skill)}
                    />
                  ))}

                  {browse.isFetchingNextPage &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <SkillCardSkeleton key={`more-${i}`} />
                    ))}
                </div>
                <div ref={sentinelRef} className="h-1" />
              </>
            )
          ) : (installed.data?.length ?? 0) === 0 ? (
            <EmptyState message="No skills installed yet." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {installed.data!.map((skill) => {
                const busy = uninstallSkill.isPending && uninstallSkill.variables?.skillId === skill.name;
                return (
                  <div
                    key={skill.name}
                    className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setPreviewInstalled(skill)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreviewInstalled(skill); } }}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
                      <SparklesIcon className="size-4 text-muted-foreground/60" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground truncate block">
                        {skill.displayName || skill.name}
                      </span>
                      {skill.description && (
                        <p className="text-[10px] text-muted-foreground/50 truncate">{skill.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleUninstall(skill.name); }}
                      disabled={busy}
                      className="shrink-0 h-7 text-[11px] text-destructive-foreground border-destructive/30 hover:bg-destructive/5"
                    >
                      {busy ? <Loader2Icon className="size-3 animate-spin" /> : "Uninstall"}
                    </Button>
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/30" aria-hidden="true" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview sheet — browse */}
      <SkillPreviewSheet
        skill={previewSkill}
        open={!!previewSkill}
        onOpenChange={(open) => { if (!open) setPreviewSkill(null); }}
        installed={previewSkill ? installedNames.has(previewSkill.name) : false}
        busy={
          (installSkill.isPending && installSkill.variables?.skillId === previewSkill?.skillId) ||
          (uninstallSkill.isPending && uninstallSkill.variables?.skillId === previewSkill?.skillId)
        }
        onInstall={() => previewSkill && handleInstall(previewSkill)}
        onUninstall={() => previewSkill && handleUninstall(previewSkill.skillId)}
      />

      {/* Preview sheet — installed */}
      <InstalledSkillPreviewSheet
        skill={previewInstalled}
        open={!!previewInstalled}
        onOpenChange={(open) => { if (!open) setPreviewInstalled(null); }}
        workspaceId={workspaceId}
        busy={uninstallSkill.isPending && uninstallSkill.variables?.skillId === previewInstalled?.name}
        onUninstall={() => {
          if (previewInstalled) {
            handleUninstall(previewInstalled.name);
            setPreviewInstalled(null);
          }
        }}
      />
    </div>
  );
}

// ─── Preview Sheet ──────────────────────────────────────────────────────────

function SkillPreviewSheet({
  skill,
  open,
  onOpenChange,
  installed,
  busy,
  onInstall,
  onUninstall,
}: {
  skill: BrowseSkill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installed: boolean;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const content = useSkillContent(
    skill?.owner ?? "",
    skill?.repo ?? "",
    skill?.skillId ?? "",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent style={{ maxWidth: "42rem" }} className="flex flex-col overflow-hidden pt-10 px-6">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-sm">{skill?.displayName}</SheetTitle>
          <SheetDescription className="flex items-center gap-3 text-[11px]">
            <span className="font-mono">{skill?.source}</span>
            {skill?.installs != null && skill.installs > 0 && (
              <span className="flex items-center gap-0.5 tabular-nums">
                <DownloadIcon className="size-2.5" aria-hidden="true" />
                {formatCount(skill.installs)}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 pb-3 border-b border-border">
          {installed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUninstall}
              disabled={busy}
              className="h-7 text-[11px] text-destructive-foreground border-destructive/30 hover:bg-destructive/5"
            >
              {busy ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : null}
              Uninstall
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onInstall}
              disabled={busy}
              className="h-7 text-[11px]"
            >
              {busy ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : null}
              Install
            </Button>
          )}
          {skill?.githubUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 text-muted-foreground"
              asChild
            >
              <a href={skill.githubUrl} target="_blank" rel="noopener noreferrer">
                GitHub
                <ExternalLinkIcon className="size-2.5" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {content.isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-4 w-1/2 mt-4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : content.isError ? (
            <p className="text-xs text-muted-foreground py-4">
              Could not load skill content.
            </p>
          ) : (
            <div className="chat-markdown text-xs leading-relaxed py-2">
              {content.data?.metadata?.description && (
                <p className="text-muted-foreground mb-4">
                  {content.data.metadata.description}
                </p>
              )}
              <pre className="whitespace-pre-wrap break-words text-[11px]">
                {content.data?.instructions}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Installed Preview Sheet ─────────────────────────────────────────────────

function InstalledSkillPreviewSheet({
  skill,
  open,
  onOpenChange,
  workspaceId,
  busy,
  onUninstall,
}: {
  skill: InstalledSkill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  busy: boolean;
  onUninstall: () => void;
}) {
  const content = useInstalledSkillContent(
    workspaceId,
    skill?.name ?? null,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent style={{ maxWidth: "42rem" }} className="flex flex-col overflow-hidden pt-10 px-6">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-sm">{skill?.displayName || skill?.name}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {skill?.description || "Installed skill"}
          </SheetDescription>
        </SheetHeader>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 pb-3 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onUninstall}
            disabled={busy}
            className="h-7 text-[11px] text-destructive-foreground border-destructive/30 hover:bg-destructive/5"
          >
            {busy ? <Loader2Icon className="size-3 animate-spin mr-1.5" /> : null}
            Uninstall
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {content.isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-4 w-1/2 mt-4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : content.isError ? (
            <p className="text-xs text-muted-foreground py-4">
              Could not load skill content.
            </p>
          ) : (
            <div className="chat-markdown text-xs leading-relaxed py-2">
              {content.data?.metadata?.description && (
                <p className="text-muted-foreground mb-4">
                  {content.data.metadata.description}
                </p>
              )}
              <pre className="whitespace-pre-wrap break-words text-[11px]">
                {content.data?.instructions}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SkillCard({
  name,
  source,
  installs,
  installed,
  onClick,
}: {
  name: string;
  source?: string;
  installs?: number;
  installed: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/50">
        <SparklesIcon className="size-4 text-muted-foreground/60" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-foreground truncate block">
          {name}
        </span>
        <div className="flex items-center gap-3 mt-0.5">
          {source && (
            <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
              {source}
            </span>
          )}
          {installs != null && installs > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
              <DownloadIcon className="size-2.5" aria-hidden="true" />
              {formatCount(installs)}
            </span>
          )}
        </div>
      </div>

      {installed && (
        <Badge variant="secondary" className="text-[10px] shrink-0">
          Installed
        </Badge>
      )}

      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/30" aria-hidden="true" />
    </div>
  );
}

function SkillCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <Skeleton className="size-9 rounded-md shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-36" />
      </div>
      <Skeleton className="h-7 w-16 rounded-md shrink-0" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <PackageOpenIcon className="size-10 text-muted-foreground/20 mb-3" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
