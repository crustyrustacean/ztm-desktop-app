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
import type { View } from "@/lib/view";

type MenuItem = {
  label: string;
  icon: ComponentType;
  /** Shortcut key shown in the hint badge; matches the `Digit` codes in App.tsx. */
  shortcut: string;
  /** Identifies the item to `onTooltipOpenChange`. */
  tooltip: string;
  view?: View;
};

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    shortcut: "1",
    tooltip: "dashboard",
    view: "dashboard",
  },
  {
    label: "Favourites",
    icon: Star,
    shortcut: "2",
    tooltip: "favourites",
    view: "favourites",
  },
  {
    label: "Web View",
    icon: Globe,
    shortcut: "3",
    tooltip: "web-view",
    view: "web-view",
  },
  {
    label: "Options",
    icon: Settings,
    shortcut: "4",
    tooltip: "options",
    view: "options",
  },
  {
    label: "Discord",
    icon: SiDiscord,
    shortcut: "5",
    tooltip: "discord",
  },
];

type AppSidebarProps = {
  view: View;
  onViewChange: (view: View) => void;
  onOpenDiscord: () => void;
  onTooltipOpenChange?: (tooltip: string, open: boolean) => void;
  /** Show each item's shortcut key while the shortcut modifier is held. */
  showHints: boolean;
};

export function AppSidebar({
  view,
  onViewChange,
  onOpenDiscord,
  onTooltipOpenChange,
  showHints,
}: AppSidebarProps) {
  const handleTooltipOpenChange = (tooltip: string) => (open: boolean) =>
    onTooltipOpenChange?.(tooltip, open);

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
                      item.view ? onViewChange(item.view) : onOpenDiscord()
                    }
                    isActive={isActive}
                    aria-current={isActive ? "page" : undefined}
                    tooltip={item.label}
                    onTooltipOpenChange={handleTooltipOpenChange(item.tooltip)}
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
