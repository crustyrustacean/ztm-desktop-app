import type { ComponentType } from "react";
import { Globe, LayoutDashboard, Settings, Star } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { Kbd } from "@/components/ui/kbd";
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

type MenuItem = {
  label: string;
  icon: ComponentType;
  /** Shortcut key shown in the hint badge; matches the `Digit` codes in App.tsx. */
  shortcut: string;
  view?: View;
  onClick?: () => void;
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, shortcut: "1", view: "dashboard" },
  { label: "Favourites", icon: Star, shortcut: "2", view: "favourites" },
  { label: "Web View", icon: Globe, shortcut: "3", view: "web-view" },
  { label: "Options", icon: Settings, shortcut: "4", view: "options" },
  { label: "Discord", icon: SiDiscord, shortcut: "5", onClick: openDiscord },
];

type AppSidebarProps = {
  view: View;
  onViewChange: (view: View) => void;
  /** Show each item's shortcut key while the shortcut modifier is held. */
  showHints: boolean;
};

export function AppSidebar({ view, onViewChange, showHints }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {menuItems.map((item) => {
              const isActive = item.view !== undefined && view === item.view;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    onClick={() =>
                      item.view ? onViewChange(item.view) : item.onClick?.()
                    }
                    isActive={isActive}
                    aria-current={isActive ? "page" : undefined}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {showHints && (
                    <Kbd className="absolute top-1.5 right-1 border bg-background text-foreground group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:right-0 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:min-w-4 group-data-[collapsible=icon]:text-[0.625rem]">
                      {item.shortcut}
                    </Kbd>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
