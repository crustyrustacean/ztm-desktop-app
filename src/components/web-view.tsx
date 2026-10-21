import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

type Bounds = { x: number; y: number; width: number; height: number };

// Native child webviews always composite above the shell DOM. Leave a small
// temporary gutter so collapsed-sidebar tooltips can be seen beside the rail.
const SIDEBAR_TOOLTIP_GUTTER = 112;

/** Mirrors `PageSession` in src-tauri/src/web_view.rs. */
export type WebViewSession = {
  url: string;
  scrollX: number;
  scrollY: number;
  mediaTime: number | null;
  mediaPaused: boolean | null;
  playbackRate: number | null;
};

/** A page to load in the web view. `id` changes on every request, even for the same URL. */
export type WebViewRequest = {
  url: string;
  id: number;
  session?: WebViewSession;
};

function boundsOf(element: HTMLElement, sidebarTooltipOpen = false): Bounds {
  const rect = element.getBoundingClientRect();
  const gutter = sidebarTooltipOpen
    ? Math.min(SIDEBAR_TOOLTIP_GUTTER, rect.width)
    : 0;
  return {
    x: rect.left + gutter,
    y: rect.top,
    width: rect.width - gutter,
    height: rect.height,
  };
}

// Rust runs commands concurrently, so chain them to keep show/hide in call order
// and stop two show calls from both creating the webview.
let pending: Promise<unknown> = Promise.resolve();
function enqueue(
  command: string,
  args?: {
    bounds: Bounds;
    url?: string;
    session?: WebViewSession;
    authCheck?: boolean;
  },
  onError?: (error: unknown) => void,
) {
  pending = pending
    .then(() => invoke(command, args))
    .catch((error) => {
      console.error(`${command} failed`, error);
      onError?.(error);
    });
}

type WebViewProps = {
  active: boolean;
  /** The latest page asked for, e.g. a course opened from the Dashboard. */
  request: WebViewRequest | null;
  sidebarTooltipOpen?: boolean;
  authCheck?: boolean;
};

// The site sends X-Frame-Options: DENY, so an iframe stays blank. Rust lays a
// native child webview over this placeholder div instead (see web_view.rs).
export function WebView({
  active,
  request,
  sidebarTooltipOpen = false,
  authCheck = false,
}: WebViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openError, setOpenError] = useState(false);
  // Read when the web view is shown so opening a course doesn't create it twice.
  const requestRef = useRef(request);
  requestRef.current = request;
  const sidebarTooltipOpenRef = useRef(sidebarTooltipOpen);
  sidebarTooltipOpenRef.current = sidebarTooltipOpen;
  const loadedRequestId = useRef<number | null>(null);
  const mountGeneration = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container || !isTauri()) return;

    const sync = () =>
      enqueue("set_web_view_bounds", {
        bounds: boundsOf(container, sidebarTooltipOpenRef.current),
      });

    const initial = requestRef.current;
    const alreadyLoaded =
      initial !== null && initial.id === loadedRequestId.current;
    if (initial && !alreadyLoaded) loadedRequestId.current = initial.id;
    setOpenError(false);
    enqueue(
      "show_web_view",
      alreadyLoaded
        ? {
            bounds: boundsOf(container, sidebarTooltipOpenRef.current),
            authCheck,
          }
        : {
            bounds: boundsOf(container, sidebarTooltipOpenRef.current),
            url: initial?.url,
            session: initial?.session,
            authCheck,
          },
      () => setOpenError(true),
    );

    // Covers sidebar collapse as well as window resizes.
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    window.addEventListener("resize", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      enqueue("hide_web_view");
    };
  }, [active]);

  useEffect(() => {
    const generation = ++mountGeneration.current;
    return () => {
      // Strict Mode probes effects with a setup/cleanup/setup cycle. Deferring
      // lets the replacement setup cancel that probe without masking a real
      // component unmount.
      queueMicrotask(() => {
        if (mountGeneration.current === generation && isTauri()) {
          enqueue("dispose_web_view");
        }
      });
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container || !isTauri()) return;
    enqueue("set_web_view_bounds", {
      bounds: boundsOf(container, sidebarTooltipOpen),
    });
  }, [active, sidebarTooltipOpen]);

  // A page requested while the web view is already showing.
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !request || !container || !isTauri()) return;
    if (request.id === loadedRequestId.current) return;
    loadedRequestId.current = request.id;
    setOpenError(false);
    enqueue(
      "show_web_view",
      {
        bounds: boundsOf(container, sidebarTooltipOpenRef.current),
        url: request.url,
        session: request.session,
        authCheck,
      },
      () => setOpenError(true),
    );
  }, [active, request]);

  if (!isTauri()) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Web View requires the desktop app. Run npm run tauri dev and use the
        desktop window, not the browser preview.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="web-view-slot"
      className="h-[calc(100svh-3.5rem)] w-full"
    >
      {openError && (
        <p
          role="alert"
          className="m-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Could not open the Web View.
        </p>
      )}
    </div>
  );
}
