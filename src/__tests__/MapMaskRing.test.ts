/**
 * Guards the county mask's outer ring (Map.tsx MASK_OUTER_RING).
 *
 * A world-spanning ring ([-180,-90]..[180,90]) rendered as huge black
 * triangles over the whole map on mapbox-gl 3.31 (prod, 2026-09-21). These
 * checks are pure geometry, so they fail against that old ring without
 * needing a WebGL canvas. Incident record: #576.
 */
import { describe, test, expect, vi } from "vitest";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));
vi.mock("react-map-gl/mapbox", () => ({}));

import { MASK_OUTER_RING } from "@/components/Map";
import { PUEBLO_COUNTY_BBOX } from "@/data/pueblo-bbox";

// Web Mercator can only project latitudes inside ±85.0511°.
const MERCATOR_MAX_LAT = 85.0511;

describe("incident-2026-09-21-county-mask-black-triangles: county mask outer ring", () => {
  test("is a closed ring", () => {
    expect(MASK_OUTER_RING[0]).toEqual(MASK_OUTER_RING[MASK_OUTER_RING.length - 1]);
  });

  test("winds counter-clockwise (GeoJSON exterior)", () => {
    let area2 = 0;
    for (let i = 0; i < MASK_OUTER_RING.length - 1; i++) {
      const [x1, y1] = MASK_OUTER_RING[i];
      const [x2, y2] = MASK_OUTER_RING[i + 1];
      area2 += x1 * y2 - x2 * y1;
    }
    expect(area2).toBeGreaterThan(0);
  });

  test("stays inside Web Mercator's latitude range and never spans the world", () => {
    for (const [lng, lat] of MASK_OUTER_RING) {
      expect(Math.abs(lat)).toBeLessThan(MERCATOR_MAX_LAT);
      expect(Math.abs(lng)).toBeLessThan(180);
    }
  });

  test("fully encloses the county bbox the camera is confined to", () => {
    const [[west, south], [east, north]] = PUEBLO_COUNTY_BBOX;
    const lngs = MASK_OUTER_RING.map(([lng]) => lng);
    const lats = MASK_OUTER_RING.map(([, lat]) => lat);
    expect(Math.min(...lngs)).toBeLessThan(west);
    expect(Math.max(...lngs)).toBeGreaterThan(east);
    expect(Math.min(...lats)).toBeLessThan(south);
    expect(Math.max(...lats)).toBeGreaterThan(north);
  });
});
