# Linux embedded Academy webview spike

## Verdict

**Not viable with the tested `gtk::Fixed` implementation.** The experiment reached
the time-box stop condition at Step 4: opening an embedded Academy page makes the
main window grow continuously and leaves it non-interactive. The layout never
stabilizes, so bounds, resizing, pointer input, video playback, and session reuse
cannot be evaluated meaningfully.

The production behavior on `31/feat/web-view-open-modes` should remain the Linux
top-level Academy window until the runtime has a child-container implementation
whose size requisition does not feed back into the parent window.

## Test environment

- Windows host with WSL2 and WSLg
- Ubuntu 24.04.1 LTS (Noble)
- `DISPLAY=:0`
- `WAYLAND_DISPLAY=wayland-0`
- `XDG_SESSION_TYPE`, `XDG_CURRENT_DESKTOP`, and `DESKTOP_SESSION` unset
- WebKitGTK 4.1 2.52.6
- Rust 1.99.1

This is a WSLg run, not a complete native-desktop matrix. WSLg exposed both X and
Wayland display sockets, but the session did not identify itself as X11 or Wayland.
Separate native X11 and Wayland sessions were therefore not tested.

## Baseline

Before the spike changes:

- `npm test`: 23/23 passed
- `npx tsc --noEmit`: passed
- `npm run test:browser`: 28/28 passed
- standalone browser regression: 28/28 passed
- `cargo test`: 25 passed, 0 failed, 1 ignored
- the existing Linux Academy implementation opened a stable, interactive separate
  window as expected

## Upstream behavior confirmed

In unmodified `tauri-runtime-wry` 2.12.1, Linux `WindowChild` and
`WindowContent` webviews are both built into the window's `default_vbox` rather
than a coordinate-aware child container. That explains why requested child bounds
are not respected. Wry 0.57.0 has a `gtk::Fixed` child path and applies bounds with
`move_` plus a size request/allocation, which made `gtk::Fixed` the narrowest
runtime experiment for [tauri-apps/tauri#16132](https://github.com/tauri-apps/tauri/issues/16132).

The vendored runtime is an exact Cargo-registry copy at commit `226893c`; its two
licenses are retained. The spike changes are isolated behind Linux target guards
and can be inspected with:

```text
git diff 226893c..d781f57 -- src-tauri/vendor/tauri-runtime-wry/src/lib.rs
```

## Results by step

1. **Vendor runtime:** passed. Cargo resolved `tauri-runtime-wry` from
   `src-tauri/vendor/tauri-runtime-wry`, and the vendored crate built unchanged.
2. **Add `gtk::Fixed`:** built and launched. One named fixed container was packed
   into the default vbox with expand/fill, with the window-content webview added
   before child webviews.
3. **Persist geometry:** built. Child `set_bounds`, `set_size`, and `set_position`
   operations also call `Fixed::move_` and set the logical size request. A fixed
   size-allocation callback attempts to keep the content webview full-window.
4. **Use embedded app path:** compiled and launched. Authentication remained in a
   separate plain window; trusted non-auth Academy pages used the child webview,
   shared persistent data directory, and post-load enhancement. On opening the
   child, the main window immediately entered continuous growth and was not
   interactive. Testing stopped as required. A later GDK broken-pipe message was
   emitted only when the failed process was intentionally terminated.

## Failure analysis

The fixed container is packed into the default vbox with expand/fill. Its
`size-allocate` callback assigns the content webview a size request equal to the
container allocation. That child request then contributes to the parent's natural
size, producing a requisition/allocation feedback loop: each allocation requests a
larger content area and the top-level window grows again. The embedded Academy
child shares the same fixed container, so GTK remains busy relaying out the widget
tree and normal input cannot be used.

This invalidates the assumption that a `gtk::Fixed` can both participate normally
in Tauri's vbox and have its content child sized by `set_size_request`. A viable
runtime fix likely needs a custom container/allocation implementation (or an
upstream Tauri/Wry change) that allocates overlays without allowing their requested
size to determine the parent window's natural size.

## Manual checklist

- Course occupies the exact Web View slot: **failed** (unbounded window growth)
- Main-window resize and sidebar movement: **blocked**
- Pointer input and scrolling: **failed** (window not interactive; no pointer crash
  observed before termination)
- Login then course in embedded view: **blocked**
- Back/forward and SPA navigation: **blocked**
- Close/reopen and session reuse: **blocked**
- Theme synchronization: **blocked**
- Video playback: **blocked**
- 100% and fractional scaling: **blocked**
- Native X11 session: **not tested**
- Native Wayland session: **not tested**

No screenshot was captured because the window did not reach a stable geometry.

## Automated checks after the spike

- `npm test`: 23/23 Node tests and 28/28 Playwright tests passed
- `npx tsc --noEmit`: passed
- `npm run test:browser`: 28/28 passed
- `cargo test`: 25 passed, 0 failed, 1 ignored
- `cargo fmt --check`: passed
- `cargo clippy --all-targets --all-features -- -D warnings`: passed

## Reproduction

From WSL, start the frontend and then the Tauri app using the WSL-visible frontend
address. Open a signed-in course so the non-auth child path is selected. The main
window begins expanding continuously as soon as the child webview is mounted.

Relevant commits:

- `226893c` — vendor `tauri-runtime-wry` 2.12.1
- `ad61ffc` — mount Linux webviews in `gtk::Fixed`
- `d781f57` — persist embedded webview geometry
- `f383ace` — exercise the embedded Academy app path
