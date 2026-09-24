'use client';

/**
 * Client-side map/splash-gate body for the homepage — mounted inside the
 * server-rendered shell in page.tsx.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #4
 *
 * Split out of page.tsx (SEO PR1): a Client Component's first render is
 * always empty until effects resolve, so leaving all of this in page.tsx
 * meant crawlers — and the ItemList JSON-LD that used to live in this same
 * component — never got real markup in the server response. page.tsx is now
 * a synchronous Server Component that emits the JSON-LD + a sr-only <h1> +
 * metadata unconditionally, then mounts this component for the interactive
 * body. See page.tsx's header for the full rationale.
 *
 * localStorage key 'pfm.splash.seen.v2' gates the splash:
 * - Not set → show SplashScreen as a frosted overlay above the live map
 * - Set to '1' → skip directly to the interactive map (no overlay)
 *
 * The map is ALWAYS mounted so the basemap is visible behind the splash.
 * The splash overlay sits at z-[9000] and makes the map non-interactive
 * via the inert + aria-hidden attributes passed down to MapWrapper while
 * splashShown is true.
 *
 * Renders null during the initial SSR-safe render to avoid a hydration
 * mismatch (localStorage is unavailable server-side) — this no longer costs
 * crawlers real markup, since page.tsx's synchronous server output (JSON-LD,
 * sr-only <h1>, metadata) renders above this component regardless.
 *
 * #99: showSplashAgain() re-shows the splash overlay WITHOUT clearing
 * localStorage (so future page loads still skip straight to the map).
 * Pass down as onShowWelcome to MapWrapper → HamburgerMenu.
 *
 * #202: MapWrapper and SplashScreen are loaded via next/dynamic (ssr:false)
 * to code-split their JS (vaul, Radix UI, geolocation hooks, venue data) into
 * async chunks. WHY: this component already returns null during SSR
 * (hydration-safe), so ssr:false has no effect on server output — it only
 * moves parse/exec off the blocking initial JS load, reducing TBT on
 * throttled mobile.
 *
 * #589's useDocumentTitle call for '/' lives in MapWrapper.tsx, NOT here,
 * on purpose: MapWrapper already imports the i18n dictionary and is
 * unconditionally rendered whenever this component renders anything real,
 * but it's one of the #202 dynamic()'d chunks above. Calling t()/i18n.ts
 * directly from this file (the synchronous, always-blocking part of the
 * route's JS) would pull the whole dictionary out of that deferred chunk
 * and into the initial payload every low-end-phone visitor downloads
 * before first paint — for one <title> string. See MapWrapper.tsx's own
 * comment at its useDocumentTitle call.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// WHY dynamic + ssr:false: MapWrapper pulls in vaul, Radix UI, geolocation
// hooks, and all venue UI. None of it is needed during SSR (this component
// already returns null). Code-splitting it defers ~200KB of parse/exec off
// the blocking JS window — the primary TBT lever for #202.
const MapWrapper = dynamic(() => import('@/components/MapWrapper'), {
  ssr: false,
  loading: () => null,
});

// WHY dynamic: SplashScreen imports the geolocation hook and locale context
// eagerly; deferring it alongside MapWrapper keeps the async chunk boundary clean.
const SplashScreen = dynamic(() => import('@/components/SplashScreen'), {
  ssr: false,
  loading: () => null,
});

const GATE_KEY = 'pfm.splash.seen.v2';

function readGate(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(GATE_KEY) === '1';
}

export default function HomePageClient() {
  // null = not yet determined (SSR-safe: avoids flash of wrong content).
  // We initialize to null so the server renders nothing, then the client
  // effect determines the true value without a hydration mismatch.
  const [splashShown, setSplashShown] = useState<boolean | null>(null);
  const [viewport, setViewport] = useState<'located' | 'pueblo-center'>('pueblo-center');
  // Deep link (#132): a ?venue=<id> URL opens straight to that pin.
  const [initialVenueId, setInitialVenueId] = useState<string | null>(null);
  // Boxes (#516): "Boxes" on a Menu page (PageNav, no map/filter state of its
  // own) links to /?boxes=1 — read once below, same as ?near=1, and applied
  // by MapWrapper's own one-shot effect.
  const [initialBoxesFilter, setInitialBoxesFilter] = useState(false);

  // Ref to the map container element — focus moves here on splash dismiss.
  const mapContainerRef = useRef<HTMLElement | null>(null);

  // One-shot: read localStorage after first mount. useRef guards re-entry.
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Wrap in a scheduler callback to avoid the set-state-in-effect lint rule,
    // which flags synchronous setState in effect bodies. The queueMicrotask
    // ensures we're in the microtask queue, not the synchronous effect body.
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      const venueParam = params.get('venue');
      // "Near me" in the bottom nav on a Menu page (PageNav) links to /?near=1:
      // open the map and locate, as the splash's "Find food near me" does.
      const nearParam = params.get('near') === '1';
      if (nearParam) {
        setViewport('located');
        // Strip it so a refresh doesn't locate again.
        params.delete('near');
        const qs = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      }
      // "Boxes" in the bottom nav on a Menu page (PageNav) links to
      // /?boxes=1: same read-once-then-strip shape as near, above.
      const boxesParam = params.get('boxes') === '1';
      if (boxesParam) {
        setInitialBoxesFilter(true);
        params.delete('boxes');
        const qs = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      }
      // Also read #venue=<id> fragment: used by /venue/[id]'s "View on the map"
      // CTA. There's no /?venue= → /venue/<id> redirect to bypass (next.config.ts
      // removed it — a `has`-query redirect on "/" 500'd on OpenNext/Cloudflare,
      // see that file's 2026-06-20 hotfix note); PageNav's saved-venue links use
      // the plain query form instead, and both land here and are read client-side.
      const hashParam = window.location.hash.startsWith('#venue=')
        ? window.location.hash.slice('#venue='.length)
        : null;
      const resolvedId = venueParam ?? hashParam;
      setInitialVenueId(resolvedId);
      // A shared venue link (either form) goes straight to the pin — skip the splash.
      // Near me and Boxes both come from inside the app (PageNav), so the
      // splash was already seen.
      setSplashShown(resolvedId || nearParam || boxesParam ? false : !readGate());
    });
  }, []);

  const dismissSplash = useCallback((mode: 'located' | 'pueblo-center') => {
    localStorage.setItem(GATE_KEY, '1');
    setViewport(mode);
    setSplashShown(false);
    // Move focus to the map container so keyboard users land on the map.
    // setTimeout 0 gives React time to flush the state update and remove inert.
    setTimeout(() => {
      mapContainerRef.current?.focus();
    }, 0);
  }, []);

  /**
   * Re-show the splash on demand (#99: "Show welcome screen" menu item).
   * Does NOT clear the localStorage gate — future page loads still skip it.
   * The user returns to the map (with same state) after re-dismissing.
   */
  const showSplashAgain = useCallback(() => {
    setSplashShown(true);
  }, []);

  // SSR-safe: render nothing until we know whether splash is needed
  if (splashShown === null) return null;

  return (
    <>
      {/* Map is always mounted — visible behind the splash overlay when splash is shown */}
      <main
        className="flex-1 flex flex-col min-h-0"
        ref={mapContainerRef}
        // tabIndex makes the container focusable so we can move focus here on dismiss.
        tabIndex={-1}
        // While the splash is up: block keyboard navigation and screen-reader access
        // to the behind-map. inert covers pointer, keyboard, and focus; aria-hidden
        // covers the AT tree. Both are removed on dismiss.
        inert={splashShown || undefined}
        aria-hidden={splashShown || undefined}
      >
        <MapWrapper
          viewport={viewport}
          onShowWelcome={showSplashAgain}
          initialVenueId={initialVenueId}
          initialBoxesFilter={initialBoxesFilter}
        />
      </main>

      {/* Splash overlay — full-viewport frosted scrim on top of the map */}
      {splashShown && (
        <SplashScreen
          onPrimary={(mode) => dismissSplash(mode)}
        />
      )}
    </>
  );
}
