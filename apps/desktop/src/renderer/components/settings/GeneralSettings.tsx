import { useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { CopyIcon } from "lucide-react";

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK = {
  name: "My Coder Workspace",
  agentName: "hatch-coder",
  description: "Code reviewer, debugger, and task planner for daily dev work.",
  template: "coder" as const,
  createdAt: "2026-03-20T14:30:00Z",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function GeneralSettings() {
  const [name, setName] = useState(MOCK.name);
  const [agentName, setAgentName] = useState(MOCK.agentName);
  const [description, setDescription] = useState(MOCK.description);

  const id = useId();
  const nameId = `${id}-name`;
  const agentId = `${id}-agent`;
  const descId = `${id}-desc`;

  const isDirty =
    name !== MOCK.name ||
    agentName !== MOCK.agentName ||
    description !== MOCK.description;

  return (
    <div className="space-y-8">
      {/* Workspace form */}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          // TODO: persist settings
        }}
      >
        <Field label="Name" htmlFor={nameId}>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Agent name" htmlFor={agentId} hint="Identifier used in API calls and logs.">
          <Input
            id={agentId}
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </Field>

        <Field label="Description" htmlFor={descId}>
          <Textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <CopyIcon className="size-3" aria-hidden="true" />
            Duplicate workspace
          </Button>
          <Button type="submit" size="sm" disabled={!isDirty}>
            Save
          </Button>
        </div>
      </form>

      <hr className="border-border" />

      {/* Read-only info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Template</span>
          <div>
            <Badge variant="secondary" className="text-[11px]">
              {MOCK.template}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Created</span>
          <p className="text-xs text-muted-foreground">
            {new Date(MOCK.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <hr className="border-border" />

      {/* Danger zone */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-destructive-foreground">Danger zone</p>

        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive-foreground border-destructive/30 hover:bg-destructive/5"
              >
                Delete workspace
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Delete workspace</DialogTitle>
                <DialogDescription>
                  This will permanently delete{" "}
                  <span className="font-medium text-foreground">{name}</span>{" "}
                  and all its threads. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive-foreground border-destructive/30 hover:bg-destructive/5"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

// ─── Field ──────────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}
