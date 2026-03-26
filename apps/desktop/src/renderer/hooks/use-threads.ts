import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';

export function useThreads() {
  return useQuery({
    queryKey: ['threads'],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.threads.$get();
      return res.json();
    },
  });
}

export function useThreadStatus(threadId: string | undefined) {
  return useQuery({
    queryKey: ['threads', 'status', threadId],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.status[':threadId'].$get({ param: { threadId: threadId! } });
      return res.json();
    },
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId?: string; title?: string }) => {
      const api = await getClient();
      const res = await api.threads.$post({ json: params });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (params: { content: string; threadId?: string; workspaceId?: string }) => {
      const api = await getClient();
      const res = await api.send.$post({ json: params });
      return res.json();
    },
  });
}

export function useAbortThread() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const api = await getClient();
      const res = await api.abort.$post({ json: { threadId } });
      return res.json();
    },
  });
}
