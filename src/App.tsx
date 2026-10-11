import { SearchIcon } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import { AppSidebar } from "@/components/app-sidebar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";

function App() {
  const [query, setQuery] = useState("");

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
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
          </header>
          <div id="dashboard">
            <Dashboard filter={query} />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
