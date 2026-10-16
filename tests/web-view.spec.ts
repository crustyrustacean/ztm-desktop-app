import { expect, test } from "@playwright/test";

type InvokeCall = { command: string; args: Record<string, unknown> };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks = new Map<number, (payload: unknown) => void>();
    const eventHandlers = new Map<string, (payload: unknown) => void>();
    const calls: InvokeCall[] = [];
    let callbackId = 0;

    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_CALLS__: calls,
      __emitTauriEvent(event: string, payload: unknown = null) {
        eventHandlers.get(event)?.({ event, id: 1, payload });
      },
      __TAURI_INTERNALS__: {
        transformCallback(callback: (payload: unknown) => void) {
          callbackId += 1;
          callbacks.set(callbackId, callback);
          return callbackId;
        },
        unregisterCallback(id: number) {
          callbacks.delete(id);
        },
        async invoke(command: string, args: Record<string, unknown> = {}) {
          calls.push({ command, args });
          if (command === "load_state") return {};
          if (command === "load_courses") return [];
          if (command === "sync_courses") return null;
          if (command === "plugin:event|listen") {
            const handler = callbacks.get(args.handler as number);
            if (handler) eventHandlers.set(args.event as string, handler);
            return 1;
          }
          if (command === "plugin:event|unlisten") return null;
          return null;
        },
      },
      __TAURI_EVENT_PLUGIN_INTERNALS__: {
        unregisterListener() {},
      },
    });
  });

  await page.goto("/");
});

test("the resolved system theme is synchronized to native Academy views", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__
          .filter((call) => call.command === "set_web_view_theme")
          .at(-1),
      ),
    )
    .toMatchObject({
      command: "set_web_view_theme",
      args: { theme: "dark", reset: false },
    });
});

test("changing theme in Options requests an Academy webview reset", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("switch", { name: "Dark mode" }).click();

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__
          .filter((call) => call.command === "set_web_view_theme")
          .at(-1),
      ),
    )
    .toMatchObject({
      command: "set_web_view_theme",
      args: { theme: "dark", reset: true },
    });
});

test("embedded webview bounds stay below the header and beside the sidebar", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web View" }).click();
  const slot = page.getByTestId("web-view-slot");
  await expect(slot).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] })
          .__TAURI_CALLS__.find((call) => call.command === "show_web_view"),
      ),
    )
    .toBeTruthy();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const value = document.querySelector(selector)!.getBoundingClientRect();
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height,
      };
    };
    const calls = (
      globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
    ).__TAURI_CALLS__;
    const shown = calls.find((call) => call.command === "show_web_view")!;
    return {
      bounds: shown.args.bounds as ReturnType<typeof rect>,
      slot: rect('[data-testid="web-view-slot"]'),
      sidebar: rect('[data-slot="sidebar-container"]'),
      header: rect("header"),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });

  expect(geometry.bounds).toEqual({
    x: geometry.slot.left,
    y: geometry.slot.top,
    width: geometry.slot.width,
    height: geometry.slot.height,
  });
  expect(geometry.slot.left).toBeGreaterThanOrEqual(geometry.sidebar.right);
  expect(geometry.slot.top).toBeGreaterThanOrEqual(geometry.header.bottom);
  expect(geometry.slot.right).toBeLessThanOrEqual(geometry.viewport.width);
  expect(geometry.slot.bottom).toBeLessThanOrEqual(geometry.viewport.height);
});

test("switching from Web View to Dashboard disposes the native child", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web View" }).click();
  await expect(page.getByTestId("web-view-slot")).toBeVisible();

  const callsBefore = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] })
        .__TAURI_CALLS__.length,
  );
  await page.getByRole("button", { name: "Dashboard" }).click();

  await expect(page.getByTestId("web-view-slot")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate((start) => {
        const calls = (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.slice(start);
        return calls.filter((call) => call.command === "dispose_web_view")
          .length;
      }, callsBefore),
    )
    .toBe(1);
});

test("promotion returns the shell to Dashboard and disposes its child", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web View" }).click();
  await expect(page.getByTestId("web-view-slot")).toBeVisible();

  await page.evaluate(() =>
    (
      globalThis as typeof globalThis & {
        __emitTauriEvent: (event: string) => void;
      }
    ).__emitTauriEvent("web-view-promoted"),
  );

  await expect(
    page.getByRole("button", { name: "Dashboard" }),
  ).toHaveAttribute("aria-current", "page");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] })
          .__TAURI_CALLS__.some(
            (call) => call.command === "dispose_web_view",
          ),
      ),
    )
    .toBe(true);
});

test("demotion recreates the embedded view with its current session", async ({
  page,
}) => {
  const session = {
    url: "https://academy.zerotomastery.io/lessons/current-lesson",
    scrollX: 20,
    scrollY: 640,
    mediaTime: 125.5,
    mediaPaused: false,
    playbackRate: 1.25,
  };

  await page.getByRole("button", { name: "Web View" }).click();
  await page.evaluate(() =>
    (
      globalThis as typeof globalThis & {
        __emitTauriEvent: (event: string) => void;
      }
    ).__emitTauriEvent("web-view-promoted"),
  );
  await page.evaluate((payload) =>
    (
      globalThis as typeof globalThis & {
        __emitTauriEvent: (event: string, payload: unknown) => void;
      }
    ).__emitTauriEvent("web-view-demoted", payload), session);

  await expect(page.getByTestId("web-view-slot")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((expected) => {
        const calls = (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.filter((call) => call.command === "show_web_view");
        const last = calls.at(-1);
        return (
          last?.args.url === expected.url &&
          JSON.stringify(last?.args.session) === JSON.stringify(expected)
        );
      }, session),
    )
    .toBe(true);
});
