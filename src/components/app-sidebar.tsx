import { LayoutDashboard } from "lucide-react";
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

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<a href="#dashboard" />}
                isActive
                aria-current="page"
                tooltip="Dashboard"
              >
                <LayoutDashboard />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={openDiscord} tooltip="Discord">
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
