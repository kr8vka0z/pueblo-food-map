"use client";

/**
 * useMapFilters — venue filter pipeline for MapWrapper.
 *
 * Owns all filter state (query, category, open-now, SNAP, WIC, favorites)
 * and the derived filtered venue list. Extracted from MapWrapper so the
 * filter pipeline can be unit-tested independently of the map render tree.
 *
 * WHY separate from the full MapWrapper state: the filter pipeline is the
 * highest-value user-critical path (wrong filter = wrong venues shown) and
 * was completely untested. A standalone hook is directly testable with
 * renderHook() without any Mapbox or vaul setup.
 */

import { useCallback, useMemo, useState } from "react";
import { venues as allVenues } from "@/data/venues";
import { haversineMiles } from "@/lib/distance";
import { computeVenueOpenStatus } from "@/lib/hours";
import { searchVenues } from "@/lib/searchVenues";
import { useFavorites } from "@/lib/favorites";
import type { Venue, VenueCategory } from "@/types/venue";

/** Lat/lng origin — user position or Pueblo center fallback. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * `extraVenues` (Blessing Boxes slice 1): blessing_box venues, fetched
 * client-side at request time from the live endpoint — they're excluded
 * from `venues.ts`'s build-time snapshot on purpose (boxes are live, not
 * published), so this hook can't just import them the way it imports
 * `allVenues`. Merging them in HERE, rather than duplicating a second
 * filter/count/distance pipeline in MapWrapper, is what makes every existing
 * category-chip/count/search/sort rule apply to boxes automatically — every
 * field this pipeline reads (hours_weekly, accepts_snap/wic) is already
 * optional on Venue, and a box simply doesn't have them (same as many
 * existing garden/edible_landscape rows today), so no category-specific
 * branch was needed anywhere in this file. Defaults to [] so every existing
 * caller/test keeps working unchanged.
 */
export function useMapFilters(origin: LatLng, extraVenues: Venue[] = []) {
  const combinedVenues = useMemo(() => [...allVenues, ...extraVenues], [extraVenues]);
  // ── Filter state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] =
    useState<Set<VenueCategory> | null>(null);
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterSnap, setFilterSnap] = useState(false);
  const [filterWic, setFilterWic] = useState(false);

  // ── Favorites ────────────────────────────────────────────────────────────────
  const favoriteIds = useFavorites();

  // ── Derived: venues with Haversine distances ─────────────────────────────────
  const venuesWithDistance = useMemo(() => {
    return combinedVenues.map((v) => ({
      ...v,
      distanceMiles: haversineMiles(origin, { lat: v.lat, lng: v.lng }),
    }));
  }, [combinedVenues, origin]);

  // ── Derived: saved venues (favorites, nearest-first) ─────────────────────────
  const savedVenues = useMemo(() => {
    const ids = new Set(favoriteIds);
    return venuesWithDistance
      .filter((v) => ids.has(v.id))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [favoriteIds, venuesWithDistance]);

  const favoriteSet = useMemo(() => new Set(savedVenues.map((v) => v.id)), [savedVenues]);

  // ── Derived: filter badge counts (computed from all venues, not filtered) ────
  const allVenueCounts = useMemo(() => {
    return combinedVenues.reduce<Partial<Record<VenueCategory, number>>>(
      (acc, v) => {
        acc[v.category] = (acc[v.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
  }, [combinedVenues]);

  // WHY confirmed-open only, deliberately NOT matching the filtered list below:
  // the "Open now" filter itself lets "no_hours" venues survive (board review
  // finding #1) so the pantry majority isn't hidden, but this badge counts only
  // venues whose hours are actually known to be open right now. Inflating this
  // number to match the filtered list's length would misreport how many places
  // are provably open — this is the one honest number on the screen.
  const openNowCount = useMemo(
    () =>
      venuesWithDistance.filter(
        (v) => computeVenueOpenStatus(v, new Date()).state === "open",
      ).length,
    [venuesWithDistance],
  );
  const snapCount = useMemo(
    () => venuesWithDistance.filter((v) => v.accepts_snap).length,
    [venuesWithDistance],
  );
  const wicCount = useMemo(
    () => venuesWithDistance.filter((v) => v.accepts_wic).length,
    [venuesWithDistance],
  );

  // ── Main filter pipeline ─────────────────────────────────────────────────────
  //
  // Pipeline steps (run on every relevant state change via useMemo):
  //   1. allVenues + Haversine distances (venuesWithDistance above)
  //   2. Apply category, open-now, SNAP, WIC, favorites filters
  //   3. Sort nearest-first
  //   4. Apply text search (searchVenues)
  //   Result: filteredVenues — the only venue list passed to Map and ListView
  const filteredVenues = useMemo(() => {
    const now = new Date();

    const afterFilters = venuesWithDistance
      .filter((v) => {
        if (selectedCategories !== null && selectedCategories.size > 0) {
          if (!selectedCategories.has(v.category)) return false;
        }
        if (filterOpenNow) {
          const status = computeVenueOpenStatus(v, now);
          // "no_hours" survives the filter deliberately (board review finding
          // #1): 74 of 107 venues have no hours_weekly data, so treating
          // "unknown" the same as "closed" hid 25 of 35 food pantries behind
          // this toggle with nothing on screen explaining why. Only a venue
          // whose hours ARE known and currently says closed gets dropped here
          // — components render the "no_hours" case as a distinct "hours
          // unknown, call ahead" label (see BottomSheet/DesktopVenueWindow/
          // VenueCard) so it's never mistaken for "open."
          if (status.state !== "open" && status.state !== "no_hours") return false;
        }
        if (filterSnap && !v.accepts_snap) return false;
        if (filterWic && !v.accepts_wic) return false;
        return true;
      })
      .sort((a, b) => {
        // Open now leads with confirmed-open venues, distance-sorted within
        // each group — board review finding: since "no_hours" venues now
        // survive the filter above, sorting by distance alone let confirmed-
        // open venues (19 of 93 on a real sample) get buried among a majority
        // of "hours unknown" rows, defeating the point of the toggle. Distance
        // is always a real number here (origin falls back to PUEBLO_CENTER in
        // MapWrapper when geolocation is unavailable — never NaN/undefined),
        // so no special-casing is needed for a missing-distance case.
        if (filterOpenNow) {
          const aOpen = computeVenueOpenStatus(a, now).state === "open";
          const bOpen = computeVenueOpenStatus(b, now).state === "open";
          if (aOpen !== bOpen) return aOpen ? -1 : 1;
        }
        return a.distanceMiles - b.distanceMiles;
      });

    return searchVenues(afterFilters, query);
  }, [
    venuesWithDistance,
    selectedCategories,
    filterOpenNow,
    filterSnap,
    filterWic,
    query,
  ]);

  // ── anyFilterActive ──────────────────────────────────────────────────────────
  const anyFilterActive =
    (selectedCategories !== null && selectedCategories.size > 0) ||
    filterOpenNow ||
    filterSnap ||
    filterWic;

  // ── Category checkbox toggle (#513 — Filters panel, multi-select) ───────────
  // Replaces the old single-select handleCategoryBrowseSelect: the panel
  // renders 8 independent checkboxes, so toggling one must add/remove just
  // that category from the set, not replace the whole selection. Empty Set
  // normalizes back to null so `selectedCategories !== null && size > 0` (the
  // filter guard above, and every other null-check on this state) stays the
  // single source of truth for "no category filter active" — a lingering
  // empty Set would read as "active" everywhere else that only checks !== null.
  const toggleCategory = useCallback((cat: VenueCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next.size > 0 ? next : null;
    });
  }, []);

  // ── Filters panel's "Clear all" (#513) — categories/open-now/SNAP/WIC only.
  // Deliberately does NOT touch `query`: clearing filter toggles wiping out
  // text the user typed into the search box would be surprising. Compare
  // handleClearAllFilters below, which ListView's own "clear filters" button
  // keeps using (it also clears an empty-result search).
  const clearFilters = useCallback(() => {
    setSelectedCategories(null);
    setFilterOpenNow(false);
    setFilterSnap(false);
    setFilterWic(false);
  }, []);

  // ── Clear ALL filters + search ────────────────────────────────────────────────
  const handleClearAllFilters = useCallback(() => {
    setSelectedCategories(null);
    setFilterOpenNow(false);
    setFilterSnap(false);
    setFilterWic(false);
    setQuery("");
  }, []);

  return {
    // State
    query,
    setQuery,
    selectedCategories,
    setSelectedCategories,
    filterOpenNow,
    setFilterOpenNow,
    filterSnap,
    setFilterSnap,
    filterWic,
    setFilterWic,
    // Derived
    venuesWithDistance,
    filteredVenues,
    savedVenues,
    favoriteSet,
    anyFilterActive,
    allVenueCounts,
    openNowCount,
    snapCount,
    wicCount,
    // Handlers
    toggleCategory,
    clearFilters,
    handleClearAllFilters,
  };
}
