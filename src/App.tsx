import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import { AppSidebar } from "@/components/app-sidebar";
import { WebView } from "@/components/web-view";
import { Input } from "@/components/ui/input"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { View } from "@/lib/view";

function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar view={view} onViewChange={setView} />
        <div className="min-w-0 flex-1">
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
            {/* The filter only applies to the Dashboard's course list. */}
            {view === "dashboard" && <Input placeholder="Filter items..." />}
          </header>
          {/* Both stay mounted so switching back keeps their state. */}
          <div id="dashboard" hidden={view !== "dashboard"}>
            <Dashboard />
          </div>
          <div id="web-view" hidden={view !== "web-view"}>
            <WebView active={view === "web-view"} />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
