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
 * Deliberately NOT built yet (issue #542's own "don't build this now, just
 * don't block it"): absorbing the duplicated `document.body.style.overflow`
 * locks (HamburgerMenu.tsx/FilterPanel.tsx each own a copy) and the Escape-
 * ordering problem in #527. Both fit naturally on top of this same registry
 * later — a `useOverlayRegistration` call already knows exactly when its
 * overlay is the topmost/only one open — but neither is needed to satisfy
 * #542's acceptance criteria, so neither is here.
 */

import { useId, useLayoutEffect, useSyncExternalStore } from "react";

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
