import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";

type Bounds = { x: number; y: number; width: number; height: number };

/** A page to load in the web view. `id` changes on every request, even for the same URL. */
export type WebViewRequest = { url: string; id: number };

function boundsOf(element: HTMLElement): Bounds {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// Rust runs commands concurrently, so chain them to keep show/hide in call order
// and stop two show calls from both creating the webview.
let pending: Promise<unknown> = Promise.resolve();
function enqueue(command: string, args?: { bounds: Bounds; url?: string }) {
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
  // While the page is fullscreen (e.g. a video), the placeholder covers the whole
  // window so the native web view hides the app's sidebar and header.
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen<boolean>("web-view-fullscreen", (event) =>
      setFullscreen(event.payload),
    );
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container || !isTauri()) return;

    const sync = () => enqueue("set_web_view_bounds", { bounds: boundsOf(container) });

    const initial = requestRef.current;
    const url =
      initial && initial.id !== loadedRequestId.current ? initial.url : undefined;
    if (initial) loadedRequestId.current = initial.id;
    enqueue("show_web_view", { bounds: boundsOf(container), url });

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

  // A page requested while the web view is already showing.
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !request || !container || !isTauri()) return;
    if (request.id === loadedRequestId.current) return;
    loadedRequestId.current = request.id;
    enqueue("show_web_view", { bounds: boundsOf(container), url: request.url });
  }, [active, request]);

  // Moving between the slot and the whole window can keep the same size, which the
  // ResizeObserver would miss, so resync the position after layout.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!active || !container || !isTauri()) return;
    enqueue("set_web_view_bounds", { bounds: boundsOf(container) });
  }, [active, fullscreen]);

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
      className={cn(
        fullscreen
          ? "fixed inset-0 z-50 bg-black"
          : "h-[calc(100svh-3rem)] w-full",
      )}
    />
  );
}
