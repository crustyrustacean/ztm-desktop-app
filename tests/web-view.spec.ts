import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type InvokeCall = { command: string; args: Record<string, unknown> };

async function authenticateAcademy(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.some(
          (call) =>
            call.command === "plugin:event|listen" &&
            call.args.event === "academy-authenticated",
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    (
      globalThis as typeof globalThis & {
        __emitTauriEvent: (event: string) => void;
      }
    ).__emitTauriEvent("academy-authenticated"),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks = new Map<number, (payload: unknown) => void>();
    const eventHandlers = new Map<string, (payload: unknown) => void>();
    const calls: InvokeCall[] = [];
    const rejectedCommands = new Set<string>();
    let callbackId = 0;

    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_CALLS__: calls,
      __rejectTauriCommand(command: string) {
        rejectedCommands.add(command);
      },
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
          if (rejectedCommands.has(command)) {
            throw new Error(`${command} rejected for test`);
          }
          if (command === "load_state") return {};
          if (command === "load_courses") {
            return [
              {
                uuid: "test-course",
                name: "Test Course",
                imageUrl: null,
                enrolledUrl:
                  "https://academy.zerotomastery.io/courses/enrolled/test-course",
                publicUrl:
                  "https://academy.zerotomastery.io/p/test-course",
              },
              {
                uuid: "coming-soon-course",
                name: "Coming Soon Course",
                imageUrl: null,
                enrolledUrl: null,
                publicUrl: null,
              },
            ];
          }
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
  await authenticateAcademy(page);
});

test("the dashboard stays hidden until Academy authentication succeeds", async ({
  page,
}) => {
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Sign in to ZTM Academy" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.find(
          (call) =>
            call.command === "show_web_view" && call.args.authCheck === true,
        ),
      ),
    )
    .toBeTruthy();

  await page.evaluate(() =>
    (
      globalThis as typeof globalThis & {
        __emitTauriEvent: (event: string) => void;
      }
    ).__emitTauriEvent("academy-authenticated"),
  );

  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
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
  await authenticateAcademy(page);
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
  await page
    .locator('[data-slot="sidebar-container"]')
    .evaluate(
      (element) =>
        new Promise<void>((resolve) => {
          const duration = Number.parseFloat(
            getComputedStyle(element).transitionDuration,
          );
          if (!duration) {
            resolve();
            return;
          }
          element.addEventListener("transitionend", () => resolve(), {
            once: true,
          });
          setTimeout(resolve, duration * 1_000 + 100);
        }),
    );
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

  await expect
    .poll(() =>
      page.evaluate(() => {
        const slot = document
          .querySelector('[data-testid="web-view-slot"]')!
          .getBoundingClientRect();
        const bounds = (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.filter(
          (call) =>
            call.command === "show_web_view" ||
            call.command === "set_web_view_bounds",
        ).at(-1)?.args.bounds as
          | { x: number; y: number; width: number; height: number }
          | undefined;
        return Boolean(
          bounds &&
            bounds.x === slot.left &&
            bounds.y === slot.top &&
            bounds.width === slot.width &&
            bounds.height === slot.height,
        );
      }),
    )
    .toBe(true);

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
    const positioned = calls
      .filter(
        (call) =>
          call.command === "show_web_view" ||
          call.command === "set_web_view_bounds",
      )
      .at(-1)!;
    return {
      bounds: positioned.args.bounds as ReturnType<typeof rect>,
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

test("a failed webview open is reported in the Web View area", async ({
  page,
}) => {
  await page.evaluate(() =>
    (
      globalThis as typeof globalThis & {
        __rejectTauriCommand: (command: string) => void;
      }
    ).__rejectTauriCommand("show_web_view"),
  );

  await page.getByRole("button", { name: "Web View" }).click();

  await expect(
    page.getByRole("alert").getByText("Could not open the Web View."),
  ).toBeVisible();
});

test("entering Web View from the sidebar collapses the app sidebar", async ({
  page,
}) => {
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  await page.getByRole("button", { name: "Web View" }).click();

  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByTestId("web-view-slot")).toBeVisible();
});

test("opening a course in Web View collapses the app sidebar", async ({
  page,
}) => {
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  await page
    .getByRole("button", { name: "Test Course", exact: true })
    .click();

  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect(page.getByTestId("web-view-slot")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.find(
          (call) =>
            call.command === "show_web_view" &&
            call.args.url ===
              "https://academy.zerotomastery.io/courses/enrolled/test-course",
        ),
      ),
    )
    .toBeTruthy();
});

test("a course without a URL is visibly disabled and skipped by keyboard navigation", async ({
  page,
}) => {
  const card = page.locator('[data-slot="card"]', {
    has: page.getByRole("heading", { name: "Coming Soon Course" }),
  });

  await expect(card).toHaveAttribute("aria-disabled", "true");
  await expect(card.getByText("Coming soon", { exact: true })).toBeVisible();

  const showCallsBefore = await page.evaluate(
    () =>
      (globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] })
        .__TAURI_CALLS__.filter((call) => call.command === "show_web_view")
        .length,
  );
  await card.click();
  await expect(page.getByTestId("web-view-slot")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __TAURI_CALLS__: InvokeCall[];
            }
          ).__TAURI_CALLS__.filter(
            (call) => call.command === "show_web_view",
          ).length,
      ),
    )
    .toBe(showCallsBefore);

  await page
    .getByRole("button", { name: "Test Course", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(card.locator(":focus")).toHaveCount(0);
});

test("collapsed sidebar tooltips temporarily clear the native webview", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Web View" }).click();

  const slot = page.getByTestId("web-view-slot");
  const dashboard = page.getByRole("button", { name: "Dashboard" });
  await expect(slot).toBeVisible();
  await dashboard.hover();

  const tooltip = page.locator('[data-slot="tooltip-content"]', {
    hasText: "Dashboard",
  });
  await expect(tooltip).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const calls = (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.filter(
          (call) => call.command === "set_web_view_bounds",
        );
        const bounds = calls.at(-1)?.args.bounds as
          | { x: number; width: number }
          | undefined;
        const slotRect = document
          .querySelector('[data-testid="web-view-slot"]')!
          .getBoundingClientRect();
        const tooltipRect = document
          .querySelector('[data-slot="tooltip-content"]')!
          .getBoundingClientRect();
        return {
          clearsTooltip: Boolean(bounds && bounds.x >= tooltipRect.right),
          shrinksFromLeft: Boolean(
            bounds &&
              bounds.x > slotRect.left &&
              bounds.width < slotRect.width,
          ),
        };
      }),
    )
    .toEqual({ clearsTooltip: true, shrinksFromLeft: true });

  await page.locator("header").hover();
  await expect(tooltip).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const bounds = (
          globalThis as typeof globalThis & { __TAURI_CALLS__: InvokeCall[] }
        ).__TAURI_CALLS__.filter(
          (call) => call.command === "set_web_view_bounds",
        ).at(-1)?.args.bounds as { x: number; width: number } | undefined;
        const slotRect = document
          .querySelector('[data-testid="web-view-slot"]')!
          .getBoundingClientRect();
        return Boolean(
          bounds &&
            bounds.x === slotRect.left &&
            bounds.width === slotRect.width,
        );
      }),
    )
    .toBe(true);
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
