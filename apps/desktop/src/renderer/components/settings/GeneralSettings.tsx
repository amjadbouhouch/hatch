import { useState, useEffect, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { LoaderIcon, FolderOpenIcon } from "lucide-react";
import { useWorkspace, useUpdateWorkspace, useDeleteWorkspace } from "../../hooks/use-configs.js";

// ─── Component ──────────────────────────────────────────────────────────────

export function GeneralSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const { mutate: update, isPending: isSaving } = useUpdateWorkspace();
  const { mutate: deleteWs, isPending: isDeleting } = useDeleteWorkspace();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [loaded, setLoaded] = useState(false);

  const id = useId();

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name ?? "");
    setDescription(workspace.description ?? "");
    setProjectPath((workspace as any).projectPath ?? "");
    setLoaded(true);
  }, [workspace]);

  const isDirty =
    loaded && (
      name !== (workspace?.name ?? "") ||
      description !== (workspace?.description ?? "") ||
      projectPath !== ((workspace as any)?.projectPath ?? "")
    );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    update({
      workspaceId,
      name: name || undefined,
      description: description || null,
      projectPath: projectPath || null,
    } as any);
  }

  async function handleBrowseFolder() {
    const result = await (window as any).hatchAPI?.selectFolder?.();
    if (result) setProjectPath(result);
  }

  function handleDelete() {
    if (!workspaceId) return;
    deleteWs(workspaceId, { onSuccess: () => navigate("/") });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <Field label="Name" htmlFor={`${id}-name`}>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Description" htmlFor={`${id}-desc`}>
          <Textarea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="resize-none" />
        </Field>

        <Field label="Project Path" htmlFor={`${id}-project`} hint="Link a local project directory. The agent gets direct file access + command execution + LSP. Leave empty for Docker sandbox mode.">
          <div className="flex gap-2">
            <Input
              id={`${id}-project`}
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/Users/you/projects/my-app"
              className="flex-1"
            />
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={handleBrowseFolder}>
              <FolderOpenIcon className="size-4" />
            </Button>
          </div>
        </Field>

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" disabled={!isDirty || isSaving}>
            {isSaving ? <><LoaderIcon className="size-3 animate-spin" /> Saving…</> : "Save"}
          </Button>
        </div>
      </form>

      <hr className="border-border" />

      {workspace?.createdAt && (
        <>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">Created</span>
            <p className="text-xs text-muted-foreground">
              {new Date(workspace.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <hr className="border-border" />
        </>
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium text-destructive-foreground">Danger zone</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive-foreground border-destructive/30 hover:bg-destructive/5">
              Delete workspace
            </Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Delete workspace</DialogTitle>
              <DialogDescription>
                This will permanently delete <span className="font-medium text-foreground">{name}</span> and all its threads. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm">Cancel</Button>
              </DialogClose>
              <Button variant="outline" size="sm" className="text-destructive-foreground border-destructive/30 hover:bg-destructive/5" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <><LoaderIcon className="size-3 animate-spin" /> Deleting…</> : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Field ──────────────────────────────────────────────────────────────────

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
