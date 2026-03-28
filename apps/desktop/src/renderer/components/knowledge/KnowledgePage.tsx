import { useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
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
  FolderIcon,
  FolderPlusIcon,
  FileTextIcon,
  FileIcon,
  UploadIcon,
  DownloadIcon,
  Trash2Icon,
  LoaderIcon,
  ChevronRightIcon,
  FileJsonIcon,
  XIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useKnowledgeTree,
  useFilePreview,
  useUploadKnowledge,
  useCreateKnowledgeFolder,
  useDeleteKnowledge,
  type KnowledgeTree,
  type UploadFile,
  type UploadResult,
} from "@/hooks/use-knowledge";
import { getClient } from "@/client/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileIcon(name: string, isFolder: boolean) {
  if (isFolder) return FolderIcon;
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "txt":
      return FileTextIcon;
    case "json":
      return FileJsonIcon;
    default:
      return FileIcon;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix (data:...;base64,)
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const INDENT = 20;

// ─── File Tree (separate component so useTree only mounts with real data) ───

function FileTree({
  treeData,
  selectedItem,
  onSelectItem,
  onDeleteItem,
}: {
  treeData: KnowledgeTree;
  selectedItem: string | null;
  onSelectItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
}) {
  const treeItems = useMemo(() => {
    const result: Record<string, { name: string; children?: string[] }> = {};
    for (const [id, item] of Object.entries(treeData.items)) {
      result[id] = {
        name: item.name,
        ...(item.children ? { children: item.children } : {}),
      };
    }
    return result;
  }, [treeData]);

  const tree = useTree<{ name: string; children?: string[] }>({
    initialState: {
      expandedItems: ["workspace"],
    },
    indent: INDENT,
    rootItemId: "workspace",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => Array.isArray(item.getItemData()?.children),
    dataLoader: {
      getItem: (itemId) => treeItems[itemId],
      getChildren: (itemId) => treeItems[itemId]?.children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  const rootItem = tree.getItemInstance("workspace");
  const rootExpanded = rootItem?.isExpanded() ?? true;

  return (
    <div role="tree" className="py-1">
      {/* Root folder row — rendered manually since getItems() excludes it */}
      <button
        type="button"
        role="treeitem"
        aria-expanded={rootExpanded}
        aria-selected={selectedItem === "workspace"}
        onClick={() => {
          onSelectItem("workspace");
          if (rootExpanded) {
            rootItem?.collapse();
          } else {
            rootItem?.expand();
          }
        }}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          selectedItem === "workspace" && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: "12px" }}
      >
        <ChevronRightIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150",
            rootExpanded && "rotate-90",
          )}
        />
        <FolderIcon className="size-4 shrink-0 text-primary/70" />
        <span className="truncate flex-1">workspace/</span>
      </button>

      {/* Child items from headless-tree */}
      {tree.getItems().map((item) => {
        const id = item.getId();
        const data = treeData.items[id];
        if (!data) return null;

        const isFolder = item.isFolder();
        const isExpanded = item.isExpanded();
        const isSelected = selectedItem === id;
        const Icon = getFileIcon(data.name, isFolder);
        const depth = item.getItemMeta().level + 1;

        return (
          <button
            key={id}
            type="button"
            role="treeitem"
            aria-expanded={isFolder ? isExpanded : undefined}
            aria-selected={isSelected}
            onClick={() => {
              onSelectItem(id);
              if (isFolder) {
                if (isExpanded) {
                  item.collapse();
                } else {
                  item.expand();
                }
              }
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isSelected && "bg-accent text-accent-foreground",
            )}
            style={{ paddingLeft: `${12 + depth * INDENT}px` }}
          >
            {isFolder && (
              <ChevronRightIcon
                className={cn(
                  "size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150",
                  isExpanded && "rotate-90",
                )}
              />
            )}
            {!isFolder && <span className="w-3" />}
            <Icon
              className={cn(
                "size-4 shrink-0",
                isFolder
                  ? "text-primary/70"
                  : "text-muted-foreground/60",
              )}
            />
            <span className="truncate flex-1">{data.name}</span>
            {data.size != null && data.type === "file" && (
              <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
                {formatSize(data.size)}
              </span>
            )}
            {isSelected && id !== "SOUL.md" && id !== "IDENTITY.md" && !id.startsWith("memory/") && (
              <button
                type="button"
                aria-label="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(id);
                }}
                className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
              >
                <Trash2Icon className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Upload Dialog ──────────────────────────────────────────────────────────

type StagedFile = { file: File; id: string };
type FileStatus = "pending" | "uploading" | "done" | "error";

function UploadDialog({
  open,
  stagedFiles,
  targetFolder,
  workspaceId,
  onClose,
  onRemoveFile,
}: {
  open: boolean;
  stagedFiles: StagedFile[];
  targetFolder: string;
  workspaceId: string;
  onClose: () => void;
  onRemoveFile: (id: string) => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});
  const [results, setResults] = useState<UploadResult[]>([]);
  const uploadKnowledge = useUploadKnowledge();

  const isUploading = uploadKnowledge.isPending;
  const isDone = results.length > 0;

  const handleClose = useCallback(() => {
    setStatuses({});
    setResults([]);
    onClose();
  }, [onClose]);

  const handleConfirmUpload = useCallback(async () => {
    if (stagedFiles.length === 0) return;

    // Mark all as uploading
    const uploading: Record<string, FileStatus> = {};
    for (const sf of stagedFiles) uploading[sf.id] = "uploading";
    setStatuses(uploading);

    // Convert to base64
    const files: UploadFile[] = [];
    for (const sf of stagedFiles) {
      try {
        const content = await fileToBase64(sf.file);
        files.push({ name: sf.file.name, content, path: targetFolder });
      } catch {
        setStatuses((prev) => ({ ...prev, [sf.id]: "error" }));
      }
    }

    if (files.length === 0) return;

    uploadKnowledge.mutate(
      { workspaceId, files },
      {
        onSuccess: (data) => {
          setResults(data.results);
          const newStatuses: Record<string, FileStatus> = {};
          let allOk = true;
          for (const sf of stagedFiles) {
            const result = data.results.find((r) => r.name === sf.file.name);
            const ok = result?.ok ?? false;
            newStatuses[sf.id] = ok ? "done" : "error";
            if (!ok) allOk = false;
          }
          setStatuses(newStatuses);
          // Auto-close after a brief delay if all uploads succeeded
          if (allOk) {
            setTimeout(() => handleClose(), 800);
          }
        },
        onError: () => {
          const errStatuses: Record<string, FileStatus> = {};
          for (const sf of stagedFiles) errStatuses[sf.id] = "error";
          setStatuses(errStatuses);
        },
      },
    );
  }, [stagedFiles, targetFolder, workspaceId, uploadKnowledge, handleClose]);

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isUploading && handleClose()}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isDone ? "Upload Complete" : "Upload Files"}</DialogTitle>
          <DialogDescription>
            {isDone ? (
              <>
                {succeeded > 0 && <span>{succeeded} uploaded</span>}
                {succeeded > 0 && failed > 0 && <span> · </span>}
                {failed > 0 && <span className="text-destructive">{failed} failed</span>}
              </>
            ) : (
              <>
                {targetFolder
                  ? <>To <span className="font-mono text-foreground">workspace/{targetFolder}</span></>
                  : <>To <span className="font-mono text-foreground">workspace/</span></>
                }
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* File list */}
        <div className="max-h-[240px] overflow-y-auto -mx-1 px-1">
          <div className="space-y-1">
            {stagedFiles.map((sf) => {
              const status = statuses[sf.id] ?? "pending";
              const result = results.find((r) => r.name === sf.file.name);

              return (
                <div
                  key={sf.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                    status === "error" ? "bg-destructive/5" : "bg-muted/50",
                  )}
                >
                  {status === "pending" && (
                    <FileIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                  )}
                  {status === "uploading" && (
                    <LoaderIcon className="size-3.5 shrink-0 animate-spin text-primary" />
                  )}
                  {status === "done" && (
                    <CheckCircle2Icon className="size-3.5 shrink-0 text-success-foreground" />
                  )}
                  {status === "error" && (
                    <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
                  )}

                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm">{sf.file.name}</span>
                    {status === "error" && result?.error && (
                      <span className="block text-[11px] text-destructive mt-0.5">{result.error}</span>
                    )}
                  </div>

                  <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
                    {formatSize(sf.file.size)}
                  </span>

                  {status === "pending" && (
                    <button
                      type="button"
                      aria-label="Remove file"
                      onClick={() => onRemoveFile(sf.id)}
                      className="shrink-0 rounded p-0.5 hover:bg-foreground/10"
                    >
                      <XIcon className="size-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          {isDone ? (
            <Button onClick={handleClose}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmUpload}
                disabled={isUploading || stagedFiles.length === 0}
                className="gap-1.5"
              >
                {isUploading ? (
                  <>
                    <LoaderIcon className="size-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-3.5" />
                    Upload {stagedFiles.length} file{stagedFiles.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function KnowledgePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: treeData, isLoading, isFetching } = useKnowledgeTree(workspaceId);
  const createFolder = useCreateKnowledgeFolder();
  const deleteKnowledge = useDeleteKnowledge();
  // Get the currently selected folder path for uploads
  const getSelectedFolder = useCallback((): string => {
    if (!selectedItem || !treeData) return "";
    const item = treeData.items[selectedItem];
    if (!item) return "";
    if (item.type === "directory") return selectedItem === "workspace" ? "" : selectedItem;
    const lastSlash = selectedItem.lastIndexOf("/");
    return lastSlash > 0 ? selectedItem.slice(0, lastSlash) : "";
  }, [selectedItem, treeData]);

  // Stage files → open dialog
  const stageFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    }));
    if (files.length === 0) return;
    setStagedFiles(files);
    setShowUpload(true);
  }, []);

  const handleRemoveStagedFile = useCallback((id: string) => {
    setStagedFiles((prev) => {
      const next = prev.filter((sf) => sf.id !== id);
      if (next.length === 0) setShowUpload(false);
      return next;
    });
  }, []);

  const handleCloseUpload = useCallback(() => {
    setShowUpload(false);
    setStagedFiles([]);
  }, []);

  // Drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        stageFiles(e.dataTransfer.files);
      }
    },
    [stageFiles],
  );

  // Create folder
  const handleCreateFolder = useCallback(() => {
    if (!workspaceId || !newFolderName.trim()) return;
    const parentPath = getSelectedFolder();
    const folderPath = parentPath
      ? `${parentPath}/${newFolderName.trim()}`
      : newFolderName.trim();

    createFolder.mutate(
      { workspaceId, path: folderPath },
      {
        onSuccess: () => {
          toast.success(`Created folder: ${newFolderName.trim()}`);
          setNewFolderName("");
          setShowNewFolder(false);
        },
        onError: () => toast.error("Failed to create folder"),
      },
    );
  }, [workspaceId, newFolderName, getSelectedFolder, createFolder]);

  // Delete
  const handleConfirmDelete = useCallback(() => {
    if (!workspaceId || !deleteTarget) return;
    deleteKnowledge.mutate(
      { workspaceId, path: deleteTarget },
      {
        onSuccess: () => {
          toast.success("Deleted");
          setDeleteTarget(null);
          if (selectedItem === deleteTarget) setSelectedItem(null);
        },
        onError: () => toast.error("Failed to delete"),
      },
    );
  }, [workspaceId, deleteTarget, deleteKnowledge, selectedItem]);

  const selectedItemData = selectedItem && treeData ? treeData.items[selectedItem] : null;
  const isFileSelected = selectedItemData?.type === "file";
  const previewPath = isFileSelected ? selectedItem : null;
  const { data: preview, isLoading: isPreviewLoading } = useFilePreview(workspaceId, previewPath);

  const handleDownload = useCallback(async () => {
    if (!workspaceId || !selectedItem || !isFileSelected) return;
    try {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].download[':path{.+}'].$get({
        param: { workspaceId, path: selectedItem },
      });
      if (!res.ok) { toast.error("Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedItem.split("/").pop() ?? "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  }, [workspaceId, selectedItem, isFileSelected]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".md,.txt,.pdf,.json,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) stageFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Horizontal layout: tree left, detail right */}
      {!isLoading && treeData && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex flex-1 min-h-0 transition-colors",
            isDragging && "bg-primary/5",
          )}
        >
          {/* Left panel — file tree */}
          <div className="w-64 shrink-0 border-r border-border overflow-y-auto">
            {/* Tree toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                Files
                {isFetching && !isLoading && (
                  <LoaderIcon className="size-3 animate-spin text-muted-foreground" />
                )}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowNewFolder(true)}
                  aria-label="New folder"
                >
                  <FolderPlusIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload files"
                >
                  <UploadIcon className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Drop indicator */}
            {isDragging && (
              <div className="flex items-center justify-center py-2 border-b border-primary/20 bg-primary/5">
                <p className="text-xs text-primary font-medium">Drop to upload</p>
              </div>
            )}

            <FileTree
              treeData={treeData}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
              onDeleteItem={setDeleteTarget}
            />
          </div>

          {/* Right panel — detail + preview */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {selectedItemData && selectedItem !== "workspace" ? (
              <div className="flex flex-col h-full">
                {/* File info bar */}
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-border bg-muted/50 shrink-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 min-w-0">
                    <span className="shrink-0">{selectedItemData.type === "directory" ? "Folder" : "File"}</span>
                    {selectedItemData.size != null && (
                      <>
                        <span className="shrink-0">·</span>
                        <span className="shrink-0">{formatSize(selectedItemData.size)}</span>
                      </>
                    )}
                    <span className="shrink-0">·</span>
                    <span className="font-mono text-[10px] truncate">{selectedItem}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isFileSelected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1.5 text-[11px] shrink-0"
                        onClick={handleDownload}
                      >
                        <DownloadIcon className="size-3" />
                        Download
                      </Button>
                    )}
                    {selectedItem && selectedItem !== "SOUL.md" && selectedItem !== "IDENTITY.md" && !selectedItem.startsWith("memory/") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1.5 text-[11px] text-destructive-foreground hover:bg-destructive/5 shrink-0"
                        onClick={() => setDeleteTarget(selectedItem)}
                      >
                        <Trash2Icon className="size-3" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* File preview */}
                {isFileSelected && (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {isPreviewLoading && (
                      <div className="flex items-center justify-center py-12">
                        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!isPreviewLoading && preview?.content != null && (
                      <pre className="px-4 py-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words font-mono">
                        {preview.content}
                      </pre>
                    )}
                    {!isPreviewLoading && preview?.content == null && preview?.message && (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-xs text-muted-foreground">{preview.message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Folder selected — no preview */}
                {!isFileSelected && (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-xs text-muted-foreground">
                      {selectedItemData.type === "directory"
                        ? `${selectedItemData.children?.length ?? 0} items`
                        : "Select a file to preview"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 h-full items-center justify-center">
                <p className="text-xs text-muted-foreground">
                  Select a file to preview
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload dialog */}
      {workspaceId && (
        <UploadDialog
          open={showUpload}
          stagedFiles={stagedFiles}
          targetFolder={getSelectedFolder()}
          workspaceId={workspaceId}
          onClose={handleCloseUpload}
          onRemoveFile={handleRemoveStagedFile}
        />
      )}

      {/* New folder dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a folder inside{" "}
              <span className="font-mono text-foreground">
                workspace/{getSelectedFolder()}
              </span>
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            aria-label="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) handleCreateFolder();
            }}
            placeholder="Folder name..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
            >
              {createFolder.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground font-mono">
                {deleteTarget}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteKnowledge.isPending}
            >
              {deleteKnowledge.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
