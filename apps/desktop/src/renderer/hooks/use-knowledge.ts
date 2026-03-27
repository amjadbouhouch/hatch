import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import type {
  KnowledgeTree,
  FilePreview,
  UploadResponse,
  UploadResult,
} from '../client/api-types.js';

export type { KnowledgeTree, FilePreview, UploadResult };

// ─── Fetch tree ─────────────────────────────────────────────────────────────

export function useKnowledgeTree(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-tree', workspaceId] as const,
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
    queryKey: ['knowledge-file', workspaceId, filePath] as const,
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
    mutationFn: async (params: { workspaceId: string; files: { name: string; content: string; path: string }[] }) => {
      const api = await getClient();
      const res = await api.knowledge[':workspaceId'].upload.$post({
        param: { workspaceId: params.workspaceId },
        json: { files: params.files },
      });
      return res.json() as Promise<UploadResponse>;
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
