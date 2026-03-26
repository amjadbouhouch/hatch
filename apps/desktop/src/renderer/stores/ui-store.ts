import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tab {
  id: string;
  workspaceId: string;
  threadId: string | null;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'neutral';
export type FontScale = 'small' | 'normal' | 'large' | 'xlarge';
export type UIRadius = 'none' | 'small' | 'default' | 'large' | 'full';

export const FONT_SCALE_OPTIONS: {
  value: FontScale;
  label: string;
  multiplier: number;
}[] = [
  { value: 'small', label: 'Small', multiplier: 0.85 },
  { value: 'normal', label: 'Normal', multiplier: 1.0 },
  { value: 'large', label: 'Large', multiplier: 1.15 },
  { value: 'xlarge', label: 'Extra Large', multiplier: 1.3 },
];

export function getFontSizePixels(scale: FontScale): number {
  const option = FONT_SCALE_OPTIONS.find((o) => o.value === scale);
  return (option?.multiplier ?? 1) * 16;
}

export interface ThemeConfig {
  mode: ThemeMode;
  accentColor: AccentColor;
  fontScale: FontScale;
  radius: UIRadius;
}

interface UIState {
  onboarded: boolean;
  sidebarOpen: boolean;
  connected: boolean;
  gatewayUrl: string | null;
  gatewayToken: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  theme: ThemeConfig;

  // Tab actions
  addTab: (workspaceId: string, threadId?: string | null) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabThread: (tabId: string, threadId: string | null) => void;
  reorderTabs: (tabIds: string[]) => void;

  // Theme actions
  setTheme: (theme: Partial<ThemeConfig>) => void;

  // Existing
  setOnboarded: (v: boolean) => void;
  toggleSidebar: () => void;
  setConnected: (connected: boolean) => void;
  setGatewayUrl: (url: string) => void;
  setGatewayToken: (token: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      sidebarOpen: true,
      connected: false,
      gatewayUrl: null,
      gatewayToken: null,
      tabs: [],
      activeTabId: null,
      theme: {
        mode: 'system',
        accentColor: 'violet',
        fontScale: 'normal',
        radius: 'default',
      },

      addTab: (workspaceId, threadId = null) => {
        const id = crypto.randomUUID();
        set((s) => ({
          tabs: [...s.tabs, { id, workspaceId, threadId }],
          activeTabId: id,
        }));
        return id;
      },

      removeTab: (tabId) => {
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === tabId);
          const next = s.tabs.filter((t) => t.id !== tabId);
          let nextActiveId = s.activeTabId;
          if (s.activeTabId === tabId) {
            // Activate adjacent tab
            const newIdx = Math.min(idx, next.length - 1);
            nextActiveId = next[newIdx]?.id ?? null;
          }
          return { tabs: next, activeTabId: nextActiveId };
        });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateTabThread: (tabId, threadId) => {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, threadId } : t
          ),
        }));
      },

      reorderTabs: (tabIds) => {
        set((s) => {
          const tabMap = new Map(s.tabs.map((t) => [t.id, t]));
          const reordered = tabIds
            .map((id) => tabMap.get(id))
            .filter(Boolean) as Tab[];
          return { tabs: reordered };
        });
      },

      setTheme: (partial) =>
        set((s) => ({ theme: { ...s.theme, ...partial } })),

      setOnboarded: (v) => set({ onboarded: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setConnected: (connected) => set({ connected }),
      setGatewayUrl: (url) => set({ gatewayUrl: url }),
      setGatewayToken: (token) => set({ gatewayToken: token }),
    }),
    {
      name: 'hatch-ui',
      partialize: (state) => ({
        onboarded: state.onboarded,
        gatewayToken: state.gatewayToken,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        theme: state.theme,
      }),
    }
  )
);

// ─── Derived selectors ──────────────────────────────────────────────────────

export function useActiveTab(): Tab | undefined {
  return useUIStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
}
