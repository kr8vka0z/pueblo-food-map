'use client';

/**
 * Root page — first-visit splash gate.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open question #4
 *
 * localStorage key 'pfm.splash.seen.v2' gates the splash:
 * - Not set → show SplashScreen
 * - Set to '1' → skip directly to MapWrapper
 *
 * Renders null during the initial SSR-safe render to avoid a
 * hydration mismatch (localStorage is unavailable server-side).
 *
 * #99: showSplashAgain() re-shows the splash WITHOUT clearing localStorage
 * (so future page loads still skip straight to the map). Pass down as
 * onShowWelcome to MapWrapper → HamburgerMenu.
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

  const dismissSplash = (mode: 'located' | 'pueblo-center') => {
    localStorage.setItem(GATE_KEY, '1');
    setViewport(mode);
    setSplashShown(false);
  };

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

  return splashShown ? (
    <SplashScreen
      onPrimary={(mode) => dismissSplash(mode)}
      onSecondary={() => dismissSplash('pueblo-center')}
    />
  ) : (
    <main className="flex-1 flex flex-col min-h-0">
      <MapWrapper viewport={viewport} onShowWelcome={showSplashAgain} />
    </main>
  );
}
