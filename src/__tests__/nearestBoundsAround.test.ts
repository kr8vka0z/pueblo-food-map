/**
 * nearestBoundsAround tests — #670 (Boxes bottom-nav: zoom to the visitor's
 * nearest N boxes, centered on the visitor, instead of fitting every box).
 *
 * Same pattern as CategoryAutoZoom.test.ts's computeCategoryBounds coverage:
 * exercises the pure helper directly, no map mount required. The MapWrapper
 * wiring (Boxes-on with a known location uses this instead of the normal
 * category fit) is covered separately in MapWrapperBoxesFit.test.tsx.
 */

import { describe, test, expect } from "vitest";
import { nearestBoundsAround } from "@/components/MapWrapper";
import { haversineMiles } from "@/lib/distance";
import type { Venue } from "@/types/venue";

function makeVenue(id: string, lat: number, lng: number): Pick<Venue, "lat" | "lng"> & { id: string } {
  return { id, lat, lng };
}

// Pueblo, CO-ish origin — arbitrary, just needs to be a plausible lat/lng.
const ORIGIN = { lat: 38.2544, lng: -104.6091 };

describe("nearestBoundsAround", () => {
  test("returns null for zero boxes", () => {
    expect(nearestBoundsAround(ORIGIN, [], 5)).toBeNull();
  });

  test("is centered exactly on the origin", () => {
    // Deliberately asymmetric venue placement (all boxes to the northeast) —
    // a plain bbox over these points would be off-center; the fit box must
    // still center on the visitor per the issue's requirement.
    const venues = [
      makeVenue("a", 38.30, -104.55),
      makeVenue("b", 38.32, -104.50),
      makeVenue("c", 38.28, -104.58),
    ];
    const bounds = nearestBoundsAround(ORIGIN, venues, 3);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    expect(lngE - ORIGIN.lng).toBeCloseTo(ORIGIN.lng - lngW, 10);
    expect(latN - ORIGIN.lat).toBeCloseTo(ORIGIN.lat - latS, 10);
  });

  test("includes exactly the nearest 5 when more than 5 exist", () => {
    // 8 venues at increasing distance north of ORIGIN — the 5th-nearest
    // (index 4, ~0.05 deg away) sets the half-size; the 6th/7th/8th
    // (farther) must NOT be what determines the box size.
    const venues = Array.from({ length: 8 }, (_, i) =>
      makeVenue(`v${i}`, ORIGIN.lat + (i + 1) * 0.01, ORIGIN.lng),
    );
    const bounds = nearestBoundsAround(ORIGIN, venues, 5);
    expect(bounds).not.toBeNull();
    const [, latN] = bounds![1];
    const fifthNearestDistance = haversineMiles(ORIGIN, venues[4]); // v4 = 5th nearest
    const sixthNearestDistance = haversineMiles(ORIGIN, venues[5]);
    // 1 decimal (0.05mi tolerance): the box is built from flat mile/degree
    // ratios (see MapWrapper.tsx's WHY comment on nearestBoundsAround), so a
    // haversine re-measurement of its edge won't match to haversine precision
    // — only close enough that the right box was picked.
    const halfSizeMiles = haversineMiles(ORIGIN, { lat: latN, lng: ORIGIN.lng });
    expect(halfSizeMiles).toBeCloseTo(fifthNearestDistance, 1);
    expect(halfSizeMiles).toBeLessThan(sixthNearestDistance);
  });

  test("uses all of them when fewer than 5 boxes exist", () => {
    const venues = [
      makeVenue("a", ORIGIN.lat + 0.01, ORIGIN.lng),
      makeVenue("b", ORIGIN.lat + 0.03, ORIGIN.lng), // farthest of the 2
    ];
    const bounds = nearestBoundsAround(ORIGIN, venues, 5);
    expect(bounds).not.toBeNull();
    const [, latN] = bounds![1];
    const farthestDistance = haversineMiles(ORIGIN, venues[1]);
    const halfSizeMiles = haversineMiles(ORIGIN, { lat: latN, lng: ORIGIN.lng });
    expect(halfSizeMiles).toBeCloseTo(farthestDistance, 1);
  });

  test("a single box produces a non-degenerate box sized to that one distance", () => {
    const venues = [makeVenue("a", ORIGIN.lat + 0.02, ORIGIN.lng + 0.02)];
    const bounds = nearestBoundsAround(ORIGIN, venues, 5);
    expect(bounds).not.toBeNull();
    const [[lngW, latS], [lngE, latN]] = bounds!;
    expect(lngE).toBeGreaterThan(lngW);
    expect(latN).toBeGreaterThan(latS);
  });
});
