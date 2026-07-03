/**
 * CategoryAutoZoom tests — issue #111
 *
 * Tests the pure utilities exported from MapWrapper:
 *   - computeCategoryBounds: bounds computation from venue lat/lng
 *   - CATEGORY_FIT_MAX_ZOOM: cap value guard for sparse categories
 *   - CATEGORY_FIT_PADDING_MOBILE / CATEGORY_FIT_PADDING_DESKTOP: padding shapes
 *
 * The fitBounds side-effect in MapWrapper itself is driven by a useEffect on
 * activeCategoryFilter and mapboxMap — that effect's own lifecycle (including
 * its interaction with the #231 fixed home view on initial load) is covered
 * by the full-MapWrapper-mount integration test in
 * src/__tests__/CategoryAutoZoomHomeView.test.tsx (#247), not here.
 */

import { describe, test, expect } from "vitest";
import {
  computeCategoryBounds,
  CATEGORY_FIT_MAX_ZOOM,
  CATEGORY_FIT_PADDING_MOBILE,
  CATEGORY_FIT_PADDING_DESKTOP,
} from "@/components/MapWrapper";
import type { Venue } from "@/types/venue";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVenue(id: string, lat: number, lng: number, category: Venue["category"] = "pantry"): Venue {
  return {
    id,
    name: `Venue ${id}`,
    category,
    lat,
    lng,
    address: `${id} Test St`,
    source: "test",
    last_verified: "2026-01-01",
  };
}

// ─── computeCategoryBounds ────────────────────────────────────────────────────

describe("computeCategoryBounds", () => {
  test("returns null for an empty array", () => {
    expect(computeCategoryBounds([])).toBeNull();
  });

  test("returns tight bounds for a single venue", () => {
    const venue = makeVenue("v1", 38.25, -104.61);
    const bounds = computeCategoryBounds([venue]);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    // Single point: all four edges equal the venue coords
    expect(lngW).toBe(-104.61);
    expect(lngE).toBe(-104.61);
    expect(latS).toBe(38.25);
    expect(latN).toBe(38.25);
  });

  test("returns correct bounding box for 2 venues (sparse category)", () => {
    // Simulates the meal_site category (2 venues)
    const venues = [
      makeVenue("m1", 38.24, -104.62, "meal_site"),
      makeVenue("m2", 38.27, -104.59, "meal_site"),
    ];
    const bounds = computeCategoryBounds(venues);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    expect(lngW).toBeCloseTo(-104.62);
    expect(lngE).toBeCloseTo(-104.59);
    expect(latS).toBeCloseTo(38.24);
    expect(latN).toBeCloseTo(38.27);
  });

  test("returns correct bounding box for 3 venues spread across Pueblo County", () => {
    // Simulates farm category (3 venues)
    const venues = [
      makeVenue("f1", 38.20, -104.65, "farm"),
      makeVenue("f2", 38.30, -104.55, "farm"),
      makeVenue("f3", 38.25, -104.60, "farm"),
    ];
    const bounds = computeCategoryBounds(venues);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    expect(lngW).toBeCloseTo(-104.65);
    expect(lngE).toBeCloseTo(-104.55);
    expect(latS).toBeCloseTo(38.20);
    expect(latN).toBeCloseTo(38.30);
  });

  test("handles many venues and always picks the extreme coordinates", () => {
    const venues = [
      makeVenue("a", 38.26, -104.61, "pantry"),
      makeVenue("b", 38.22, -104.70, "pantry"),
      makeVenue("c", 38.35, -104.58, "pantry"),
      makeVenue("d", 38.28, -104.63, "pantry"),
      makeVenue("e", 38.19, -104.55, "pantry"),
    ];
    const bounds = computeCategoryBounds(venues);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    // Extremes: lng [-104.70, -104.55], lat [38.19, 38.35]
    expect(lngW).toBeCloseTo(-104.70);
    expect(lngE).toBeCloseTo(-104.55);
    expect(latS).toBeCloseTo(38.19);
    expect(latN).toBeCloseTo(38.35);
  });

  test("accepts Pick<Venue, 'lat' | 'lng'> (not just full Venue objects)", () => {
    const points = [
      { lat: 38.20, lng: -104.60 },
      { lat: 38.30, lng: -104.50 },
    ];
    const bounds = computeCategoryBounds(points);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    expect(lngW).toBeCloseTo(-104.60);
    expect(lngE).toBeCloseTo(-104.50);
    expect(latS).toBeCloseTo(38.20);
    expect(latN).toBeCloseTo(38.30);
  });

  test("output format is [[lngW, latS], [lngE, latN]] (Mapbox fitBounds format)", () => {
    const venues = [
      makeVenue("x", 38.25, -104.60),
      makeVenue("y", 38.28, -104.62),
    ];
    const bounds = computeCategoryBounds(venues);
    // Shape: 2-element array of 2-element tuples
    expect(Array.isArray(bounds)).toBe(true);
    expect(bounds!.length).toBe(2);
    expect(bounds![0].length).toBe(2);
    expect(bounds![1].length).toBe(2);
    // [0] = SW corner: lng is the more negative (west) value
    expect(bounds![0][0]).toBeLessThan(bounds![1][0]); // lngW < lngE
    expect(bounds![0][1]).toBeLessThan(bounds![1][1]); // latS < latN
  });
});

// ─── Sparse category cap guard ────────────────────────────────────────────────

describe("CATEGORY_FIT_MAX_ZOOM", () => {
  test("max zoom cap is 14 or 15 (prevents over-zoom on sparse categories)", () => {
    // Spec says cap at 14–15. We assert the value is in that range.
    expect(CATEGORY_FIT_MAX_ZOOM).toBeGreaterThanOrEqual(14);
    expect(CATEGORY_FIT_MAX_ZOOM).toBeLessThanOrEqual(15);
  });

  test("max zoom cap does not exceed 16 (venue flyTo zoom) to avoid over-zoom", () => {
    expect(CATEGORY_FIT_MAX_ZOOM).toBeLessThan(16);
  });
});

// ─── Padding constants ────────────────────────────────────────────────────────

describe("CATEGORY_FIT_PADDING constants", () => {
  test("mobile padding has all four sides defined", () => {
    const { top, bottom, left, right } = CATEGORY_FIT_PADDING_MOBILE;
    expect(typeof top).toBe("number");
    expect(typeof bottom).toBe("number");
    expect(typeof left).toBe("number");
    expect(typeof right).toBe("number");
  });

  test("desktop padding has all four sides defined", () => {
    const { top, bottom, left, right } = CATEGORY_FIT_PADDING_DESKTOP;
    expect(typeof top).toBe("number");
    expect(typeof bottom).toBe("number");
    expect(typeof left).toBe("number");
    expect(typeof right).toBe("number");
  });

  test("mobile bottom padding is larger than desktop bottom (bottom-sheet peek bar clearance)", () => {
    // Mobile needs extra bottom clearance for the bottom-sheet peek bar
    expect(CATEGORY_FIT_PADDING_MOBILE.bottom).toBeGreaterThan(CATEGORY_FIT_PADDING_DESKTOP.bottom);
  });

  test("desktop right padding is larger than mobile right (control stack clearance)", () => {
    // Desktop needs extra right clearance for the control stack
    expect(CATEGORY_FIT_PADDING_DESKTOP.right).toBeGreaterThanOrEqual(CATEGORY_FIT_PADDING_MOBILE.right);
  });

  test("all padding values are positive numbers", () => {
    for (const [key, val] of Object.entries(CATEGORY_FIT_PADDING_MOBILE)) {
      expect(val, `mobile.${key}`).toBeGreaterThan(0);
    }
    for (const [key, val] of Object.entries(CATEGORY_FIT_PADDING_DESKTOP)) {
      expect(val, `desktop.${key}`).toBeGreaterThan(0);
    }
  });
});

// ─── Category filter → fitBounds integration (map mock) ───────────────────────
//
// We can't mount full MapWrapper (needs Mapbox WebGL), but we can test the
// bounds computation path end-to-end using real venue data from the venues
// module and verify the output is a valid fitBounds argument.

describe("category autozoom — integration with real venue data", () => {
  // Import the actual venues to verify bounds encompass all real category members
  // This is a pure data + computation test — no DOM or React.
  test("all real pantry venues are within computed pantry bounds", async () => {
    const { venues } = await import("@/data/venues");
    const pantries = venues.filter((v) => v.category === "pantry");
    const bounds = computeCategoryBounds(pantries);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    for (const v of pantries) {
      expect(v.lng).toBeGreaterThanOrEqual(lngW);
      expect(v.lng).toBeLessThanOrEqual(lngE);
      expect(v.lat).toBeGreaterThanOrEqual(latS);
      expect(v.lat).toBeLessThanOrEqual(latN);
    }
  });

  test("all real meal_site venues (sparse, 2 venues) are within computed bounds", async () => {
    const { venues } = await import("@/data/venues");
    const mealSites = venues.filter((v) => v.category === "meal_site");
    // Sparse category: should not be empty
    expect(mealSites.length).toBeGreaterThan(0);
    const bounds = computeCategoryBounds(mealSites);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    for (const v of mealSites) {
      expect(v.lng).toBeGreaterThanOrEqual(lngW);
      expect(v.lng).toBeLessThanOrEqual(lngE);
      expect(v.lat).toBeGreaterThanOrEqual(latS);
      expect(v.lat).toBeLessThanOrEqual(latN);
    }
  });

  test("computed bounds for all venues stays within Pueblo County maxBounds", async () => {
    const { venues } = await import("@/data/venues");
    const { PUEBLO_COUNTY_BBOX } = await import("@/data/pueblo-bbox");
    const bounds = computeCategoryBounds(venues);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    const [[bboxLngW, bboxLatS], [bboxLngE, bboxLatN]] = PUEBLO_COUNTY_BBOX;
    expect(lngW).toBeGreaterThanOrEqual(bboxLngW);
    expect(lngE).toBeLessThanOrEqual(bboxLngE);
    expect(latS).toBeGreaterThanOrEqual(bboxLatS);
    expect(latN).toBeLessThanOrEqual(bboxLatN);
  });

  test("all 7 categories have at least one venue with computable bounds", async () => {
    const { venues } = await import("@/data/venues");
    const categories: Venue["category"][] = [
      "pantry", "grocery", "convenience", "farm", "garden", "edible_landscape", "meal_site",
    ];
    for (const cat of categories) {
      const catVenues = venues.filter((v) => v.category === cat);
      const bounds = computeCategoryBounds(catVenues);
      expect(bounds, `category "${cat}" should have computable bounds`).not.toBeNull();
    }
  });
});
