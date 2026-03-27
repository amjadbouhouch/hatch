import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import type {
  ScheduleList,
  Schedule,
  ToggleScheduleInput,
  ToggleScheduleResponse,
  DeleteScheduleInput,
} from '../client/api-types.js';

export type { ScheduleList, Schedule };

// ─── List schedules ─────────────────────────────────────────────────────────

export function useSchedules(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['schedules', workspaceId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.schedules[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<ScheduleList>;
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
    mutationFn: async (params: ToggleScheduleInput) => {
      const api = await getClient();
      const res = await api.schedules.toggle.$post({ json: params });
      return res.json() as Promise<ToggleScheduleResponse>;
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
    mutationFn: async (params: DeleteScheduleInput) => {
      const api = await getClient();
      const res = await api.schedules.delete.$post({ json: params });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedules', vars.workspaceId] });
    },
  });
}
