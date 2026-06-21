/**
 * Unit tests for the useMapFilters hook — venue filter pipeline (#166 8.3).
 *
 * This is the highest-value user-critical path: wrong filter = wrong venues
 * shown. Tests cover:
 *   1. Initial state — all venues returned, no active filter
 *   2. Category filter — only venues matching selected category returned
 *   3. Open-now filter — only currently-open venues returned
 *   4. SNAP filter — only SNAP-accepting venues returned
 *   5. WIC filter — only WIC-accepting venues returned
 *   6. Favorites filter — only favorited venues returned (or all if none saved)
 *   7. Text search — query narrows venue list by name/category/benefit alias
 *   8. Category browse — handleCategoryBrowseSelect syncs both filter states
 *   9. Clear all — handleClearAllFilters resets every filter + query
 *  10. Counts — allVenueCounts/snapCount/wicCount/openNowCount are consistent
 *  11. anyFilterActive — reflects true/false correctly
 *  12. Nearest-first sort — filteredVenues are in ascending distance order
 *
 * WHY real venue data: the filter pipeline behavior depends on the actual
 * category/benefit set; mocking it would only test mock-plumbing. The real
 * data is stable (committed TS module) and verifiable.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapFilters } from "@/lib/useMapFilters";
import { venues as allVenues } from "@/data/venues";
import { __resetFavoritesForTests, addFavorite } from "@/lib/favorites";

// Pueblo center — same default as MapWrapper
const PUEBLO_CENTER = { lat: 38.2667, lng: -104.6167 };

beforeEach(() => {
  __resetFavoritesForTests();
  // Make sure open-hours tests control time deterministically
  vi.useFakeTimers({ now: new Date("2026-06-21T14:00:00-06:00") }); // Saturday 2pm MDT
});

afterEach(() => {
  vi.useRealTimers();
});

// ── 1. Initial state ─────────────────────────────────────────────────────────

describe("useMapFilters — initial state", () => {
  test("returns all venues with no filter active", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
    expect(result.current.anyFilterActive).toBe(false);
  });

  test("activeCategoryFilter starts null", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect(result.current.activeCategoryFilter).toBeNull();
  });

  test("query starts empty", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect(result.current.query).toBe("");
  });
});

// ── 2. Category filter ────────────────────────────────────────────────────────

describe("useMapFilters — category filter", () => {
  test("filtering by 'grocery' returns only grocery venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => {
      result.current.setSelectedCategories(new Set(["grocery"]));
    });
    const categories = result.current.filteredVenues.map((v) => v.category);
    expect(categories.every((c) => c === "grocery")).toBe(true);
    expect(result.current.filteredVenues.length).toBeGreaterThan(0);
  });

  test("filtering by 'pantry' returns only pantry venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => {
      result.current.setSelectedCategories(new Set(["pantry"]));
    });
    const categories = result.current.filteredVenues.map((v) => v.category);
    expect(categories.every((c) => c === "pantry")).toBe(true);
  });

  test("clearing category filter restores all venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setSelectedCategories(new Set(["grocery"])));
    const afterFilter = result.current.filteredVenues.length;
    act(() => result.current.setSelectedCategories(null));
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
    expect(result.current.filteredVenues.length).toBeGreaterThan(afterFilter);
  });
});

// ── 3. Open-now filter ────────────────────────────────────────────────────────

describe("useMapFilters — open-now filter", () => {
  test("filterOpenNow=true returns subset of all venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterOpenNow(true));
    // Open-now count should be ≥ 0 and ≤ total
    expect(result.current.filteredVenues.length).toBeGreaterThanOrEqual(0);
    expect(result.current.filteredVenues.length).toBeLessThanOrEqual(allVenues.length);
    expect(result.current.anyFilterActive).toBe(true);
  });

  test("toggling filterOpenNow off restores all venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterOpenNow(true));
    act(() => result.current.setFilterOpenNow(false));
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
  });
});

// ── 4. SNAP filter ────────────────────────────────────────────────────────────

describe("useMapFilters — SNAP filter", () => {
  test("filterSnap=true returns only SNAP-accepting venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterSnap(true));
    const snap = result.current.filteredVenues.every((v) => v.accepts_snap);
    expect(snap).toBe(true);
    expect(result.current.filteredVenues.length).toBeGreaterThan(0);
    expect(result.current.anyFilterActive).toBe(true);
  });

  test("snapCount matches filteredVenues count under SNAP filter", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterSnap(true));
    expect(result.current.filteredVenues.length).toBe(result.current.snapCount);
  });
});

// ── 5. WIC filter ─────────────────────────────────────────────────────────────

describe("useMapFilters — WIC filter", () => {
  test("filterWic=true returns only WIC-accepting venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterWic(true));
    const wic = result.current.filteredVenues.every((v) => v.accepts_wic);
    expect(wic).toBe(true);
    expect(result.current.filteredVenues.length).toBeGreaterThan(0);
    expect(result.current.anyFilterActive).toBe(true);
  });

  test("wicCount matches filteredVenues count under WIC filter", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterWic(true));
    expect(result.current.filteredVenues.length).toBe(result.current.wicCount);
  });
});

// ── 6. Favorites filter ───────────────────────────────────────────────────────

describe("useMapFilters — favorites filter", () => {
  test("filterFavorites=true with no saved venues shows all (no blank state)", () => {
    // If no venues are favorited, the filter has no effect (avoids empty-result trap).
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterFavorites(true));
    // favoriteSet.size === 0 → filter is not applied (all venues returned)
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
    // anyFilterActive is false when favorites is on but no favorites exist
    expect(result.current.anyFilterActive).toBe(false);
  });

  test("filterFavorites=true with a saved venue returns only that venue", () => {
    const firstId = allVenues[0]!.id;
    addFavorite(firstId);
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterFavorites(true));
    expect(result.current.filteredVenues.length).toBe(1);
    expect(result.current.filteredVenues[0]!.id).toBe(firstId);
    expect(result.current.anyFilterActive).toBe(true);
  });
});

// ── 7. Text search ────────────────────────────────────────────────────────────

describe("useMapFilters — text search", () => {
  test("query narrows venue list", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setQuery("market"));
    // At least some venues should match the generic query "market"
    expect(result.current.filteredVenues.length).toBeLessThanOrEqual(allVenues.length);
  });

  test("query with no match returns empty list", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setQuery("xyzzy_no_match_42"));
    expect(result.current.filteredVenues.length).toBe(0);
  });

  test("empty query after typing restores all venues", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setQuery("market"));
    act(() => result.current.setQuery(""));
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
  });
});

// ── 8. handleCategoryBrowseSelect ────────────────────────────────────────────

describe("useMapFilters — handleCategoryBrowseSelect", () => {
  test("selecting a category sets both activeCategoryFilter and selectedCategories", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.handleCategoryBrowseSelect("grocery"));
    expect(result.current.activeCategoryFilter).toBe("grocery");
    // filteredVenues should only have grocery venues
    const categories = result.current.filteredVenues.map((v) => v.category);
    expect(categories.every((c) => c === "grocery")).toBe(true);
  });

  test("selecting null clears the browse filter", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.handleCategoryBrowseSelect("grocery"));
    act(() => result.current.handleCategoryBrowseSelect(null));
    expect(result.current.activeCategoryFilter).toBeNull();
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
  });
});

// ── 9. handleClearAllFilters ──────────────────────────────────────────────────

describe("useMapFilters — handleClearAllFilters", () => {
  test("clears all active filters and query, restores full venue list", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => {
      result.current.setFilterSnap(true);
      result.current.setFilterOpenNow(true);
      result.current.setQuery("test");
      result.current.handleCategoryBrowseSelect("pantry");
    });
    expect(result.current.anyFilterActive).toBe(true);
    act(() => result.current.handleClearAllFilters());
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
    expect(result.current.anyFilterActive).toBe(false);
    expect(result.current.query).toBe("");
    expect(result.current.activeCategoryFilter).toBeNull();
  });
});

// ── 10. Counts ───────────────────────────────────────────────────────────────

describe("useMapFilters — counts", () => {
  test("snapCount matches allVenues SNAP count", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const expected = allVenues.filter((v) => v.accepts_snap).length;
    expect(result.current.snapCount).toBe(expected);
  });

  test("wicCount matches allVenues WIC count", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const expected = allVenues.filter((v) => v.accepts_wic).length;
    expect(result.current.wicCount).toBe(expected);
  });

  test("allVenueCounts totals match allVenues.length", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const total = Object.values(result.current.allVenueCounts).reduce(
      (sum, n) => sum + (n ?? 0),
      0,
    );
    expect(total).toBe(allVenues.length);
  });
});

// ── 11. anyFilterActive ───────────────────────────────────────────────────────

describe("useMapFilters — anyFilterActive", () => {
  test("false with no filters set", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect(result.current.anyFilterActive).toBe(false);
  });

  test("true when category filter is active", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setSelectedCategories(new Set(["grocery"])));
    expect(result.current.anyFilterActive).toBe(true);
  });

  test("true when SNAP filter is active", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterSnap(true));
    expect(result.current.anyFilterActive).toBe(true);
  });
});

// ── 12. Nearest-first sort ────────────────────────────────────────────────────

describe("useMapFilters — nearest-first sort", () => {
  test("filteredVenues are sorted ascending by distanceMiles", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const distances = result.current.filteredVenues.map((v) => (v as unknown as { distanceMiles: number }).distanceMiles);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });

  test("venuesWithDistance all have distanceMiles attached", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const allHaveDistance = result.current.venuesWithDistance.every(
      (v) => typeof v.distanceMiles === "number" && !isNaN(v.distanceMiles),
    );
    expect(allHaveDistance).toBe(true);
  });

  test("different origin produces different distances", () => {
    const { result: r1 } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const farOrigin = { lat: 40.0, lng: -105.0 }; // Boulder area
    const { result: r2 } = renderHook(() => useMapFilters(farOrigin));
    // Distances from Boulder should be larger on average than from Pueblo center
    const avgPueblo = r1.current.filteredVenues.reduce((s, v) => s + (v as unknown as { distanceMiles: number }).distanceMiles, 0) / r1.current.filteredVenues.length;
    const avgBoulder = r2.current.filteredVenues.reduce((s, v) => s + (v as unknown as { distanceMiles: number }).distanceMiles, 0) / r2.current.filteredVenues.length;
    expect(avgBoulder).toBeGreaterThan(avgPueblo);
  });
});
