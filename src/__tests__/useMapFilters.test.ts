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
 *   6. Favorites — filter removed (#513); savedVenues/favoriteSet remain for
 *      HamburgerMenu's Saved view
 *   7. Text search — query narrows venue list by name/category/benefit alias
 *   8. toggleCategory — multi-select category checkboxes (#513)
 *   9. clearFilters (panel) vs. handleClearAllFilters (query + everything)
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
import { computeOpenStatus } from "@/lib/hours";
import type { Venue } from "@/types/venue";

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

  test("selectedCategories starts null", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect(result.current.selectedCategories).toBeNull();
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

  // Board review finding #1: "Open now" used to silently drop every venue
  // with no hours_weekly data (74 of 107, incl. 25 of 35 pantries) — it read
  // as "everything is closed" to a hungry user. A venue with genuinely
  // unknown hours must now survive the filter; a venue whose hours ARE known
  // and currently reads closed must still be dropped (that part was correct).
  test("a venue with no hours_weekly survives the Open now filter", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    const noHoursCount = allVenues.filter((v) => !v.hours_weekly).length;
    expect(noHoursCount).toBeGreaterThan(0); // sanity: fixture actually has some
    act(() => result.current.setFilterOpenNow(true));
    const survivingNoHours = result.current.filteredVenues.filter((v) => !v.hours_weekly);
    expect(survivingNoHours.length).toBe(noHoursCount);
  });

  // Review fix: confirmed-open venues must lead the Open now list, not get
  // buried by pure distance sort among the majority of "hours unknown" rows.
  test("with Open now active, a farther confirmed-open venue sorts ahead of a nearer unknown-hours venue", () => {
    const now = new Date("2026-06-21T14:00:00-06:00");
    const openVenue = allVenues.find(
      (v) => computeOpenStatus(v.hours_weekly, now).state === "open",
    );
    const unknownVenue = allVenues.find((v) => !v.hours_weekly);
    expect(openVenue).toBeDefined();
    expect(unknownVenue).toBeDefined();

    // Origin AT the unknown-hours venue's own coordinates guarantees it is the
    // nearest possible venue (~0mi) while the confirmed-open venue sits at
    // whatever real distance separates the two — always farther, by
    // construction. A pure distance sort would rank the unknown venue first;
    // this proves the open-first grouping overrides that.
    const origin = { lat: unknownVenue!.lat, lng: unknownVenue!.lng };
    const { result } = renderHook(() => useMapFilters(origin));
    act(() => result.current.setFilterOpenNow(true));

    const ids = result.current.filteredVenues.map((v) => v.id);
    expect(ids.indexOf(openVenue!.id)).toBeLessThan(ids.indexOf(unknownVenue!.id));
  });

  test("with Open now off, pure distance order is restored regardless of open status", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterOpenNow(true));
    act(() => result.current.setFilterOpenNow(false));
    const distances = result.current.filteredVenues.map(
      (v) => (v as unknown as { distanceMiles: number }).distanceMiles,
    );
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });

  test("a venue with known hours that is currently closed is still dropped by Open now", () => {
    // 2026-06-21T14:00:00-06:00 (beforeEach fake clock) — Saturday 2pm MDT.
    // Pick a real venue whose computed status is "closed_today" (hours ARE
    // known, just not open right now) — distinct from "no_hours" (unknown),
    // which is the case the previous test proves survives instead.
    const now = new Date("2026-06-21T14:00:00-06:00");
    const knownClosed = allVenues.find(
      (v) => computeOpenStatus(v.hours_weekly, now).state === "closed_today",
    );
    expect(knownClosed).toBeDefined();
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.setFilterOpenNow(true));
    const stillPresent = result.current.filteredVenues.some((v) => v.id === knownClosed!.id);
    expect(stillPresent).toBe(false);
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

// ── 6. Favorites ─────────────────────────────────────────────────────────────
// The Favorites FILTER was removed (#513 — "Saved in the bottom bar already
// covers it"). favoriteSet/savedVenues stay (HamburgerMenu's Saved view still
// needs them); there is no longer a filterFavorites toggle to test.

describe("useMapFilters — favorites (filter removed, #513)", () => {
  test("no filterFavorites/setFilterFavorites on the returned API", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect((result.current as Record<string, unknown>).filterFavorites).toBeUndefined();
    expect((result.current as Record<string, unknown>).setFilterFavorites).toBeUndefined();
  });

  test("savedVenues still reflects a favorited venue (used by HamburgerMenu's Saved view)", () => {
    const firstId = allVenues[0]!.id;
    addFavorite(firstId);
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    expect(result.current.savedVenues.some((v) => v.id === firstId)).toBe(true);
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

// ── 8. toggleCategory (#513 — multi-category select) ─────────────────────────
// Replaces the old single-select handleCategoryBrowseSelect: the Filters panel
// renders 8 independent checkboxes, so toggling one category must not clobber
// another that's already on.

describe("useMapFilters — toggleCategory", () => {
  test("toggling one category on filters to just that category", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.toggleCategory("grocery"));
    expect(result.current.selectedCategories).toEqual(new Set(["grocery"]));
    const categories = result.current.filteredVenues.map((v) => v.category);
    expect(categories.every((c) => c === "grocery")).toBe(true);
  });

  test("toggling a second category adds it — both categories' venues show", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.toggleCategory("grocery"));
    act(() => result.current.toggleCategory("pantry"));
    expect(result.current.selectedCategories).toEqual(new Set(["grocery", "pantry"]));
    const categories = new Set(result.current.filteredVenues.map((v) => v.category));
    expect(categories.has("grocery")).toBe(true);
    expect(categories.has("pantry")).toBe(true);
    expect(categories.size).toBe(2);
  });

  test("toggling an active category off removes just that one", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.toggleCategory("grocery"));
    act(() => result.current.toggleCategory("pantry"));
    act(() => result.current.toggleCategory("grocery"));
    expect(result.current.selectedCategories).toEqual(new Set(["pantry"]));
  });

  test("toggling the last active category off normalizes to null (restores all venues)", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => result.current.toggleCategory("grocery"));
    act(() => result.current.toggleCategory("grocery"));
    expect(result.current.selectedCategories).toBeNull();
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
  });
});

// ── 9. clearFilters / handleClearAllFilters ───────────────────────────────────
// #513 gives the Filters panel its own "Clear all" distinct from ListView's
// existing "clear filters" action: the panel only owns categories/open-now/
// SNAP/WIC, and must NOT also wipe the user's typed search text — a search
// box clearing itself when you tap a filter control would be surprising.
// handleClearAllFilters (query + everything) keeps its existing behavior for
// ListView's own clear-filters button.

describe("useMapFilters — clearFilters (Filters panel's Clear all)", () => {
  test("clears categories/open-now/SNAP/WIC but leaves the typed query alone", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => {
      result.current.setFilterSnap(true);
      result.current.setFilterOpenNow(true);
      result.current.setQuery("test");
      result.current.toggleCategory("pantry");
    });
    act(() => result.current.clearFilters());
    expect(result.current.selectedCategories).toBeNull();
    expect(result.current.filterOpenNow).toBe(false);
    expect(result.current.filterSnap).toBe(false);
    expect(result.current.filterWic).toBe(false);
    expect(result.current.anyFilterActive).toBe(false);
    // Query is untouched by the panel's Clear all.
    expect(result.current.query).toBe("test");
  });
});

describe("useMapFilters — handleClearAllFilters", () => {
  test("clears all active filters and query, restores full venue list", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER));
    act(() => {
      result.current.setFilterSnap(true);
      result.current.setFilterOpenNow(true);
      result.current.setQuery("test");
      result.current.toggleCategory("pantry");
    });
    expect(result.current.anyFilterActive).toBe(true);
    act(() => result.current.handleClearAllFilters());
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
    expect(result.current.anyFilterActive).toBe(false);
    expect(result.current.query).toBe("");
    expect(result.current.selectedCategories).toBeNull();
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
    act(() => result.current.toggleCategory("grocery"));
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

// ── 13. Blessing boxes (extraVenues) — map-first rework, 2026-09-18 ─────────
// Confirms boxes merged in via `extraVenues` flow through the SAME
// category-filter/count/sort pipeline every other venue uses (build
// requirement #4: "closest box to me" via the existing nearest-first sort),
// with no box-specific branch needed anywhere in this file.

function makeBoxVenue(id: string, lat: number, lng: number): Venue {
  return {
    id,
    name: `Box ${id}`,
    category: "blessing_box",
    lat,
    lng,
    address: "Test address",
    source: "manual",
    last_verified: "2026-09-01",
  };
}

describe("useMapFilters — blessing boxes via extraVenues", () => {
  test("boxes are included in filteredVenues alongside the static venue set", () => {
    const boxes = [makeBoxVenue("box-1", 38.27, -104.61)];
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER, boxes));
    expect(result.current.filteredVenues.length).toBe(allVenues.length + 1);
    expect(result.current.filteredVenues.some((v) => v.id === "box-1")).toBe(true);
  });

  test("the blessing_box category filter returns only boxes, and the count matches", () => {
    const boxes = [makeBoxVenue("box-1", 38.27, -104.61), makeBoxVenue("box-2", 38.3, -104.65)];
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER, boxes));
    act(() => {
      result.current.setSelectedCategories(new Set(["blessing_box"]));
    });
    expect(result.current.filteredVenues.length).toBe(2);
    expect(result.current.filteredVenues.every((v) => v.category === "blessing_box")).toBe(true);
    expect(result.current.allVenueCounts.blessing_box).toBe(2);
  });

  test("boxes sort into the nearest-first order with ordinary venues, not appended separately", () => {
    // A box placed essentially AT the origin should rank first, ahead of
    // every real venue (all of which sit some real distance away).
    const boxes = [makeBoxVenue("box-at-origin", PUEBLO_CENTER.lat, PUEBLO_CENTER.lng)];
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER, boxes));
    expect(result.current.filteredVenues[0]?.id).toBe("box-at-origin");
    const distances = result.current.filteredVenues.map(
      (v) => (v as unknown as { distanceMiles: number }).distanceMiles,
    );
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
  });

  test("an empty extraVenues array (default) behaves exactly like no boxes fetched yet", () => {
    const { result } = renderHook(() => useMapFilters(PUEBLO_CENTER, []));
    expect(result.current.filteredVenues.length).toBe(allVenues.length);
  });
});
