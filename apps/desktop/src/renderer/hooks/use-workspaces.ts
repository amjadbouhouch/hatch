import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import type {
  WorkspaceTemplateList,
  WorkspaceTemplate,
  WorkspaceList,
  Workspace,
  WorkspaceModeList,
  WorkspaceMode,
  CreateWorkspaceInput,
  CreateWorkspaceResponse,
} from '../client/api-types.js';

export type { WorkspaceTemplateList, WorkspaceTemplate, WorkspaceList, Workspace, WorkspaceModeList, WorkspaceMode };

export function useWorkspaceTemplates() {
  return useQuery({
    queryKey: ['workspaces', 'templates'] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.workspaces.templates.$get();
      return res.json() as Promise<WorkspaceTemplateList>;
    },
    staleTime: Infinity,
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.workspaces.$get();
      return res.json() as Promise<WorkspaceList>;
    },
  });
}

export function useWorkspaceModes(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'modes'] as const,
    queryFn: async (): Promise<WorkspaceModeList> => {
      if (!workspaceId) return [];
      const api = await getClient();
      // Use direct fetch — Hono RPC types can't resolve sub-paths under param routes
      const res = await (api as any).workspaces[':workspaceId'].modes.$get({
        param: { workspaceId },
      });
      return res.json() as Promise<WorkspaceModeList>;
    },
    enabled: !!workspaceId,
    staleTime: Infinity,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateWorkspaceInput) => {
      const api = await getClient();
      const res = await api.workspaces.$post({ json: params });
      return res.json() as Promise<CreateWorkspaceResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
