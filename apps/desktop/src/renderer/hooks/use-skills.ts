import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient } from '../client/api.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BrowseSkill = {
  source: string;
  skillId: string;
  name: string;
  installs: number;
  owner: string;
  repo: string;
  githubUrl: string;
  displayName: string;
};

type BrowsePage = {
  skills: BrowseSkill[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SkillSource = {
  source: string;
  owner: string;
  repo: string;
  skillCount: number;
  totalInstalls: number;
};

export type InstalledSkill = {
  name: string;
  displayName: string;
  description: string;
  path: string;
};

export type SkillContent = {
  source: string;
  skillId: string;
  path: string;
  metadata: { name: string; description: string };
  instructions: string;
  raw: string;
};

const PAGE_SIZE = 25;

// ─── Browse (infinite scroll, 1-indexed pages) ─────────────────────────────

export function useBrowseSkills(search: string, source: string) {
  return useInfiniteQuery({
    queryKey: ['skills', 'browse', search, source],
    queryFn: async ({ pageParam = 1 }) => {
      const api = await getClient();
      if (search.trim()) {
        const res = await api.skills.search.$get({
          query: { q: search, page: String(pageParam), pageSize: String(PAGE_SIZE) },
        });
        return res.json() as Promise<BrowsePage>;
      }
      const res = await api.skills.browse.$get({
        query: { page: String(pageParam), pageSize: String(PAGE_SIZE), source },
      });
      return res.json() as Promise<BrowsePage>;
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
    queryKey: ['skills', 'sources'],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.sources.$get();
      return res.json() as Promise<{ sources: SkillSource[]; total: number }>;
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Skill Content (preview) ────────────────────────────────────────────────

export function useSkillContent(owner: string, repo: string, skillId: string) {
  return useQuery({
    queryKey: ['skills', 'content', owner, repo, skillId],
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
    queryKey: ['skills', 'installed-content', workspaceId, skillId],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.installed[':workspaceId'][':skillId'].content.$get({
        param: { workspaceId: workspaceId!, skillId: skillId! },
      });
      if (!res.ok) throw new Error('Failed to load skill');
      return res.json() as Promise<{ skillId: string; metadata: { name: string; description: string }; instructions: string; raw: string }>;
    },
    enabled: !!workspaceId && !!skillId,
    staleTime: 5 * 60_000,
  });
}

// ─── Installed ──────────────────────────────────────────────────────────────

export function useInstalledSkills(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['skills', 'installed', workspaceId],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.skills.installed[':workspaceId'].$get({
        param: { workspaceId: workspaceId! },
      });
      return res.json() as Promise<InstalledSkill[]>;
    },
    enabled: !!workspaceId,
  });
}

// ─── Install / Uninstall ────────────────────────────────────────────────────

export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      workspaceId: string;
      skillId: string;
      owner: string;
      repo: string;
    }) => {
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
    mutationFn: async (params: { workspaceId: string; skillId: string }) => {
      const api = await getClient();
      const res = await api.skills.uninstall.$post({ json: params });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['skills', 'installed', vars.workspaceId] });
    },
  });
}
