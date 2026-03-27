import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';

console.log('[App module] loaded');
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { queryClient } from './client/query-client.js';
import { useUIStore, useActiveTab, getFontSizePixels } from './stores/ui-store.js';
import { initHarness } from './stores/harness.js';
import { useWorkspaces } from './hooks/use-workspaces.js';
import { ThreadSidebar } from './components/layout/ThreadSidebar.js';
import { StatusBar } from './components/layout/StatusBar.js';
import { ThreadView } from './components/chat/ThreadView.js';
import { EmptyState } from './components/chat/EmptyState.js';
import { IntroSetup } from './components/onboarding/IntroSetup.js';
import { SettingsLayout } from './components/settings/SettingsLayout.js';
import { GeneralSettings } from './components/settings/GeneralSettings.js';
import { ModelSettings } from './components/settings/ModelSettings.js';
import { EmbeddingSettings } from './components/settings/EmbeddingSettings.js';
import { GlobalSettingsLayout } from './components/settings/GlobalSettingsLayout.js';
import { PermissionsSettings } from './components/settings/PermissionsSettings.js';
import { VisionSettings } from './components/settings/VisionSettings.js';
import { ThemeSettings } from './components/settings/ThemeSettings.js';
// WorkspacePlaceholderPage kept for future use
// import { WorkspacePlaceholderPage } from './components/settings/PlaceholderPage.js';
import { SkillsPage } from './components/skills/SkillsPage.js';
import { SchedulesPage } from './components/schedules/SchedulesPage.js';
import { KnowledgePage } from './components/knowledge/KnowledgePage.js';

function TabSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useActiveTab();
  const tabs = useUIStore((s) => s.tabs);
  const activeTabId = useUIStore((s) => s.activeTabId);
  const addTab = useUIStore((s) => s.addTab);
  const updateTabThread = useUIStore((s) => s.updateTabThread);
  const { data: workspaces } = useWorkspaces();
  const restoredRef = useRef(false);

  console.log('[TabSync] pathname:', location.pathname, 'activeTab:', activeTab, 'tabs:', tabs.length);

  // On first load: restore last tab route
  useEffect(() => {
    if (restoredRef.current) return;
    if (!activeTab) return; // wait for default tab to be created
    restoredRef.current = true;

    if (location.pathname === '/') {
      if (activeTab.threadId) {
        navigate(`/${activeTab.workspaceId}/${activeTab.threadId}`, { replace: true });
      } else {
        const newThreadId = crypto.randomUUID();
        navigate(`/${activeTab.workspaceId}/${newThreadId}?new=true`, { replace: true });
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure at least one tab exists when workspaces load
  useEffect(() => {
    if (tabs.length === 0 && workspaces && workspaces.length > 0) {
      addTab(workspaces[0].id);
    }
  }, [tabs.length, workspaces, addTab]);

  // Sync URL → active tab's threadId (skip new/unused threads)
  useEffect(() => {
    if (!activeTabId) return;
    const isNew = new URLSearchParams(location.search).get("new") === "true";
    if (isNew) return;
    const match = location.pathname.match(/^\/([^/]+)\/([^/?]+)/);
    if (match?.[2]) {
      updateTabThread(activeTabId, match[2]);
    }
  }, [location.pathname, location.search, activeTabId, updateTabThread]);

  return null;
}

function useThemeInit() {
  const theme = useUIStore((s) => s.theme);
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    // Mode
    const effective =
      theme.mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        : theme.mode;
    root.classList.toggle("dark", effective === "dark");
    // Accent – inline import avoided; just set CSS vars directly
    const ACCENT_MAP: Record<string, [string, string]> = {
      violet: ["oklch(0.488 0.217 264)", "oklch(0.588 0.217 264)"],
      blue: ["oklch(0.520 0.200 250)", "oklch(0.620 0.200 250)"],
      emerald: ["oklch(0.520 0.170 160)", "oklch(0.620 0.170 160)"],
      rose: ["oklch(0.520 0.200 15)", "oklch(0.620 0.200 15)"],
      amber: ["oklch(0.560 0.170 75)", "oklch(0.660 0.170 75)"],
      cyan: ["oklch(0.540 0.150 200)", "oklch(0.640 0.150 200)"],
      neutral: ["oklch(0.450 0.020 260)", "oklch(0.600 0.020 260)"],
    };
    const [light, dark] = ACCENT_MAP[theme.accentColor] ?? ACCENT_MAP.violet;
    const val = effective === "dark" ? dark : light;
    root.style.setProperty("--primary", val);
    root.style.setProperty("--ring", val);
    root.style.setProperty("--sidebar-primary", val);
    root.style.setProperty("--sidebar-ring", val);
    // Font size (multiplier-based)
    root.style.setProperty("font-size", `${getFontSizePixels(theme.fontScale)}px`);
    // Radius
    const R_MAP: Record<string, string> = { none: "0px", small: "0.375rem", default: "0.625rem", large: "1rem", full: "9999px" };
    root.style.setProperty("--radius", R_MAP[theme.radius] ?? "0.625rem");
  }, [theme]);
}

function AppShell() {
  useThemeInit();
  const setGatewayUrl = useUIStore((s) => s.setGatewayUrl);
  const gatewayToken = useUIStore((s) => s.gatewayToken);
  const sseRef = useRef<ReturnType<typeof initHarness>['sseConnector'] | null>(null);
  const [harnessReady, setHarnessReady] = useState(false);

  useEffect(() => {
    window.hatchAPI.getGatewayUrl().then((url: string) => {
      setGatewayUrl(url);
      const { sseConnector } = initHarness(url, gatewayToken);
      sseRef.current = sseConnector;
      sseConnector.connect();
      setHarnessReady(true);
    });

    return () => {
      sseRef.current?.disconnect();
    };
  }, [setGatewayUrl, gatewayToken]);

  console.log('[AppShell] render, harnessReady:', harnessReady);

  if (!harnessReady) return null;

  return (
    <SidebarProvider defaultOpen>
      <TabSync />
      <ThreadSidebar />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<EmptyState />} />
            <Route path="/app-settings" element={<GlobalSettingsLayout />}>
              <Route index element={<ThemeSettings />} />
            </Route>
            <Route path="/:workspaceId/settings" element={<SettingsLayout />}>
              <Route index element={<GeneralSettings />} />
              <Route path="model" element={<ModelSettings />} />
              <Route path="vision" element={<VisionSettings />} />
              <Route path="embeddings" element={<EmbeddingSettings />} />
              <Route path="permissions" element={<PermissionsSettings />} />
            </Route>
            <Route path="/:workspaceId/skills" element={<SkillsPage />} />
            <Route path="/:workspaceId/schedules" element={<SchedulesPage />} />
            <Route path="/:workspaceId/knowledge" element={<KnowledgePage />} />
            <Route path="/:workspaceId/:threadId" element={<ThreadView />} />
          </Routes>
        </div>
        <StatusBar />
      </SidebarInset>
    </SidebarProvider>
  );
}

export function App() {
  const onboarded = useUIStore((s) => s.onboarded);
  console.log('[App] render, onboarded:', onboarded);

  if (!onboarded) {
    return <IntroSetup />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppShell />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
