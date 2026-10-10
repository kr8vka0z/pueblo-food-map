"use client";

/**
 * useEventDetail — the event the card should show for the selected id (#759).
 *
 * Two sources, in order. (1) The live feed MapWrapper already holds: a pin tap
 * or a shared link to an upcoming/live event finds it there at no cost.
 * (2) Only when the feed has FINISHED loading without that id — a link shared
 * before the event and opened after it ended, or after it was cancelled — one
 * read of GET /api/public/events/[id]. Never before the feed has answered, so
 * an in-feed event costs no extra request.
 *
 * Returns `missing: true` when neither source has it (unknown/draft/archived
 * id, network failure): no card opens, so a dead link leaves the map exactly
 * as it would be without the parameter (fail-soft).
 *
 * The fetched event is kept apart from the feed array that feeds the pins: a
 * cancelled or ended event must never reach pinsAt() ("no pin").
 */

import { useEffect, useMemo, useState } from "react";
import type { PublicEvent, PublicEventDetail } from "@/lib/events";

export interface EventDetailResult {
  event: PublicEventDetail | null;
  /** True once it is certain no event can be shown for this id. */
  missing: boolean;
}

export function useEventDetail(
  id: string | null,
  feed: readonly PublicEvent[],
  feedLoaded: boolean,
): EventDetailResult {
  // Keyed by id so a result for an earlier selection can never show for a later one.
  const [fetched, setFetched] = useState<{ id: string; event: PublicEventDetail | null } | null>(null);

  const fromFeed = useMemo<PublicEventDetail | null>(() => {
    const found = id === null ? undefined : feed.find((e) => e.id === id);
    return found ? { ...found, status: "published", cancel_note: null, cancel_note_es: null } : null;
  }, [id, feed]);

  const needsFetch = id !== null && fromFeed === null && feedLoaded;
  useEffect(() => {
    if (!needsFetch || id === null) return;
    let cancelled = false;
    fetch(`/api/public/events/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ event?: PublicEventDetail | null }>) : null))
      .then((data) => {
        if (!cancelled) setFetched({ id, event: data?.event ?? null });
      })
      .catch(() => {
        if (!cancelled) setFetched({ id, event: null });
      });
    return () => {
      cancelled = true;
    };
  }, [needsFetch, id]);

  if (fromFeed) return { event: fromFeed, missing: false };
  if (id === null) return { event: null, missing: false };
  if (fetched && fetched.id === id) return { event: fetched.event, missing: fetched.event === null };
  return { event: null, missing: false };
}
