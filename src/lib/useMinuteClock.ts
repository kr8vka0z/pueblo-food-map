"use client";

/**
 * useMinuteClock — "now" as epoch milliseconds, refreshed once a minute and
 * whenever the tab becomes visible again (#758).
 *
 * WHY both: browsers throttle or freeze timers in background tabs and on a
 * locked phone, so after coming back the interval alone could leave a pin
 * showing a stale state for up to a minute.
 *
 * ONE timer for the whole page (#759): the star pins (EventLayer) and the open
 * event card (EventCardBody) both read this clock, and the brief is "no second
 * timer". So the interval and the visibility listener live at module level and
 * are shared by every caller; they start with the first mounted caller and stop
 * with the last, which keeps the "no events -> no timer" property of #758.
 * Every caller gets the same tick value, so a pin and the card can never
 * disagree about whether an event has started.
 */

import { useEffect, useState } from "react";

const TICK_MS = 60_000;

const listeners = new Set<(now: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function refresh(): void {
  const now = Date.now();
  listeners.forEach((listener) => listener(now));
}

function onVisible(): void {
  if (document.visibilityState === "visible") refresh();
}

function subscribe(listener: (now: number) => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(refresh, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== null) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribe(setNow), []);
  return now;
}
