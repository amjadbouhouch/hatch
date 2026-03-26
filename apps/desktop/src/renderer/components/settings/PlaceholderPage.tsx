import { ChatHeader } from "../layout/ChatHeader";
import {
  SparklesIcon,
  CalendarClockIcon,
  BookOpenIcon,
} from "lucide-react";

const SECTION_META: Record<string, { icon: typeof SparklesIcon; title: string; subtitle: string; emptyTitle: string; emptySubtitle: string }> = {
  Skills: {
    icon: SparklesIcon,
    title: "Skills",
    subtitle: "Manage workspace skills — custom capabilities and tools.",
    emptyTitle: "No skills yet",
    emptySubtitle: "Browse and install skills from the marketplace.",
  },
  Schedules: {
    icon: CalendarClockIcon,
    title: "Schedules",
    subtitle: "Heartbeats, daily logs, and recurring agent tasks.",
    emptyTitle: "No schedules yet",
    emptySubtitle: "Ask your agent in a thread to create one.",
  },
  Knowledge: {
    icon: BookOpenIcon,
    title: "Knowledge",
    subtitle: "Knowledge bases, documents, and RAG sources.",
    emptyTitle: "No knowledge sources yet",
    emptySubtitle: "Ask your agent in a thread to add documents or RAG sources.",
  },
};

export function WorkspacePlaceholderPage({ section }: { section: string }) {
  const meta = SECTION_META[section] ?? {
    icon: SparklesIcon,
    title: section,
    subtitle: "This section is not yet available.",
    emptyTitle: "Nothing here yet",
    emptySubtitle: "This feature is coming soon.",
  };
  const Icon = meta.icon;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
          <div className="pt-6 pb-6 md:pt-10">
            <h1 className="text-lg font-semibold text-foreground">
              {meta.title}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-24">
            <Icon className="size-10 text-muted-foreground/15 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {meta.emptyTitle}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {meta.emptySubtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
