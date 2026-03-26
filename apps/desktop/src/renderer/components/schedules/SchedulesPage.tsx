import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatHeader } from "../layout/ChatHeader";
import {
  CalendarClockIcon,
  ChevronRightIcon,
  PlayIcon,
  Trash2Icon,
  LoaderIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSchedules,
  useToggleSchedule,
  useDeleteSchedule,
  type Schedule,
} from "@/hooks/use-schedules";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNextRun(nextRunAt: string | null, enabled: boolean): string {
  if (!enabled) return "Paused";
  if (!nextRunAt) return "—";
  const date = new Date(nextRunAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) return "Overdue";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SchedulesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  const { data: schedules, isLoading } = useSchedules(workspaceId);
  const toggleSchedule = useToggleSchedule();
  const deleteSchedule = useDeleteSchedule();

  const toggleOpen = (id: string) =>
    setOpenId((prev) => (prev === id ? null : id));

  const handleToggleEnabled = useCallback(
    (schedule: Schedule) => {
      if (!workspaceId) return;
      toggleSchedule.mutate({
        workspaceId,
        scheduleId: schedule.id,
        enabled: !schedule.enabled,
      });
    },
    [workspaceId, toggleSchedule],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!workspaceId || !deleteTarget) return;
    deleteSchedule.mutate(
      { workspaceId, scheduleId: deleteTarget.id },
      { onSettled: () => setDeleteTarget(null) },
    );
  }, [workspaceId, deleteTarget, deleteSchedule]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
          {/* Page header */}
          <div className="pt-6 pb-6 md:pt-10">
            <h1 className="text-lg font-semibold text-foreground">
              Schedules
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ask your agent in a thread to create, edit, or remove schedules.
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <LoaderIcon className="size-5 animate-spin text-muted-foreground/40" />
            </div>
          )}

          {/* Schedule list */}
          {!isLoading && schedules && schedules.length > 0 && (
            <div className="space-y-2 pb-12">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  isOpen={openId === schedule.id}
                  onToggleOpen={() => toggleOpen(schedule.id)}
                  onToggleEnabled={() => handleToggleEnabled(schedule)}
                  onDelete={() => setDeleteTarget(schedule)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && schedules && schedules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <CalendarClockIcon className="size-10 text-muted-foreground/15 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                No schedules yet
              </p>
              <p className="text-xs text-muted-foreground/60">
                Ask your agent in a thread to create one.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSchedule.isPending}
            >
              {deleteSchedule.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Schedule Card ──────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  isOpen,
  onToggleOpen,
  onToggleEnabled,
  onDelete,
}: {
  schedule: Schedule;
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}) {
  const nextRun = formatNextRun(schedule.nextRunAt, schedule.enabled);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isOpen ? "border-border bg-card" : "border-border/60",
      )}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:rounded-lg"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/40 transition-transform duration-150",
            isOpen && "rotate-90",
          )}
        />

        <div
          className={cn(
            "size-1.5 rounded-full shrink-0",
            schedule.enabled
              ? "bg-emerald-500 dark:bg-emerald-400"
              : "bg-muted-foreground/30",
          )}
        />

        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-sm font-medium truncate block",
              schedule.enabled ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {schedule.name}
          </span>
          <span className="text-[11px] text-muted-foreground/60 block mt-0.5">
            {schedule.humanReadable}
            <span className="mx-1.5">·</span>
            <span
              className={cn(
                "tabular-nums",
                !schedule.enabled && "text-muted-foreground/40",
                nextRun === "Overdue" && "text-amber-500 dark:text-amber-400",
              )}
            >
              {nextRun}
            </span>
          </span>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Switch
            checked={schedule.enabled}
            onCheckedChange={onToggleEnabled}
            aria-label={`${schedule.enabled ? "Disable" : "Enable"} ${schedule.name}`}
          />
        </div>
      </button>

      {/* Expanded detail */}
      {isOpen && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3 animate-in fade-in-0 duration-150">
          {schedule.description && (
            <p className="text-xs text-muted-foreground">
              {schedule.description}
            </p>
          )}

          <div className="rounded-md border border-border/40 bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-2">
              Prompt
            </p>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {schedule.prompt}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground/40">
              {schedule.timezone} · Created {formatDate(schedule.createdAt)}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
              >
                <PlayIcon className="size-3" />
                Run now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-destructive-foreground hover:bg-destructive/5"
                onClick={onDelete}
              >
                <Trash2Icon className="size-3" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
