"use client";

/**
 * useBoxNetworkStats — client-side fetch of the network-wide raw data
 * (GET /api/public/blessing-boxes/network-stats, Blessing Boxes slice 7).
 * Fetch-once, no filters — mirrors useBoxVenues.ts's exact shape (fetch on
 * mount, best-effort, cancel-flag on unmount). Unlike useBoxActivity.ts, this
 * hook never re-fetches when the period picker changes: the period filter is
 * applied CLIENT-SIDE by boxStats.ts's pure functions over this one payload,
 * so switching "Last 7 days" -> "All time" is instant with no network
 * round-trip (see boxStats.ts's own header for why the raw data, not
 * pre-aggregated numbers, is what this route serves).
 */

import { useEffect, useState } from "react";
import type { NetworkStatsData } from "@/lib/boxStats";

const EMPTY_DATA: NetworkStatsData = { boxes: [], checkins: [], photos: [] };

export interface UseBoxNetworkStatsResult {
  data: NetworkStatsData;
  loading: boolean;
}

/** Fills in any missing array with [] rather than trusting the response shape blindly — belt-and-suspenders against a stale/partial cached response ever reaching a consumer that does `.map`/`for...of` on an undefined field. */
function normalize(result: Partial<NetworkStatsData> | null): NetworkStatsData {
  return {
    boxes: result?.boxes ?? [],
    checkins: result?.checkins ?? [],
    photos: result?.photos ?? [],
  };
}

export function useBoxNetworkStats(): UseBoxNetworkStatsResult {
  const [data, setData] = useState<NetworkStatsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/blessing-boxes/network-stats")
      .then((res) => (res.ok ? (res.json() as Promise<Partial<NetworkStatsData>>) : null))
      .then((result) => {
        if (cancelled) return;
        setData(normalize(result ?? null));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(EMPTY_DATA);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
