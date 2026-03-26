import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.workspaces.$get();
      return res.json();
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; template?: 'blank' | 'coder' | 'marketing' }) => {
      const api = await getClient();
      const res = await api.workspaces.$post({ json: params });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
