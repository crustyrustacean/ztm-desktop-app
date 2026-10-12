import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

type Bounds = { x: number; y: number; width: number; height: number };

function boundsOf(element: HTMLElement): Bounds {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

// Rust runs commands concurrently, so chain them to keep show/hide in call order
// and stop two show calls from both creating the webview.
let pending: Promise<unknown> = Promise.resolve();
function enqueue(command: string, args?: { bounds: Bounds }) {
  pending = pending
    .then(() => invoke(command, args))
    .catch((error) => console.error(`${command} failed`, error));
}

// The site sends X-Frame-Options: DENY, so an iframe stays blank. Rust lays a
// native child webview over this placeholder div instead (see web_view.rs).
export function WebView({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container || !isTauri()) return;

    const sync = () => enqueue("set_web_view_bounds", { bounds: boundsOf(container) });

    enqueue("show_web_view", { bounds: boundsOf(container) });

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

  if (!isTauri()) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Web View requires the desktop app. Run npm run tauri dev and use the
        desktop window, not the browser preview.
      </p>
    );
  }

  return <div ref={containerRef} className="h-[calc(100svh-3rem)] w-full" />;
}
