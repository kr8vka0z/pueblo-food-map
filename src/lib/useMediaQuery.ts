"use client";

/**
 * useMediaQuery — true while `query` matches. SSR-safe: starts false on both
 * server and first client render (no hydration mismatch), then syncs.
 *
 * WHY the setTimeout for the initial sync: calling setState synchronously in
 * the effect body trips the react-hooks/set-state-in-effect lint rule
 * (cascading render). This was copy-pasted in MapWrapper and HamburgerMenu as
 * `useIsMobile` before the bottom nav (docs/bottom-nav-spec.md) needed a
 * second breakpoint — one hook now serves both.
 */

import { useEffect, useState } from "react";

/** Phone: below Tailwind `md` — BottomSheet instead of the desktop venue window. */
export const MOBILE_QUERY = "(max-width: 767px)";
/** Below Tailwind `xl` — bottom nav bar instead of the inline nav pill (spec §5). */
export const BELOW_XL_QUERY = "(max-width: 1279px)";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    const syncId = setTimeout(() => setMatches(mql.matches), 0);
    return () => {
      clearTimeout(syncId);
      mql.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}
