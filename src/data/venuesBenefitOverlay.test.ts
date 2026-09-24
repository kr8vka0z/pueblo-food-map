/**
 * venuesBenefitOverlay.test.ts — unit coverage for withBenefitFlagsOverlay
 * (src/data/venues.ts), the NULL-guard fix for #597 / #238 ("admin edits
 * win"; spec §7 step 1, "NB4").
 *
 * Why a separate file with synthetic fixtures, not just
 * publishedVenues.test.ts's real-data assertions: today's real
 * published-venues.ts has no admin-set accepts_snap/accepts_wic for any
 * overlay-covered venue yet (0014 hasn't landed on prod + been published —
 * see venues.ts's header), so real data can only ever exercise the "fill an
 * unset field" branch. The "never overwrite an already-set field" branch —
 * the actual behavior change this PR ships — needs a fixture where the
 * published value is already non-undefined.
 */

import { describe, test, expect } from "vitest";
import { withBenefitFlagsOverlay } from "@/data/venues";
import type { Venue } from "@/types/venue";

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-venue",
    name: "Test Venue",
    category: "grocery",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St",
    source: "test fixture",
    last_verified: "2026-09-24",
    ...overrides,
  };
}

describe("withBenefitFlagsOverlay", () => {
  test("no overlay entry for this id: venue passes through unchanged", () => {
    const v = makeVenue();
    expect(withBenefitFlagsOverlay(v, undefined)).toBe(v);
  });

  test("overlay entry, published value undefined (D1 NULL): overlay fills it", () => {
    const v = makeVenue({ accepts_snap: undefined, accepts_wic: undefined });
    const result = withBenefitFlagsOverlay(v, { snap: true, wic: false });
    expect(result.accepts_snap).toBe(true);
    expect(result.accepts_wic).toBe(false);
  });

  test("overlay entry, published value already set: admin edit wins, overlay guess is discarded (#238)", () => {
    // The overlay's own match says snap=true/wic=true, but D1 already holds
    // an admin's explicit false/false — those must survive untouched.
    const v = makeVenue({ accepts_snap: false, accepts_wic: false });
    const result = withBenefitFlagsOverlay(v, { snap: true, wic: true });
    expect(result.accepts_snap).toBe(false);
    expect(result.accepts_wic).toBe(false);
  });

  test("overlay entry, one field set and one unset: guard applies per column independently", () => {
    const v = makeVenue({ accepts_snap: false, accepts_wic: undefined });
    const result = withBenefitFlagsOverlay(v, { snap: true, wic: true });
    expect(result.accepts_snap).toBe(false); // admin's explicit "no" wins
    expect(result.accepts_wic).toBe(true); // was unset, overlay fills it
  });
});
