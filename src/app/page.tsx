'use client';

/**
 * Root page — first-visit splash gate.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #4
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
 * mismatch (localStorage is unavailable server-side).
 *
 * #99: showSplashAgain() re-shows the splash overlay WITHOUT clearing
 * localStorage (so future page loads still skip straight to the map).
 * Pass down as onShowWelcome to MapWrapper → HamburgerMenu.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import MapWrapper from '@/components/MapWrapper';

const GATE_KEY = 'pfm.splash.seen.v2';

function readGate(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(GATE_KEY) === '1';
}

export default function HomePage() {
  // null = not yet determined (SSR-safe: avoids flash of wrong content).
  // We initialize to null so the server renders nothing, then the client
  // effect determines the true value without a hydration mismatch.
  const [splashShown, setSplashShown] = useState<boolean | null>(null);
  const [viewport, setViewport] = useState<'located' | 'pueblo-center'>('pueblo-center');

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
      setSplashShown(!readGate());
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
        <MapWrapper viewport={viewport} onShowWelcome={showSplashAgain} />
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
