/**
 * isNativeDialogOpen — true when a native `<dialog>` (PhotoViewer.tsx, #508,
 * or RouteStrip.tsx's Steps sheet, #531) is showing modally anywhere in the
 * document.
 *
 * WHY this exists: BottomSheet.tsx and DesktopVenueWindow.tsx each own
 * their own Escape-to-dismiss-the-whole-card handling, and neither can be
 * fixed by adding a competing keydown listener inside PhotoViewer.tsx —
 * verified against the installed source, not assumed:
 *
 *   - BottomSheet's vaul `Drawer.Content` renders Radix's
 *     `@radix-ui/react-dialog` under the hood (vaul never forwards its own
 *     `modal` prop to Radix's `Dialog.Root`, so Radix always treats it as
 *     `modal=true` regardless of vaul's setting — confirmed in
 *     node_modules/vaul/dist/index.mjs). Radix's `DismissableLayer` listens
 *     for Escape via `@radix-ui/react-use-escape-keydown`, which attaches
 *     to `document` in the CAPTURE phase (confirmed in
 *     node_modules/@radix-ui/react-use-escape-keydown/dist/index.mjs).
 *     Capture visits `document` — the topmost ancestor — before ANY
 *     descendant, including PhotoViewer's own `<dialog>`, so a listener
 *     anywhere in the subtree (any phase) always runs too late to
 *     `stopPropagation()` ahead of it. The only interception point is
 *     `Drawer.Content`'s own `onEscapeKeyDown` prop, which vaul forwards
 *     straight through to Radix's `DismissableLayer` (confirmed: vaul's
 *     `Content` spreads `...rest` into `DialogPrimitive.Content` without
 *     touching `onEscapeKeyDown`, and Radix's `DialogContentImpl` spreads
 *     `...contentProps` onto `DismissableLayer` the same way).
 *     `DismissableLayer` calls that prop, then dismisses only
 *     `if (!event.defaultPrevented)` — so `event.preventDefault()` inside
 *     it is the one race-free way to cancel the dismiss (it runs
 *     synchronously INSIDE Radix's own listener call, not as a second,
 *     independently-ordered listener).
 *   - DesktopVenueWindow's own Escape handling is a plain BUBBLE-phase
 *     `document.addEventListener("keydown", ...)` (no options — bubble by
 *     default) — same fix shape, checked directly inside that handler.
 *
 * A plain existence check (rather than tracing the event target through the
 * open dialog) is deliberate and sufficient: this repo has exactly two
 * dialog-based components (never more than one open at once — PhotoViewer
 * only mounts inside a box card, RouteStrip's sheet only while a route is
 * active, and neither opens the other), and the guard only needs to answer
 * "is SOME modal dialog currently showing" — see vitest.setup.ts's own note
 * for why the jsdom Escape-closes-dialog polyfill defers via
 * `queueMicrotask` rather than closing synchronously: it must not flip this
 * to `false` before the guards above get to read it during the SAME
 * keydown's dispatch.
 */
export function isNativeDialogOpen(): boolean {
  return typeof document !== "undefined" && document.querySelector("dialog[open]") !== null;
}
