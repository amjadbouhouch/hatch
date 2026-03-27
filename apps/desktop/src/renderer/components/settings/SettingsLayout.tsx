import { Outlet, useParams, useNavigate, useLocation } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ChatHeader } from "../layout/ChatHeader";
import {
  SettingsIcon,
  BrainIcon,
  EyeIcon,
  BoxesIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  ExternalLinkIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "General", href: "", icon: SettingsIcon },
  { label: "Model & Keys", href: "/model", icon: BrainIcon },
  { label: "Vision Model", href: "/vision", icon: EyeIcon },
  { label: "Embeddings", href: "/embeddings", icon: BoxesIcon },
  { label: "Permissions", href: "/permissions", icon: ShieldCheckIcon },
];

export function SettingsLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const basePath = `/${workspaceId}/settings`;

  const isActive = (href: string) => {
    const fullPath = basePath + href;
    if (href === "") {
      return pathname === basePath || pathname === basePath + "/";
    }
    return pathname.startsWith(fullPath);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      {/* Header — consistent with ChatView / NewThreadView */}
      <header className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-3 sm:px-5">
        <ChatHeader />
      </header>

      {/* Settings content */}
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
          <h1 className="text-foreground pt-6 pb-2 text-lg font-semibold md:pt-10 md:pb-4">
            Workspace Settings
          </h1>

          <div className="my-4 grid w-full grid-cols-1 gap-x-8 md:my-6 md:grid-cols-[180px_minmax(0px,1fr)]">
            {/* Sub-navigation */}
            <nav
              className="relative z-10 mb-4 w-full self-start md:sticky md:top-4 md:mb-0"
              aria-label="Settings"
            >
              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="text-[11px] text-muted-foreground/60">
                  Workspace
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

              <SidebarGroup className="p-0 pt-4">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      size="sm"
                      onClick={() => navigate("/app-settings")}
                      className="h-7 gap-2 px-2 text-xs"
                    >
                      <SlidersHorizontalIcon className="size-3.5" />
                      <span className="flex-1">Global Settings</span>
                      <ExternalLinkIcon className="size-3 opacity-50" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </nav>

            {/* Active settings page */}
            <main className="flex min-w-0 flex-col pb-12">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
