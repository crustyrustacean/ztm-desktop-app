import { useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Favourites from "./pages/Favourites";
import Options from "./pages/Options";
import { AppSidebar } from "@/components/app-sidebar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { WebView } from "@/components/web-view";
import { Kbd } from "@/components/ui/kbd";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAcademyMember } from "@/hooks/use-academy-member";
import { useCourses } from "@/hooks/use-courses";
import { useFavourites } from "@/hooks/use-favourites";
import { useShortcutModifier } from "@/hooks/use-shortcut-modifier";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useUserName } from "@/hooks/use-user-name";
import { openDiscord } from "@/lib/discord";
import type { View } from "@/lib/view";

function App() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const { courses, syncing, error, retry } = useCourses();
  const { favourites, toggleFavourite } = useFavourites();
  const { name, setName } = useUserName();
  const { academyMember, setAcademyMember } = useAcademyMember();
  const { shortcutModifier, setShortcutModifier } = useShortcutModifier();
  const filterRef = useRef<HTMLInputElement>(null);
  const hasFilter = view === "dashboard" || view === "favourites";

  function focusFilter() {
    if (!hasFilter) setView("dashboard");
    // The filter only mounts once the view has a filter, so wait for that render.
    requestAnimationFrame(() => filterRef.current?.focus());
  }

  const showHints = useShortcuts(shortcutModifier, {
    Digit1: () => setView("dashboard"),
    Digit2: () => setView("favourites"),
    Digit3: () => setView("web-view"),
    Digit4: () => setView("options"),
    Digit5: openDiscord,
    KeyS: focusFilter,
  });

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar view={view} onViewChange={setView} showHints={showHints} />
        <div className="min-w-0 flex-1">
          <header className="flex h-14 items-center border-b px-4">
            <SidebarTrigger />
            {hasFilter && (
              <InputGroup className="ml-2 h-10">
                <InputGroupInput
                  ref={filterRef}
                  type="search"
                  aria-label="Filter courses"
                  placeholder="Filter courses..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                {showHints && (
                  <InputGroupAddon align="inline-end">
                    <Kbd className="border bg-background text-foreground">S</Kbd>
                  </InputGroupAddon>
                )}
              </InputGroup>
            )}
          </header>
          <div id="dashboard" hidden={view !== "dashboard"}>
            <Dashboard
              name={name}
              academyMember={academyMember}
              filter={query}
              courses={courses}
              syncing={syncing}
              error={error}
              onRetry={retry}
              favourites={favourites}
              onToggleFavourite={toggleFavourite}
            />
          </div>
          <div id="favourites" hidden={view !== "favourites"}>
            <Favourites
              filter={query}
              courses={courses}
              favourites={favourites}
              onToggleFavourite={toggleFavourite}
            />
          </div>
          <div id="web-view" hidden={view !== "web-view"}>
            <WebView active={view === "web-view"} />
          </div>
          <div id="options" hidden={view !== "options"}>
            <Options
              name={name}
              onNameChange={setName}
              academyMember={academyMember}
              onAcademyMemberChange={setAcademyMember}
              shortcutModifier={shortcutModifier}
              onShortcutModifierChange={setShortcutModifier}
            />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
