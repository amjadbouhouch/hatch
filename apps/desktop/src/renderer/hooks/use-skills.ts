import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import type {
  BrowseSkillsResponse,
  BrowseSkill,
  SkillSourcesResponse,
  SkillSource,
  SkillContent,
  InstalledSkillList,
  InstalledSkill,
  InstalledSkillContent,
  InstallSkillInput,
  UninstallSkillInput,
} from '../client/api-types.js';

export type { BrowseSkill, SkillSource, SkillContent, InstalledSkill, InstalledSkillContent };

const PAGE_SIZE = 25;

// ─── Browse (infinite scroll, 1-indexed pages) ─────────────────────────────

export function useBrowseSkills(search: string, source: string) {
  return useInfiniteQuery({
    queryKey: ['skills', 'browse', search, source] as const,
    queryFn: async ({ pageParam = 1 }) => {
      const api = await getClient();
      if (search.trim()) {
        const res = await api.skills.search.$get({
          query: { q: search, page: String(pageParam), pageSize: String(PAGE_SIZE) },
        });
        return res.json() as Promise<BrowseSkillsResponse>;
      }
      const res = await api.skills.browse.$get({
        query: { page: String(pageParam), pageSize: String(PAGE_SIZE), source },
      });
      return res.json() as Promise<BrowseSkillsResponse>;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) return lastPage.page + 1;
      return undefined;
    },
  });
}

// ─── Sources (for filter) ───────────────────────────────────────────────────

export function useSkillSources() {
  return useQuery({
    queryKey: ['skills', 'sources'] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.sources.$get();
      return res.json() as Promise<SkillSourcesResponse>;
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Skill Content (preview) ────────────────────────────────────────────────

export function useSkillContent(owner: string, repo: string, skillId: string) {
  return useQuery({
    queryKey: ['skills', 'content', owner, repo, skillId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.content[':owner'][':repo'][':skillId'].$get({
        param: { owner, repo, skillId },
      });
      if (!res.ok) throw new Error('Failed to load skill');
      return res.json() as Promise<SkillContent>;
    },
    enabled: !!owner && !!repo && !!skillId,
    staleTime: 5 * 60_000,
  });
}

// ─── Installed Skill Content (preview from disk) ────────────────────────────

export function useInstalledSkillContent(workspaceId: string | undefined, skillId: string | null) {
  return useQuery({
    queryKey: ['skills', 'installed-content', workspaceId, skillId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.installed[':workspaceId'][':skillId'].content.$get({
        param: { workspaceId: workspaceId!, skillId: skillId! },
      });
      if (!res.ok) throw new Error('Failed to load skill');
      return res.json() as Promise<InstalledSkillContent>;
    },
    enabled: !!workspaceId && !!skillId,
    staleTime: 5 * 60_000,
  });
}

// ─── Installed ──────────────────────────────────────────────────────────────

export function useInstalledSkills(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['skills', 'installed', workspaceId] as const,
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.installed[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<InstalledSkillList>;
    },
    enabled: !!workspaceId,
  });
}

// ─── Install / Uninstall ────────────────────────────────────────────────────

export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: InstallSkillInput) => {
      const api = await getClient();
      const res = await api.skills.install.$post({ json: params });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['skills', 'installed', vars.workspaceId] });
    },
  });
}

export function useUninstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: UninstallSkillInput) => {
      const api = await getClient();
      const res = await api.skills.uninstall.$post({ json: params });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['skills', 'installed', vars.workspaceId] });
    },
  });
}
