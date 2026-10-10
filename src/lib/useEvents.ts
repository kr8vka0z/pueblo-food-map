"use client";

/**
 * useEvents — client-side fetch of the live special-event feed
 * (GET /api/public/events, #757) for MapWrapper, same shape and best-effort
 * convention as useBoxesList: a failed, non-OK or malformed response leaves
 * the list at [] and the map looks and behaves exactly as it did before events
 * existed. Fetched once on mount; the once-a-minute clock (useMinuteClock)
 * re-judges the SAME list, so an event published mid-session appears on the
 * next page load (the feed's own cache is 60s).
 *
 * The state is only written when there is something to show, so an empty or
 * failed feed costs no re-render.
 */

import { useEffect, useState } from "react";
import type { PublicEvent } from "@/lib/events";

/** Keeps only rows the map can draw; one malformed row must not hide the rest. */
function drawable(raw: unknown): PublicEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is PublicEvent =>
      typeof e === "object" && e !== null &&
      typeof e.id === "string" && typeof e.name === "string" &&
      typeof e.starts_at === "string" && typeof e.ends_at === "string" &&
      // Range-checked too: mapbox throws on an impossible coordinate, which would
      // swap the whole map for the list fallback over one hand-edited bad row.
      Number.isFinite(e.lat) && Math.abs(e.lat) <= 90 &&
      Number.isFinite(e.lng) && Math.abs(e.lng) <= 180,
  );
}

export function useEvents(): PublicEvent[] {
  const [events, setEvents] = useState<PublicEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/events")
      .then((res) => (res.ok ? (res.json() as Promise<{ events?: unknown }>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = drawable(data.events);
        if (list.length > 0) setEvents(list);
      })
      .catch(() => {
        // Network/parse failure — leave events at [], the map still works.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return events;
}
