"use client";

/**
 * useMediaQuery — true while `query` matches. One hook for every breakpoint
 * (it replaced copies of `useIsMobile` in MapWrapper and HamburgerMenu when
 * the bottom nav, docs/bottom-nav-spec.md, needed a second breakpoint).
 *
 * WHY useSyncExternalStore (#721): the old useState(false) + effect version
 * returned false on the first client render and synced a tick later, so on
 * a phone MapWrapper's "not mobile → prefetch DesktopVenueWindow" effect ran
 * once and downloaded the desktop card. A component that mounts on the
 * client (MapWrapper is ssr:false) now reads the real value straight away.
 * During hydration of a server-rendered page React uses the server snapshot
 * (`false`, what the server rendered) and re-renders with the real value
 * right after, so there is no hydration mismatch (HamburgerMenu on content
 * pages).
 */

import { useCallback, useSyncExternalStore } from "react";

/** Phone: below Tailwind `md` — BottomSheet instead of the desktop venue window. */
export const MOBILE_QUERY = "(max-width: 767px)";
/** Below Tailwind `2xl` (1536px) — bottom nav bar instead of the inline nav pill (spec §5). */
export const BELOW_2XL_QUERY = "(max-width: 1535px)";

/**
 * One-shot read of the user's reduced-motion setting, for camera moves that
 * pick a duration at call time (no re-render needed). SSR-safe, and the
 * optional chaining keeps it safe in jsdom tests that never stub matchMedia.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
  );
}

const serverSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // Optional chaining: jsdom has no matchMedia, and many tests render
      // these components without stubbing it (same as prefersReducedMotion).
      const mql = window.matchMedia?.(query);
      mql?.addEventListener("change", onChange);
      return () => mql?.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = () => window.matchMedia?.(query)?.matches === true;
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
