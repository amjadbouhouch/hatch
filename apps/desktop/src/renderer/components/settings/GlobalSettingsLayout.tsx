import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ChatHeader } from "../layout/ChatHeader";
import {
  BoxesIcon,
  KeyIcon,
  PaletteIcon,
  ServerIcon,
  SettingsIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { useActiveTab } from "../../stores/ui-store.js";

const NAV_ITEMS = [
  { label: "Embeddings", href: "", icon: BoxesIcon },
  { label: "Gateway", href: "/gateway", icon: ServerIcon },
  { label: "API Keys", href: "/keys", icon: KeyIcon },
  { label: "Appearance", href: "/appearance", icon: PaletteIcon },
];

export function GlobalSettingsLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeTab = useActiveTab();

  const basePath = "/app-settings";

  const isActive = (href: string) => {
    const fullPath = basePath + href;
    if (href === "") {
      return pathname === basePath || pathname === basePath + "/";
    }
    return pathname.startsWith(fullPath);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      <header className="drag-region flex h-13 shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
          <h1 className="text-foreground pt-6 pb-2 text-lg font-semibold md:pt-10 md:pb-4">
            Global Settings
          </h1>

          <div className="my-4 grid w-full grid-cols-1 gap-x-8 md:my-6 md:grid-cols-[180px_minmax(0px,1fr)]">
            <nav
              className="relative z-10 mb-4 w-full self-start md:sticky md:top-4 md:mb-0"
              aria-label="App Settings"
            >
              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="text-[11px] text-muted-foreground/60">
                  Global
                </SidebarGroupLabel>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        size="sm"
                        isActive={isActive(item.href)}
                        onClick={() => navigate(basePath + item.href)}
                        className="h-7 gap-2 px-2 text-xs"
                      >
                        <item.icon className="size-3.5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>

              {activeTab?.workspaceId && (
                <SidebarGroup className="p-0 pt-4">
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        size="sm"
                        onClick={() => navigate(`/${activeTab.workspaceId}/settings`)}
                        className="h-7 gap-2 px-2 text-xs"
                      >
                        <SettingsIcon className="size-3.5" />
                        <span className="flex-1">Workspace Settings</span>
                        <ExternalLinkIcon className="size-3 opacity-50" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroup>
              )}
            </nav>

            <main className="flex min-w-0 flex-col pb-12">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
