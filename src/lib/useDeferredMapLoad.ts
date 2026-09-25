"use client";

/**
 * useDeferredMapLoad — perf gate for the interactive Mapbox map (#226).
 *
 * Keeps mapbox-gl out of the critical rendering path on cold load: the
 * dynamic import of Map.tsx (mapbox-gl + react-map-gl) fires the instant
 * next/dynamic's factory is first invoked, so MapWrapper must not render
 * <MapCanvas> at all until this hook says it's time — it renders a
 * lightweight placeholder (MapWrapper reuses ListView) in the interim.
 *
 * The returned flag flips true on whichever of these fires first:
 *   - `eager` is already true at mount. MapWrapper passes this for a venue
 *     deep link (?venue=/#venue=) — a shared link must open on its pin
 *     immediately, never waiting on idle time or a user interaction.
 *   - the browser reports idle time (requestIdleCallback), bounded by
 *     IDLE_TIMEOUT_MS so a permanently busy main thread can't starve it
 *     forever.
 *   - requestIdleCallback is unsupported (Safari, as of this writing) — a
 *     fixed setTimeout stands in.
 *   - the user interacts before either of the above fires: pointerdown,
 *     touchstart, scroll, keydown, or focusin. keydown/focusin are included
 *     (not just pointer/touch) so a keyboard or assistive-tech user tabbing
 *     toward the map region gets the same early trigger a mouse/touch user
 *     does — the idle fallback above still guarantees eventual load even
 *     with zero interaction, so no user is gated behind a pointer-only path.
 *
 * All listeners are registered with capture:true. This is required for
 * "scroll", which does not bubble — a bubble-phase window listener would
 * miss scrolling inside a nested overflow container (e.g. the ListView
 * placeholder's own scrollable list). Capture is harmless for the other
 * event types, which bubble normally and are also seen in the capture phase.
 *
 * `hold` param (#588): while true, the idle-callback/setTimeout branch above
 * is skipped entirely — no automatic trigger fires on its own. This is for
 * the splash-screen gate: MapWrapper is mounted (and this hook's effect
 * runs) the instant the page loads, whether or not a first-time visitor has
 * read the splash yet, so the un-held idle timer used to start mapbox-gl's
 * download during the ~2s a visitor is still reading — the exact cost
 * Lighthouse's synthetic (never-interacts) mobile run also pays, showing up
 * as TBT/TTI. The interaction listeners stay attached regardless of `hold`:
 * a real tap on the splash's own CTA fires pointerdown on `window` (capture
 * phase sees every dispatched event, independent of `inert`/DOM subtree —
 * the splash renders as a sibling of the inert map container, not a
 * descendant of it) and starts the load right then, in parallel with the
 * geolocation request that same tap kicks off — not serialized behind
 * SplashScreen's actual dismiss, which itself waits on geolocation to
 * resolve (up to the 8s getCurrentPosition timeout) and would defeat the
 * overlap. `hold` flipping true→false (the splash's real dismiss) is ALSO
 * an unconditional trigger — belt-and-suspenders for a dismissal that
 * reaches here without a real pointer/key DOM event (a script-driven
 * `.click()` or some assistive-tech activation paths don't dispatch
 * pointerdown/keydown at all).
 */

import { useEffect, useRef, useState } from "react";

/** Idle-callback budget — bounds worst-case deferral on a busy main thread. */
export const IDLE_TIMEOUT_MS = 2000;

/** setTimeout fallback delay for browsers without requestIdleCallback. */
export const FALLBACK_DELAY_MS = 200;

/** DOM events that count as "the user is interacting" — see module doc above. */
const INTERACTION_EVENTS = [
  "pointerdown",
  "touchstart",
  "scroll",
  "keydown",
  "focusin",
] as const;

export function useDeferredMapLoad(eager: boolean, hold: boolean = false): boolean {
  const [triggered, setTriggered] = useState(eager);

  // Detect hold's true→false edge (splash dismissed) and force-trigger —
  // see module doc's "belt-and-suspenders" note above. A ref (not state)
  // since it only needs to survive across renders, never itself render.
  const prevHoldRef = useRef(hold);
  useEffect(() => {
    if (prevHoldRef.current && !hold) {
      setTriggered(true);
    }
    prevHoldRef.current = hold;
  }, [hold]);

  useEffect(() => {
    if (triggered) return;

    // Guards against both the idle callback/timer AND an interaction event
    // racing to fire trigger() twice (e.g. requestIdleCallback firing in the
    // same tick as a listener) — setTriggered(true) again would be a harmless
    // no-op, but the guard also lets cleanup below run exactly once.
    let settled = false;
    const trigger = () => {
      if (settled) return;
      settled = true;
      setTriggered(true);
    };

    // While held (splash up, #588): skip the automatic idle/timeout branch
    // — see module doc — but still attach the interaction listeners below.
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    if (!hold) {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(trigger, { timeout: IDLE_TIMEOUT_MS });
      } else {
        timeoutHandle = setTimeout(trigger, FALLBACK_DELAY_MS);
      }
    }

    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, trigger, { capture: true, passive: true });
    }

    return () => {
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, trigger, { capture: true });
      }
    };
  }, [triggered, hold]);

  return triggered;
}
