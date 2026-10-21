# Linux embedded Academy webview spike

## Verdict

**Viable in the tested WSLg environment with the overlay runtime patch.** A
`gtk::Overlay` owns the window-content webview as its main child and a
pass-through `gtk::Fixed` layer for positioned child webviews. The window no
longer grows, both webviews remain interactive, and the Academy child follows its
slot through resize and sidebar changes.

X11 rendered correctly without an additional WebKit setting. Wayland layout and
input were also correct, but WSLg showed a blank gray compositor surface until
`WEBKIT_DISABLE_DMABUF_RENDERER=1` was set. That is a WebKitGTK/WSLg rendering
workaround, not a layout workaround. `WEBKIT_DISABLE_COMPOSITING_MODE=1` was not
needed.

## Test environment

- Windows host with WSL2 and WSLg
- Ubuntu 24.04.1 LTS (Noble)
- `DISPLAY=:0`
- `WAYLAND_DISPLAY=wayland-0`
- `XDG_SESSION_TYPE`, `XDG_CURRENT_DESKTOP`, and `DESKTOP_SESSION` unset
- WebKitGTK 4.1 2.52.6
- Rust 1.99.1

This is a WSLg run, not a complete native-desktop matrix. WSLg exposed both X and
Wayland display sockets while leaving `XDG_SESSION_TYPE` unset, so the backends
were selected explicitly with `GDK_BACKEND=x11` and `GDK_BACKEND=wayland`.

## Baseline

Before the spike changes:

- `npm test`: 23/23 passed
- `npx tsc --noEmit`: passed
- `npm run test:browser`: 28/28 passed
- `cargo test`: 25 passed, 0 failed, 1 ignored
- the existing Linux Academy implementation opened a stable, interactive separate
  window

## Upstream behavior confirmed

In unmodified `tauri-runtime-wry` 2.12.1, Linux `WindowChild` and
`WindowContent` webviews are both built into the window's `default_vbox` rather
than a coordinate-aware child container. Wry 0.57.0 already has a `gtk::Fixed`
child path that applies bounds with `move_` and a size request, making a narrow
runtime patch possible for
[tauri-apps/tauri#16132](https://github.com/tauri-apps/tauri/issues/16132).

The vendored runtime is an exact Cargo-registry copy at commit `226893c`; its two
licenses are retained. The Linux-only patch can be inspected with:

```text
git diff 226893c -- src-tauri/vendor/tauri-runtime-wry/src/lib.rs
```

## Results by step

1. **Vendor runtime:** passed. Cargo resolves `tauri-runtime-wry` from
   `src-tauri/vendor/tauri-runtime-wry`.
2. **Initial `gtk::Fixed`:** reproduced the continuous-growth failure. Giving the
   window-content webview an allocation-sized minimum request created a feedback
   loop under WSLg client-side decorations.
3. **Replace the root Fixed with an overlay:** passed. The window-content webview
   is the overlay main child and fills it without a size request. Child webviews
   use one pass-through Fixed overlay layer.
4. **Persist child geometry:** passed. Child `set_bounds`, `set_size`, and
   `set_position` operations call `Fixed::move_` and update the child size request
   together, without allowing the layer to affect the window's requested size.
5. **Use the embedded app path:** passed in WSLg. Authentication remains in a
   separate plain window; trusted signed-in Academy pages use the embedded child,
   shared persistent data directory, and post-load enhancement.
6. **Fullscreen session sharing:** passed after the fullscreen window was moved
   onto the same persistent Academy data directory.

## Failure analysis and overlay design

The failed design put both content and child webviews in one `gtk::Fixed`, then
called `set_size_request(allocation)` on the window-content webview from the
Fixed's `size-allocate` callback. That minimum request contributed to the parent's
next natural size, producing a requisition/allocation feedback loop and continuous
window growth.

The working design packs one expanding `gtk::Overlay` into Tauri's default vbox.
Wry adds the window-content webview as the overlay's main child, so GTK allocates
it to the available area without an explicit size request. A named `gtk::Fixed`
is added with `add_overlay` for child webviews, and the layer is pass-through so
input outside a child reaches the content webview. Overlay children do not
contribute to the overlay's minimum size. Only actual child webviews receive size
requests, so their bounds cannot ratchet the top-level window.

## Manual checklist

- Course occupies the exact Web View slot: **passed on X11 and Wayland**
- Window resize both smaller and larger: **passed on X11 and Wayland**
- Sidebar collapse and slot movement: **passed on X11 and Wayland**
- Pointer input in shell and Academy view: **passed on X11 and Wayland**
- Login then signed-in course in embedded view: **passed**
- Fullscreen promotion, authenticated content, and demotion: **passed**
- Wayland rendering: **passed with `WEBKIT_DISABLE_DMABUF_RENDERER=1`**
- Back/forward and broader SPA navigation: **not fully exercised**
- Keyboard focus across both webviews: **not explicitly recorded**
- Theme and structural navigation hiding: **not explicitly rerun**
- Playback resume and per-course restore: **not explicitly rerun**
- Retain page/scroll/video while switching shell views: **automated coverage
  passed; manual WSLg check not rerun after the merge**
- Sign out and back in: **not testable; the app has no sign-out action**
- Open-in-a-window fallback: **not explicitly rerun**
- 100% and 200% scaling: **not explicitly recorded**

## Automated checks after the overlay and retain-view merge

- Windows `npm test`: 25/25 Node tests and 30/30 Playwright tests passed
- `npx tsc --noEmit`: passed on Windows and WSL
- Windows `npm run test:browser`: 30/30 passed
- `cargo test`: 25 passed, 0 failed, 1 ignored on Windows and WSL
- `cargo fmt --check`: passed on Windows and WSL
- `cargo clippy --all-targets -- -D warnings`: passed on Windows and WSL

The 25 Node tests also passed inside WSL. WSL Playwright could not launch because
the repository selects the `msedge` channel and Microsoft Edge was not installed
at `/opt/microsoft/msedge/msedge`; the Linux CI workflow does not run browser
tests.

## Reproduction

From WSL, select a backend explicitly because WSLg does not set
`XDG_SESSION_TYPE`. Wayland currently also needs the WebKitGTK renderer workaround:

```text
GDK_BACKEND=x11 npm run tauri dev
GDK_BACKEND=wayland WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev
```

Relevant commits:

- `226893c` — vendor `tauri-runtime-wry` 2.12.1
- `ad61ffc` — mount Linux webviews in `gtk::Fixed`
- `d781f57` — persist embedded webview geometry
- `f383ace` — exercise the embedded Academy app path
- `bef58bf` — add the overlay and pass-through child layer
- `3c72c98` — route content and child webviews into their proper containers
- `c18bf49` — apply child bounds atomically
