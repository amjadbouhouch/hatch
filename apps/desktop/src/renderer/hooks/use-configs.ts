import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import { toast } from 'sonner';
import type {
  ModelConfig,
  SaveModelConfigInput,
  VisionConfig,
  SaveVisionConfigInput,
  EmbeddingConfig,
  SaveEmbeddingConfigInput,
} from '../client/api-types.js';

// Re-export for consumers
export type { ModelConfig, VisionConfig, EmbeddingConfig };

// ─── Workspace ──────────────────────────────────────────────────────────────

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspace', workspaceId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.workspaces[':workspaceId'].$get({ param: { workspaceId: workspaceId! } });
      if (!res.ok) throw new Error('Workspace not found');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId: string; name?: string; agentName?: string; description?: string | null }) => {
      const { workspaceId, ...data } = params;
      const api = await getClient();
      const res = await api.workspaces[':workspaceId'].$patch({ param: { workspaceId }, json: data });
      if (!res.ok) throw new Error('Failed to update workspace');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['workspace', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace settings saved');
    },
    onError: () => toast.error('Failed to save workspace settings'),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const api = await getClient();
      const res = await api.workspaces[':workspaceId'].$delete({ param: { workspaceId } });
      if (!res.ok) throw new Error('Failed to delete workspace');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace deleted');
    },
    onError: () => toast.error('Failed to delete workspace'),
  });
}

// ─── Model Config ───────────────────────────────────────────────────────────

export function useModelConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['configs', 'model', workspaceId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.configs.model[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<ModelConfig>;
    },
    enabled: !!workspaceId,
  });
}

export function useSaveModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: SaveModelConfigInput) => {
      const api = await getClient();
      const res = await api.configs.model.$put({ json: params });
      if (!res.ok) throw new Error('Failed to save model config');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['configs', 'model', vars.workspaceId] });
      toast.success('Model settings saved');
    },
    onError: () => {
      toast.error('Failed to save model settings');
    },
  });
}

// ─── Vision Config ──────────────────────────────────────────────────────────

export function useVisionConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['configs', 'vision', workspaceId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.configs.vision[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<VisionConfig>;
    },
    enabled: !!workspaceId,
  });
}

export function useSaveVisionConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: SaveVisionConfigInput) => {
      const api = await getClient();
      const res = await api.configs.vision.$put({ json: params });
      if (!res.ok) throw new Error('Failed to save vision config');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['configs', 'vision', vars.workspaceId] });
      toast.success('Vision settings saved');
    },
    onError: () => {
      toast.error('Failed to save vision settings');
    },
  });
}

// ─── Embedding Config ───────────────────────────────────────────────────────

export function useEmbeddingConfig(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['configs', 'embedding', workspaceId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.configs.embedding[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<EmbeddingConfig>;
    },
    enabled: !!workspaceId,
  });
}

export function useSaveEmbeddingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: SaveEmbeddingConfigInput) => {
      const api = await getClient();
      const res = await api.configs.embedding.$put({ json: params });
      if (!res.ok) throw new Error('Failed to save embedding config');
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['configs', 'embedding', vars.workspaceId] });
      toast.success('Embedding settings saved');
    },
    onError: () => {
      toast.error('Failed to save embedding settings');
    },
  });
}
