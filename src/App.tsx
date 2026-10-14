import { useState } from "react";
import { SearchIcon } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Options from "./pages/Options";
import { AppSidebar } from "@/components/app-sidebar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { WebView } from "@/components/web-view";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { View } from "@/lib/view";

function App() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("dashboard");

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar view={view} onViewChange={setView} />
        <div className="min-w-0 flex-1">
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
            {view === "dashboard" && (
              <InputGroup className="ml-2 max-w-sm">
                <InputGroupInput
                  type="search"
                  aria-label="Filter courses"
                  placeholder="Filter courses..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
              </InputGroup>
            )}
          </header>
          <div id="dashboard" hidden={view !== "dashboard"}>
            <Dashboard filter={query} />
          </div>
          <div id="web-view" hidden={view !== "web-view"}>
            <WebView active={view === "web-view"} />
          </div>
          <div id="options" hidden={view !== "options"}>
            <Options />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
