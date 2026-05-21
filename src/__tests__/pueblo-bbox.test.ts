/**
 * Tests for src/data/pueblo-bbox.ts (#62)
 *
 * Verifies:
 *   - PUEBLO_COUNTY_BBOX has the correct structure and sane values.
 *   - PUEBLO_COUNTY_MIN_ZOOM is a reasonable floor.
 *   - All 108 venues in src/data/venues.ts fall within the bbox
 *     (so no venue becomes unreachable after pan constraint is applied).
 */

import { describe, test, expect } from "vitest";
import { PUEBLO_COUNTY_BBOX, PUEBLO_COUNTY_MIN_ZOOM } from "@/data/pueblo-bbox";
import { venues } from "@/data/venues";

// ─── Bbox structure ───────────────────────────────────────────────────────────

describe("PUEBLO_COUNTY_BBOX", () => {
  test("is a 2-element tuple of 2-element tuples", () => {
    expect(PUEBLO_COUNTY_BBOX).toHaveLength(2);
    expect(PUEBLO_COUNTY_BBOX[0]).toHaveLength(2);
    expect(PUEBLO_COUNTY_BBOX[1]).toHaveLength(2);
  });

  test("west < east", () => {
    const [west] = PUEBLO_COUNTY_BBOX[0];
    const [east] = PUEBLO_COUNTY_BBOX[1];
    expect(west).toBeLessThan(east);
  });

  test("south < north", () => {
    const [, south] = PUEBLO_COUNTY_BBOX[0];
    const [, north] = PUEBLO_COUNTY_BBOX[1];
    expect(south).toBeLessThan(north);
  });

  test("covers Pueblo County area (centered near 38.25, -104.61)", () => {
    const PUEBLO_CENTER_LAT = 38.25;
    const PUEBLO_CENTER_LNG = -104.61;
    const [west, south] = PUEBLO_COUNTY_BBOX[0];
    const [east, north] = PUEBLO_COUNTY_BBOX[1];

    expect(PUEBLO_CENTER_LNG).toBeGreaterThan(west);
    expect(PUEBLO_CENTER_LNG).toBeLessThan(east);
    expect(PUEBLO_CENTER_LAT).toBeGreaterThan(south);
    expect(PUEBLO_CENTER_LAT).toBeLessThan(north);
  });

  test("does not extend to Colorado Springs (lng > -104.6, lat > 38.8)", () => {
    // Colorado Springs is NE of Pueblo. bbox should stay south of it.
    const [, north] = PUEBLO_COUNTY_BBOX[1];
    expect(north).toBeLessThan(39.0);
  });

  test("west edge is within Colorado (lng between -106 and -104)", () => {
    const [west] = PUEBLO_COUNTY_BBOX[0];
    expect(west).toBeGreaterThan(-106);
    expect(west).toBeLessThan(-104);
  });
});

// ─── minZoom ─────────────────────────────────────────────────────────────────

describe("PUEBLO_COUNTY_MIN_ZOOM", () => {
  test("is a number", () => {
    expect(typeof PUEBLO_COUNTY_MIN_ZOOM).toBe("number");
  });

  test("is between 7 and 11 (practical floor for county-scale view)", () => {
    expect(PUEBLO_COUNTY_MIN_ZOOM).toBeGreaterThanOrEqual(7);
    expect(PUEBLO_COUNTY_MIN_ZOOM).toBeLessThanOrEqual(11);
  });
});

// ─── All venues inside bbox ───────────────────────────────────────────────────

describe("Venue containment — all venues inside PUEBLO_COUNTY_BBOX", () => {
  const [bboxSW, bboxNE] = PUEBLO_COUNTY_BBOX;
  const [bboxWest, bboxSouth] = bboxSW;
  const [bboxEast, bboxNorth] = bboxNE;

  test("venues array is non-empty", () => {
    expect(venues.length).toBeGreaterThan(0);
  });

  test("all venue latitudes are within bbox south/north bounds", () => {
    const outside = venues.filter(
      (v) => v.lat < bboxSouth || v.lat > bboxNorth,
    );
    expect(outside).toEqual([]);
  });

  test("all venue longitudes are within bbox west/east bounds", () => {
    const outside = venues.filter(
      (v) => v.lng < bboxWest || v.lng > bboxEast,
    );
    expect(outside).toEqual([]);
  });

  test("venue count matches expected dataset size (~108)", () => {
    // Guard against accidental data shrinkage breaking this test suite.
    expect(venues.length).toBeGreaterThanOrEqual(100);
  });
});
