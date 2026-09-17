"use client";

/**
 * useBoxVenues — client-side fetch of the live blessing-box layer
 * (GET /api/public/blessing-boxes) for MapWrapper.
 *
 * WHY a separate fetch rather than baking boxes into venues.ts's build-time
 * snapshot: boxes are live, not published (Build Plan architecture call #1)
 * — a box an admin just added must show up on the map without a rebuild.
 * Returns plain Venue[] (never the full PublicBlessingBox — MapWrapper's
 * filter pipeline only needs id/name/category/lat/lng/address/source/
 * last_verified, the fields every other Venue already carries) so it slots
 * into useMapFilters' existing pipeline with zero adapter code.
 *
 * Best-effort: a fetch failure leaves boxVenues at [] rather than throwing —
 * the map is fully usable with zero box pins, same resilience convention as
 * the route's own D1-read fallback (src/app/api/public/blessing-boxes/route.ts).
 */

import { useEffect, useState } from "react";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

/** Drops the `box` sub-object — the filter/marker pipeline only ever reads plain Venue fields. */
function toVenue(b: PublicBlessingBox): Venue {
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

export function useBoxVenues(): Venue[] {
  const [boxVenues, setBoxVenues] = useState<Venue[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/blessing-boxes")
      .then((res) => (res.ok ? (res.json() as Promise<{ boxes: PublicBlessingBox[] }>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBoxVenues(data.boxes.map(toVenue));
      })
      .catch(() => {
        // Network/parse failure — leave boxVenues at [], map still works.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return boxVenues;
}
