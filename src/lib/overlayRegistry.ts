"use client";

/**
 * Overlay registry (#542) — the single source of truth for "is any
 * full-surface overlay open right now," so BottomNav can hide under one rule
 * instead of a bespoke boolean per overlay. Before this file, MapWrapper.tsx's
 * `venueSheetOpen`/`stripVisible` had already hand-rolled the same "hide the
 * nav" decision once, and each later overlay (the Menu, the Filters panel,
 * PhotoViewer, the route steps sheet) either forgot to hide the nav at all
 * (#542's bug report) or would have needed a THIRD copy of the same wiring.
 *
 * Module-level singleton, not React context: HamburgerMenu/FilterPanel mount
 * both under MapWrapper (the map page) and under PageNav (every non-map Menu
 * page), which share no common ancestor closer than the root layout — a
 * Context.Provider would need wrapping there for no benefit over a plain
 * external store that `useSyncExternalStore` already reads safely across
 * separate render trees.
 *
 * A Set keyed by a stable per-instance id (`useId`), not a bare counter: a
 * bare number can double-increment/decrement if the same instance's effect
 * re-fires (React Strict Mode's dev-only double-invoke, or a fast re-render
 * racing its own cleanup) — a Set's add/delete is idempotent, so the same id
 * added twice is still one entry, and deleting an id that's already gone is a
 * no-op.
 *
 * #542 deliberately left two things out ("don't build this now, just don't
 * block it"): absorbing the duplicated `document.body.style.overflow` locks
 * (HamburgerMenu.tsx/FilterPanel.tsx each owned a copy) and the Escape-
 * ordering problem — closing every open overlay instead of just the
 * top-most one. #527 built both ON TOP of this file, per that plan:
 *
 *   - `useOverlayStackId`/`isTopmostOverlay` — a SEPARATE ordered stack
 *     (`overlayStack`, an array, not the Set above) from `openOverlayIds`.
 *     The Set only ever needed a count; Escape-ordering needs to know WHICH
 *     overlay opened most recently, which a Set (unordered) can't answer.
 *   - `useOverlayEscape` — the common case built on those two: register,
 *     then a bubble-phase `document` keydown listener that calls its
 *     `onEscape` ONLY while this instance is topmost. Covers every overlay
 *     that owns a plain `document.addEventListener` Escape handler
 *     (FilterPanel, HamburgerMenu, DesktopVenueWindow). BottomSheet.tsx is
 *     the one exception — vaul/Radix routes Escape through `Drawer.Content`'s
 *     own `onEscapeKeyDown` prop, not a listener this file could intercept
 *     (see dialogGuard.ts's header for why), so it calls
 *     `useOverlayStackId`/`isTopmostOverlay` directly instead of this hook.
 *   - `useScrollLock` — a module-level `scrollLockCount`, incremented while
 *     `isLocked` and decremented on release; `document.body.style.overflow`
 *     only clears once the count reaches zero, so closing one of two
 *     locking overlays no longer unlocks scroll out from under the other.
 */

import { useEffect, useId, useLayoutEffect, useSyncExternalStore } from "react";

const openOverlayIds = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return openOverlayIds.size > 0;
}

// SSR: no overlay can be "open" before hydration (there is no pointer/
// keyboard input yet to have opened one), so the server snapshot is always
// false — this also satisfies Next's hydration-mismatch rule, since the
// server-rendered HTML and the client's first render must agree.
function getServerSnapshot() {
  return false;
}

// `useLayoutEffect` is a no-op (with a console warning) during SSR. This
// repo's overlay components are all "use client" but Next 16 still renders
// them once on the server for the initial HTML, so guard for that environment
// rather than importing a "use client" hook that assumes a browser. Falling
// back to a no-op there is safe: per `getServerSnapshot` above, nothing can
// be open on that first server-rendered pass anyway, so there is nothing to
// register that early — this guard only silences React's console warning.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : () => {};

/**
 * Registers this component instance as an open overlay while `isOpen` is
 * true. Call unconditionally on every render (React's hooks rule) — pass
 * straight through the overlay's own `open`/`isOpen` prop.
 *
 * `useLayoutEffect`, not `useEffect`: registration must land in the SAME
 * commit that opens the overlay, before the browser paints, or BottomNav
 * (subscribed via `useAnyOverlayOpen`) paints one visible frame over the
 * overlay before hiding on the next frame — a flicker regression against
 * today's render-synchronous `{!venueSheetOpen && <BottomNav/>}`.
 */
export function useOverlayRegistration(isOpen: boolean): void {
  const id = useId();
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    openOverlayIds.add(id);
    notify();
    return () => {
      openOverlayIds.delete(id);
      notify();
    };
  }, [isOpen, id]);
}

/** True while at least one registered overlay is open — BottomNav's hide signal. */
export function useAnyOverlayOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ─── Escape ordering + shared scroll lock (#527) ───────────────────────────

// Ordered (not a Set): last element is the most-recently-opened overlay
// still on the stack, i.e. the one Escape should act on.
const overlayStack: string[] = [];

/**
 * Registers this overlay's stable id in stack order while `isOpen`, and
 * returns that id. Most callers want `useOverlayEscape` below instead — this
 * lower-level hook exists for BottomSheet.tsx, which can't add its own
 * `document` keydown listener (vaul/Radix's Escape handling has to be
 * intercepted through `Drawer.Content`'s `onEscapeKeyDown` prop instead —
 * see dialogGuard.ts) and so calls `isTopmostOverlay(id)` itself from
 * inside that callback.
 */
export function useOverlayStackId(isOpen: boolean): string {
  const id = useId();
  useEffect(() => {
    if (!isOpen) return;
    overlayStack.push(id);
    return () => {
      const idx = overlayStack.indexOf(id);
      if (idx !== -1) overlayStack.splice(idx, 1);
    };
  }, [isOpen, id]);
  return id;
}

/** True while `id` is the most-recently-opened overlay still on the stack. */
export function isTopmostOverlay(id: string): boolean {
  return overlayStack.length > 0 && overlayStack[overlayStack.length - 1] === id;
}

// PR #604 review (real-browser hole `isTopmostOverlay` alone doesn't close):
// a single Escape keydown can be seen by MULTIPLE listeners across capture
// and bubble phase (BottomSheet's Escape handling is a capture-phase
// listener — Radix's DismissableLayer, see dialogGuard.ts's header — while
// FilterPanel/HamburgerMenu/DesktopVenueWindow are bubble-phase, via
// `useOverlayEscape` below). Per the WHATWG HTML event-dispatch algorithm, a
// microtask checkpoint runs after EACH individual listener invocation
// ("clean up after running script"), not just once dispatch finishes — so if
// the FIRST listener to run (the true topmost, e.g. a capture-phase
// BottomSheet) closes its overlay, and that close synchronously commits
// (React's automatic batching flushes via a microtask for updates
// originating outside its own synthetic event system), `overlayStack`'s
// cleanup effect pops that id BEFORE the next listener for the SAME keydown
// runs — so a bubble-phase overlay underneath, no longer merely
// `isTopmostOverlay`-false, now reads as topmost too and ALSO closes.
// jsdom's `dispatchEvent` doesn't insert that checkpoint between listeners
// (confirmed against jsdom's dispatch implementation), which is why this
// never reproduced under the original `isTopmostOverlay`-only tests — see
// overlayStack.test.ts's "real DOM dispatch ordering" describe block, which
// forces the same observable stack-pop-mid-dispatch directly instead of
// relying on jsdom to reproduce the browser's microtask timing.
//
// Fixed by claiming the Event OBJECT itself, once, module-wide: whichever
// listener is first to see itself as topmost AND find the event unclaimed
// wins outright, and every other listener for that SAME event — regardless
// of what the stack looks like by the time it runs — is rejected. A
// WeakSet (not a boolean flag) keys by the event instance so unrelated later
// keydowns aren't affected and nothing needs manual clearing/GC.
const claimedEscapes = new WeakSet<Event>();

/**
 * Claims `event` for `id`, exactly once. Returns true only if `id` is
 * currently topmost AND no earlier listener has already claimed this SAME
 * event object — a caller that loses the claim must `preventDefault()` and
 * do nothing (not act on `defaultPrevented` itself: BottomSheet's own
 * preventDefault-when-not-topmost would otherwise make the real topmost
 * overlay's later check see `defaultPrevented` and wrongly skip too — see
 * BottomSheet.tsx's `onEscapeKeyDown`).
 */
export function claimEscape(id: string, event: Event): boolean {
  if (claimedEscapes.has(event)) return false;
  if (!isTopmostOverlay(id)) return false;
  claimedEscapes.add(event);
  return true;
}

/**
 * Escape closes only the TOPMOST overlay (#527). Registers via
 * `useOverlayStackId`, then a bubble-phase `document` keydown listener that
 * calls `onEscape` ONLY when `claimEscape` succeeds for this instance — so a
 * second overlay opened on top of a first (Filters over a selected venue
 * card, the Menu over a card, etc.) no longer also closes the one
 * underneath, since every overlay used to run its own Escape handler with
 * nothing to stop the other ones from reacting to the same keydown.
 *
 * `onEscape` should be stable (`useCallback`) — it's an effect dependency,
 * so an inline arrow function would tear the listener down and re-add it
 * every render.
 */
export function useOverlayEscape(isOpen: boolean, onEscape: (event: KeyboardEvent) => void): void {
  const id = useOverlayStackId(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!claimEscape(id, event)) return;
      onEscape(event);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, id, onEscape]);
}

// Ref-counted, not a boolean: two overlays can each want the lock at once
// (Filters open over the Menu, etc.) — the old per-component
// `document.body.style.overflow = open ? "hidden" : ""` had each overlay
// stomp the other's lock on its own close.
let scrollLockCount = 0;

/**
 * Shared body-scroll lock (#527). `isLocked` increments/decrements a module
 * counter instead of writing `document.body.style.overflow` directly —
 * `overflow` only clears once every locker has released it, so closing one
 * of two overlays that both want the lock leaves the other's scroll still
 * locked.
 */
export function useScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    scrollLockCount++;
    document.body.style.overflow = "hidden";
    return () => {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.body.style.overflow = "";
    };
  }, [isLocked]);
}
