import Dashboard from "./pages/Dashboard";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <TooltipProvider>
      <SidebarProvider className="app-shell">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <div id="dashboard">
            <Dashboard />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
