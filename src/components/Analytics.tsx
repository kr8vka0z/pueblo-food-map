"use client";

/**
 * Analytics — mounts PostHog init on a deferred timer (#485). Renders
 * nothing; its only job is calling analytics.ts's initAnalytics() once the
 * shared perf gate (useDeferredMapLoad, already proven for the Mapbox
 * bundle — #226) says it's safe to load a third-party script. Reusing that
 * hook rather than writing a second idle/interaction listener keeps this
 * component to a single effect.
 *
 * `eager` is always false here — unlike the map, there is no deep-link case
 * that needs analytics loaded immediately.
 */

import { useEffect } from "react";
import { useDeferredMapLoad } from "@/lib/useDeferredMapLoad";
import { initAnalytics } from "@/lib/analytics";

export default function Analytics() {
  const ready = useDeferredMapLoad(false);

  useEffect(() => {
    if (ready) initAnalytics();
  }, [ready]);

  return null;
}
