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
 * The splash is server-rendered (and in the first client render) with
 * `pending`, so a first-time visitor sees it at first paint instead of after
 * ~180 KB of JS hydrates. localStorage and the URL are unknown server-side, so
 * `splashShown` starts null and the layout effect below resolves it. Returning
 * visitors and deep links never see the pending splash: on a full page load,
 * page.tsx's inline SPLASH_GATE_SCRIPT sets a data attribute on <html> before
 * it is parsed and globals.css hides it until React unmounts it; on
 * client-side navigation the script doesn't run, but the layout effect
 * resolves the gate before the browser paints. <main>/MapWrapper mount only
 * once resolved. page.tsx's synchronous server output (JSON-LD, sr-only <h1>)
 * renders above this component regardless.
 *
 * #99: showSplashAgain() re-shows the splash overlay WITHOUT clearing
 * localStorage (so future page loads still skip straight to the map).
 * Pass down as onShowWelcome to MapWrapper → HamburgerMenu.
 *
 * #202: MapWrapper is loaded via next/dynamic (ssr:false) to code-split its
 * JS (vaul, Radix UI, geolocation hooks, venue data) into an async chunk.
 * SplashScreen was too, until the mobile-LCP fix (static import below). WHY:
 * MapWrapper only mounts after the gate resolves client-side, so it is never
 * in server output either way — ssr:false only moves parse/exec off the
 * blocking initial JS load, reducing TBT on throttled mobile.
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
 *
 * #588: MapWrapper's mapbox-gl load (already deferred by #226) is HELD
 * (`holdMapLoad={splashShown === true}`) while the splash overlay is up for a
 * first-time visitor — mapbox-gl's own parse/exec (~530ms at 4x CPU
 * throttle) dominates mobile TBT/TTI, and #226's idle-callback used to fire
 * it during the ~2s a visitor is still reading the splash (the map is inert
 * underneath — nothing is waiting on it yet). A tap on either splash CTA
 * still starts the load immediately regardless of the hold (window-level
 * capture listeners see it — see useDeferredMapLoad's module doc), so real
 * visitors don't wait any longer than before; only Lighthouse's synthetic
 * never-interacts run, and a visitor who reads for a while before tapping,
 * stop paying that cost early. Returning visitors (no splash) are
 * unaffected — MapWrapper first mounts with `splashShown` already `false`.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { readSplashGate, markSplashSeen, resolveVenueId, shouldSkipSplash } from '@/lib/splashGate';
// WHY a static import (mobile LCP): the splash's purpose line IS the LCP
// element. As a next/dynamic({ssr:false}) chunk it was only discovered after
// hydration, then loaded through Turbopack's async-loader -> chunk levels, so
// on slow 4G the text painted ~4 s in (Lighthouse devtools throttling, local
// prod build: LCP 4.3 s -> 2.8 s, element render delay ~400 ms -> ~50 ms with
// this change). Statically importing it puts it in the same parallel chunk
// wave as the rest of the page. Cost: the splash code (small; the i18n
// dictionary loads a moment later for the map anyway) ships to returning
// visitors who skip the splash. MapWrapper stays dynamic: it is the heavy part.
import SplashScreen from '@/components/SplashScreen';
import type { LocationFailure } from '@/lib/useGeolocation';

// WHY dynamic + ssr:false: MapWrapper pulls in vaul, Radix UI, geolocation
// hooks, and all venue UI. None of it is needed during SSR (it only mounts
// once the gate resolves). Code-splitting it defers ~200KB of parse/exec off
// the blocking JS window — the primary TBT lever for #202.
const MapWrapper = dynamic(() => import('@/components/MapWrapper'), {
  ssr: false,
  loading: () => null,
});

// GATE_KEY itself lives in src/lib/splashGate.ts (#689 PR 2 follow-up
// review fix) — see that file's header for why it's not defined here:
// SplashScreen's cross-tree CTA case needs markSplashSeen() too, and
// SplashScreen is mounted BY this file via next/dynamic below, so a
// shared module avoids a circular import between the two.


export default function HomePageClient() {
  // null = not yet determined (localStorage/URL are unknown server-side). The
  // server and first client render both show the splash as `pending` and no
  // map; the layout effect then resolves the true value without a hydration
  // mismatch.
  const [splashShown, setSplashShown] = useState<boolean | null>(null);
  const [viewport, setViewport] = useState<'located' | 'pueblo-center'>('pueblo-center');
  // Why the splash's "Find food near me" produced no position, if it didn't (#739);
  // handed to MapWrapper, which shows LocationHelpCard for it.
  const [splashLocationFailure, setSplashLocationFailure] = useState<LocationFailure | null>(null);
  // Deep link (#132): a ?venue=<id> URL opens straight to that pin.
  const [initialVenueId, setInitialVenueId] = useState<string | null>(null);
  // Deep link (#758): a ?event=<id> URL opens with that event's star pin selected.
  // Read here with plain URLSearchParams (not src/lib/eventPins.ts) because this
  // file is the route's blocking bundle and eventPins pulls in the i18n dictionary.
  const [initialEventId, setInitialEventId] = useState<string | null>(null);
  // Boxes (#516): "Boxes" on a Menu page (PageNav, no map/filter state of its
  // own) links to /?boxes=1 — read once below, same as ?near=1, and applied
  // by MapWrapper's own one-shot effect.
  const [initialBoxesFilter, setInitialBoxesFilter] = useState(false);

  // Ref to the map container element — focus moves here on splash dismiss.
  const mapContainerRef = useRef<HTMLElement | null>(null);

  // One-shot: read localStorage and the URL on mount. useRef guards re-entry.
  const initialized = useRef(false);

  // WHY a layout effect with direct setState: on client-side navigation to "/"
  // the inline SPLASH_GATE_SCRIPT never runs (React doesn't execute scripts it
  // renders), so the gate must resolve before first paint or returning visitors
  // would flash the pending splash. setState in a layout effect is flushed
  // synchronously before the browser paints. window.location is already the new
  // URL here: Next's HistoryUpdater pushes it in useInsertionEffect, which runs
  // before layout effects.
  /* eslint-disable react-hooks/set-state-in-effect -- see WHY above */
  useLayoutEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Captured before the near/boxes strip below rewrites the URL, so the
    // skip decision still sees them.
    const { search, hash } = window.location;
    const params = new URLSearchParams(search);
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
    // ?venue=<id> and the #venue=<id> fragment (used by /venue/[id]'s "View on
    // the map" CTA) both land here. There's no /?venue= → /venue/<id> redirect
    // to bypass (next.config.ts removed it — a `has`-query redirect on "/"
    // 500'd on OpenNext/Cloudflare, see that file's 2026-06-20 hotfix note);
    // PageNav's saved-venue links use the plain query form instead, and both
    // are read client-side.
    setInitialVenueId(resolveVenueId(search, hash));
    // Unlike near/boxes above, ?event= is NOT stripped: MapWrapper keeps it in
    // step with the selected pin, so a refresh reopens on the same event.
    setInitialEventId(params.get('event') || null);
    // A shared venue link, Near me and Boxes (both from inside the app, via
    // PageNav) all skip the splash, as does a visitor who already saw it.
    setSplashShown(!shouldSkipSplash({ search, hash, gateSeen: readSplashGate() }));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dismissSplash = useCallback((mode: 'located' | 'pueblo-center', failure?: LocationFailure) => {
    markSplashSeen();
    setViewport(mode);
    setSplashLocationFailure(failure ?? null);
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

  return (
    <>
      {/* Map mounts only once the gate resolves (never while null): useDeferredMapLoad
          treats a hold true→false edge as an immediate load trigger, so mounting
          it earlier would change when mapbox-gl loads for returning visitors. */}
      {splashShown !== null && (
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
            splashLocationFailure={splashLocationFailure}
            onShowWelcome={showSplashAgain}
            initialVenueId={initialVenueId}
            initialEventId={initialEventId}
            initialBoxesFilter={initialBoxesFilter}
            holdMapLoad={splashShown === true}
          />
        </main>
      )}

      {/* Splash overlay — full-viewport frosted scrim. Present while unresolved
          (null) so it is in the server HTML; `pending` lets CSS hide it for
          returning visitors until this unmounts it. */}
      {splashShown !== false && (
        <SplashScreen
          pending={splashShown === null}
          onPrimary={dismissSplash}
        />
      )}
    </>
  );
}
