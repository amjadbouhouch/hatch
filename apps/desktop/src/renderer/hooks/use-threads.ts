import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import type {
  ThreadList,
  ThreadStatus,
  CreateThreadInput,
  CreateThreadResponse,
  SendMessageInput,
  SendMessageResponse,
  AbortResponse,
} from '../client/api-types.js';

export type { ThreadList, ThreadStatus };

export function useThreads() {
  return useQuery({
    queryKey: ['threads'] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.threads.$get();
      return res.json() as Promise<ThreadList>;
    },
  });
}

export function useThreadStatus(threadId: string | undefined) {
  return useQuery({
    queryKey: ['threads', 'status', threadId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.status[':threadId'].$get({ param: { threadId: threadId! } });
      return res.json() as Promise<ThreadStatus>;
    },
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateThreadInput) => {
      const api = await getClient();
      const res = await api.threads.$post({ json: params });
      return res.json() as Promise<CreateThreadResponse>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threads'] }),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (params: SendMessageInput) => {
      const api = await getClient();
      const res = await api.send.$post({ json: params });
      return res.json() as Promise<SendMessageResponse>;
    },
  });
}

export function useAbortThread() {
  return useMutation({
    mutationFn: async (threadId: string) => {
      const api = await getClient();
      const res = await api.abort.$post({ json: { threadId } });
      return res.json() as Promise<AbortResponse>;
    },
  });
}
