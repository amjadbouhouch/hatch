import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import type {
  WorkspaceList,
  Workspace,
  CreateWorkspaceInput,
  CreateWorkspaceResponse,
} from '../client/api-types.js';

export type { WorkspaceList, Workspace };

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
