import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TreeItem = {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: string[];
};

export type KnowledgeTree = {
  items: Record<string, TreeItem>;
  rootId: string;
};

export type UploadFile = {
  name: string;
  content: string; // base64
  path: string;
};

export type UploadResult = {
  name: string;
  path: string;
  size: number;
  ok: boolean;
  error?: string;
};

export type FilePreview = {
  name: string;
  path: string;
  size: number;
  content: string | null;
  message?: string;
};

// ─── Fetch tree ─────────────────────────────────────────────────────────────

export function useKnowledgeTree(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-tree', workspaceId],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].tree.$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<KnowledgeTree>;
    },
    enabled: !!workspaceId,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
}

// ─── Fetch file preview ─────────────────────────────────────────────────────

export function useFilePreview(workspaceId: string | undefined, filePath: string | null) {
  return useQuery({
    queryKey: ['knowledge-file', workspaceId, filePath],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].file[':path{.+}'].$get({
        param: { workspaceId: workspaceId!, path: filePath! },
      });
      return res.json() as Promise<FilePreview>;
    },
    enabled: !!workspaceId && !!filePath,
    staleTime: 30_000,
  });
}

// ─── Upload files ───────────────────────────────────────────────────────────

export function useUploadKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId: string; files: UploadFile[] }) => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].upload.$post({
        param: { workspaceId: params.workspaceId },
        json: { files: params.files },
      });
      return res.json() as Promise<{ results: UploadResult[] }>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge-tree', vars.workspaceId] });
    },
  });
}

// ─── Create folder ──────────────────────────────────────────────────────────

export function useCreateKnowledgeFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId: string; path: string }) => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].mkdir.$post({
        param: { workspaceId: params.workspaceId },
        json: { path: params.path },
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge-tree', vars.workspaceId] });
    },
  });
}

// ─── Delete file/folder ─────────────────────────────────────────────────────

export function useDeleteKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId: string; path: string }) => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].delete.$post({
        param: { workspaceId: params.workspaceId },
        json: { path: params.path },
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge-tree', vars.workspaceId] });
    },
  });
}

// ─── Move / rename ──────────────────────────────────────────────────────────

export function useMoveKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId: string; from: string; to: string }) => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].move.$post({
        param: { workspaceId: params.workspaceId },
        json: { from: params.from, to: params.to },
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['knowledge-tree', vars.workspaceId] });
    },
  });
}

