import { useCallback, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
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
import { WebView, type WebViewRequest } from "@/components/web-view";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAcademyMember } from "@/hooks/use-academy-member";
import { useCourseOpenMode } from "@/hooks/use-course-open-mode";
import { useCourses } from "@/hooks/use-courses";
import { useFavourites } from "@/hooks/use-favourites";
import { useUserName } from "@/hooks/use-user-name";
import { courseUrl, type Course } from "@/lib/course";
import type { View } from "@/lib/view";

function App() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const { courses, syncing, error, retry } = useCourses();
  const { favourites, toggleFavourite } = useFavourites();
  const { name, setName } = useUserName();
  const { academyMember, setAcademyMember } = useAcademyMember();
  const { courseOpenMode, setCourseOpenMode } = useCourseOpenMode();
  const [webViewRequest, setWebViewRequest] = useState<WebViewRequest | null>(
    null,
  );

  const canOpenCourse = useCallback(
    (course: Course) => courseUrl(course, academyMember) !== null,
    [academyMember],
  );

  const openCourse = useCallback(
    (course: Course) => {
      const url = courseUrl(course, academyMember);
      if (!url) return;
      const openEmbedded = () => {
        setWebViewRequest((previous) => ({ url, id: (previous?.id ?? 0) + 1 }));
        setView("web-view");
      };
      if (courseOpenMode === "window" && isTauri()) {
        // If the window can't open, show the course in the app rather than nowhere.
        invoke("open_course_window", { url }).catch((error) => {
          console.error("Could not open course window", error);
          openEmbedded();
        });
        return;
      }
      openEmbedded();
    },
    [academyMember, courseOpenMode],
  );

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar view={view} onViewChange={setView} />
        <div className="min-w-0 flex-1">
          <header className="flex h-14 items-center border-b px-4">
            <SidebarTrigger />
            {(view === "dashboard" || view === "favourites") && (
              <InputGroup className="ml-2 h-10">
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
              onOpenCourse={openCourse}
              canOpenCourse={canOpenCourse}
            />
          </div>
          <div id="favourites" hidden={view !== "favourites"}>
            <Favourites
              filter={query}
              courses={courses}
              favourites={favourites}
              onToggleFavourite={toggleFavourite}
              onOpenCourse={openCourse}
              canOpenCourse={canOpenCourse}
            />
          </div>
          <div id="web-view" hidden={view !== "web-view"}>
            <WebView active={view === "web-view"} request={webViewRequest} />
          </div>
          <div id="options" hidden={view !== "options"}>
            <Options
              name={name}
              onNameChange={setName}
              academyMember={academyMember}
              onAcademyMemberChange={setAcademyMember}
              courseOpenMode={courseOpenMode}
              onCourseOpenModeChange={setCourseOpenMode}
            />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
