import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Schedule = {
  id: string;
  name: string;
  description: string | null;
  humanReadable: string;
  timezone: string;
  prompt: string;
  enabled: boolean;
  nextRunAt: string | null;
  createdAt: string;
};

// ─── List schedules ─────────────────────────────────────────────────────────

export function useSchedules(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['schedules', workspaceId],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.schedules[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<Schedule[]>;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

// ─── Toggle enabled ─────────────────────────────────────────────────────────

export function useToggleSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      workspaceId: string;
      scheduleId: string;
      enabled: boolean;
    }) => {
      const api = await getClient();
      const res = await api.schedules.toggle.$post({
        json: params,
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules', vars.workspaceId] });
    },
  });
}

// ─── Delete schedule ────────────────────────────────────────────────────────

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { workspaceId: string; scheduleId: string }) => {
      const api = await getClient();
      const res = await api.schedules.delete.$post({
        json: params,
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules', vars.workspaceId] });
    },
  });
}
