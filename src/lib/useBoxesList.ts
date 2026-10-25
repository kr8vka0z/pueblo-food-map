"use client";

/**
 * useBoxesList — client-side fetch of the FULL live blessing-box layer
 * (GET /api/public/blessing-boxes), plus `toVenue` to strip a box down to the
 * plain Venue shape. Consumers: MapWrapper.tsx (the open box card needs the
 * full PublicBlessingBox — status, lastFilledAt, mostNeeded, recentCheckins,
 * host note — and the pin/filter pipeline gets `boxes.map(toVenue)` from the
 * same single fetch) and BoxesActivityContent.tsx (its box filter dropdown).
 *
 * WHY a client fetch rather than baking boxes into venues.ts's build-time
 * snapshot: boxes are live, not published (Build Plan architecture call #1)
 * — a box an admin just added must show up on the map without a rebuild.
 *
 * Best-effort: a fetch failure leaves `boxes` at [] rather than throwing —
 * the map is fully usable with zero box pins, same resilience convention as
 * the route's own D1-read fallback (src/app/api/public/blessing-boxes/route.ts).
 */

import { useEffect, useState } from "react";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

/**
 * Drops the `box` sub-object: useMapFilters' filter/marker pipeline only
 * reads plain Venue fields (id/name/category/lat/lng/address/source/
 * last_verified), so a box slots in with zero adapter code.
 */
export function toVenue(b: PublicBlessingBox): Venue {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    lat: b.lat,
    lng: b.lng,
    address: b.address,
    source: b.source,
    last_verified: b.last_verified,
  };
}

export interface UseBoxesListResult {
  boxes: PublicBlessingBox[];
  /** True until the first fetch settles (success or failure) — lets the page show a neutral "loading" line instead of flashing an empty state before data arrives. */
  loading: boolean;
}

export function useBoxesList(): UseBoxesListResult {
  const [boxes, setBoxes] = useState<PublicBlessingBox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/blessing-boxes")
      .then((res) => (res.ok ? (res.json() as Promise<{ boxes: PublicBlessingBox[] }>) : null))
      .then((data) => {
        if (cancelled) return;
        setBoxes(data?.boxes ?? []);
        setLoading(false);
      })
      .catch(() => {
        // Network/parse failure, or a D1-degraded {boxes: []} response —
        // either way "no boxes this request"; the map/list stays fully
        // usable, just with nothing to show.
        if (cancelled) return;
        setBoxes([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { boxes, loading };
}
