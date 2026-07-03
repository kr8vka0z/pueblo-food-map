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
 */

import { useEffect, useState } from "react";

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

export function useDeferredMapLoad(eager: boolean): boolean {
  const [triggered, setTriggered] = useState(eager);

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

    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(trigger, { timeout: IDLE_TIMEOUT_MS });
    } else {
      timeoutHandle = setTimeout(trigger, FALLBACK_DELAY_MS);
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
  }, [triggered]);

  return triggered;
}
