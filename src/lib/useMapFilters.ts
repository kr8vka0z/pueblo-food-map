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
import { computeOpenStatus } from "@/lib/hours";
import { searchVenues } from "@/lib/searchVenues";
import { useFavorites } from "@/lib/favorites";
import type { VenueCategory } from "@/types/venue";

/** Lat/lng origin — user position or Pueblo center fallback. */
export interface LatLng {
  lat: number;
  lng: number;
}

export function useMapFilters(origin: LatLng) {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] =
    useState<Set<VenueCategory> | null>(null);
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterSnap, setFilterSnap] = useState(false);
  const [filterWic, setFilterWic] = useState(false);
  const [filterFavorites, setFilterFavorites] = useState(false);

  // ── Category browse filter (#95) ────────────────────────────────────────────
  // Single-select from the category dropdown — syncs into selectedCategories.
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<VenueCategory | null>(null);

  // ── Favorites ────────────────────────────────────────────────────────────────
  const favoriteIds = useFavorites();

  // ── Derived: venues with Haversine distances ─────────────────────────────────
  const venuesWithDistance = useMemo(() => {
    return allVenues.map((v) => ({
      ...v,
      distanceMiles: haversineMiles(origin, { lat: v.lat, lng: v.lng }),
    }));
  }, [origin]);

  // ── Derived: saved venues (favorites, nearest-first) ─────────────────────────
  const savedVenues = useMemo(() => {
    const ids = new Set(favoriteIds);
    return venuesWithDistance
      .filter((v) => ids.has(v.id))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [favoriteIds, venuesWithDistance]);

  const favoriteSet = useMemo(() => new Set(savedVenues.map((v) => v.id)), [savedVenues]);
  const favoritesCount = favoriteSet.size;

  // ── Derived: filter badge counts (computed from all venues, not filtered) ────
  const allVenueCounts = useMemo(() => {
    return allVenues.reduce<Partial<Record<VenueCategory, number>>>(
      (acc, v) => {
        acc[v.category] = (acc[v.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
  }, []);

  const openNowCount = useMemo(
    () =>
      venuesWithDistance.filter(
        (v) => computeOpenStatus(v.hours_weekly, new Date()).state === "open",
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
          const status = computeOpenStatus(v.hours_weekly, now);
          if (status.state !== "open") return false;
        }
        if (filterSnap && !v.accepts_snap) return false;
        if (filterWic && !v.accepts_wic) return false;
        if (filterFavorites && favoriteSet.size > 0 && !favoriteSet.has(v.id)) return false;
        return true;
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    return searchVenues(afterFilters, query);
  }, [
    venuesWithDistance,
    selectedCategories,
    filterOpenNow,
    filterSnap,
    filterWic,
    filterFavorites,
    favoriteSet,
    query,
  ]);

  // ── anyFilterActive ──────────────────────────────────────────────────────────
  const anyFilterActive =
    (selectedCategories !== null && selectedCategories.size > 0) ||
    filterOpenNow ||
    filterSnap ||
    filterWic ||
    (filterFavorites && favoriteSet.size > 0);

  // ── Category browse handler ──────────────────────────────────────────────────
  const handleCategoryBrowseSelect = useCallback(
    (cat: VenueCategory | null) => {
      setActiveCategoryFilter(cat);
      setSelectedCategories(cat !== null ? new Set([cat]) : null);
    },
    [],
  );

  // ── Clear ALL filters + search ────────────────────────────────────────────────
  const handleClearAllFilters = useCallback(() => {
    setSelectedCategories(null);
    setActiveCategoryFilter(null);
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
    filterFavorites,
    setFilterFavorites,
    activeCategoryFilter,
    setActiveCategoryFilter,
    // Derived
    venuesWithDistance,
    filteredVenues,
    savedVenues,
    favoriteSet,
    favoritesCount,
    anyFilterActive,
    allVenueCounts,
    openNowCount,
    snapCount,
    wicCount,
    // Handlers
    handleCategoryBrowseSelect,
    handleClearAllFilters,
  };
}
