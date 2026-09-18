"use client";

/**
 * useBoxesList — client-side fetch of the FULL live blessing-box layer
 * (GET /api/public/blessing-boxes) for the /boxes directory page (Blessing
 * Boxes slice 4, Discovery story B5).
 *
 * WHY a separate hook from useBoxVenues.ts, not a shared one with an
 * options flag: useBoxVenues deliberately strips every box down to a plain
 * Venue (see its own header) so it slots into useMapFilters' pipeline with
 * zero adapter code — the right shape for the MAP's marker/filter pipeline.
 * /boxes needs the FULL PublicBlessingBox (status, statusSince,
 * lastFilledAt, mostNeeded) to sort and render its rows, so this hook
 * fetches the SAME endpoint and keeps the full shape instead. Same fetch,
 * same best-effort-on-failure convention; not worth a shared options param
 * for what's really two different return types serving two different
 * consumers.
 */

import { useEffect, useState } from "react";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

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
        // either way this is the same "no boxes this request" fallback
        // useBoxVenues.ts already established; the map/list stays fully
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
