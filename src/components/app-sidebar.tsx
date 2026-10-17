import { Globe, LayoutDashboard, Settings, Star } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { openDiscord } from "@/lib/discord";
import type { View } from "@/lib/view";

type AppSidebarProps = {
  view: View;
  onViewChange: (view: View) => void;
  onTooltipOpenChange?: (tooltip: string, open: boolean) => void;
};

export function AppSidebar({
  view,
  onViewChange,
  onTooltipOpenChange,
}: AppSidebarProps) {
  const handleTooltipOpenChange = (tooltip: string) => (open: boolean) =>
    onTooltipOpenChange?.(tooltip, open);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onViewChange("dashboard")}
                isActive={view === "dashboard"}
                aria-current={view === "dashboard" ? "page" : undefined}
                tooltip="Dashboard"
                onTooltipOpenChange={handleTooltipOpenChange("dashboard")}
              >
                <LayoutDashboard />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onViewChange("favourites")}
                isActive={view === "favourites"}
                aria-current={view === "favourites" ? "page" : undefined}
                tooltip="Favourites"
                onTooltipOpenChange={handleTooltipOpenChange("favourites")}
              >
                <Star />
                <span>Favourites</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onViewChange("web-view")}
                isActive={view === "web-view"}
                aria-current={view === "web-view" ? "page" : undefined}
                tooltip="Web View"
                onTooltipOpenChange={handleTooltipOpenChange("web-view")}
              >
                <Globe />
                <span>Web View</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onViewChange("options")}
                isActive={view === "options"}
                aria-current={view === "options" ? "page" : undefined}
                tooltip="Options"
                onTooltipOpenChange={handleTooltipOpenChange("options")}
              >
                <Settings />
                <span>Options</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={openDiscord}
                tooltip="Discord"
                onTooltipOpenChange={handleTooltipOpenChange("discord")}
              >
                <SiDiscord />
                <span>Discord</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
