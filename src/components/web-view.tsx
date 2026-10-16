import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

type Bounds = { x: number; y: number; width: number; height: number };

/** A page to load in the web view. `id` changes on every request, even for the same URL. */
export type WebViewSession = {
  url: string;
  scrollX: number;
  scrollY: number;
  mediaTime: number | null;
  mediaPaused: boolean | null;
  playbackRate: number | null;
};

export type WebViewRequest = {
  url: string;
  id: number;
  session?: WebViewSession;
};

function boundsOf(element: HTMLElement): Bounds {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// Rust runs commands concurrently, so chain them to keep show/hide in call order
// and stop two show calls from both creating the webview.
let pending: Promise<unknown> = Promise.resolve();
function enqueue(
  command: string,
  args?: { bounds: Bounds; url?: string; session?: WebViewSession },
) {
  pending = pending
    .then(() => invoke(command, args))
    .catch((error) => console.error(`${command} failed`, error));
}

type WebViewProps = {
  active: boolean;
  /** The latest page asked for, e.g. a course opened from the Dashboard. */
  request: WebViewRequest | null;
};

// The site sends X-Frame-Options: DENY, so an iframe stays blank. Rust lays a
// native child webview over this placeholder div instead (see web_view.rs).
export function WebView({ active, request }: WebViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Read when the web view is shown so opening a course doesn't create it twice.
  const requestRef = useRef(request);
  requestRef.current = request;
  const loadedRequestId = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container || !isTauri()) return;

    const sync = () => enqueue("set_web_view_bounds", { bounds: boundsOf(container) });

    const initial = requestRef.current;
    const url = initial?.url;
    if (initial) loadedRequestId.current = initial.id;
    enqueue("show_web_view", {
      bounds: boundsOf(container),
      url,
      session: initial?.session,
    });

    // Covers sidebar collapse as well as window resizes.
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    window.addEventListener("resize", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      loadedRequestId.current = null;
      enqueue("dispose_web_view");
    };
  }, [active]);

  // A page requested while the web view is already showing.
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !request || !container || !isTauri()) return;
    if (request.id === loadedRequestId.current) return;
    loadedRequestId.current = request.id;
    enqueue("show_web_view", {
      bounds: boundsOf(container),
      url: request.url,
      session: request.session,
    });
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
    />
  );
}
