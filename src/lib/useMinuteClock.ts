"use client";

/**
 * useMinuteClock — "now" as epoch milliseconds, refreshed once a minute and
 * whenever the tab becomes visible again (#758).
 *
 * WHY both: browsers throttle or freeze timers in background tabs and on a
 * locked phone, so after coming back the interval alone could leave a pin
 * showing a stale state for up to a minute. One timer per caller; the caller
 * (EventLayer) is mounted once for the whole map, not once per pin.
 */

import { useEffect, useState } from "react";

const TICK_MS = 60_000;

export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(refresh, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}
