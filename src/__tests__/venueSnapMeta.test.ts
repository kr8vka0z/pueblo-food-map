/**
 * #921: search titles and descriptions for stores that take SNAP. A SNAP
 * venue's title reads "<Name>, <City>, CO: Accepts SNAP/EBT" and its meta
 * description opens with the SNAP/WIC sentence; a non-SNAP venue keeps the
 * #704 shape. Synthetic fixtures only (see venueSummary.test.ts's header).
 */

import { describe, test, expect } from "vitest";
import { buildVenueMetaDescription, buildVenueTitle } from "@/lib/venueSummary";
import type { Venue } from "@/types/venue";

const base: Venue = {
  id: "test-snap-meta",
  name: "Test Corner Mart",
  category: "convenience",
  lat: 38.27,
  lng: -104.61,
  address: "100 Test St, Avondale, CO 81022",
  source: "test",
  last_verified: "2026-05-12",
  hours_weekly: { mon: ["08:00-20:00"], tue: ["08:00-20:00"], wed: ["08:00-20:00"] },
};

describe("SNAP venue title and description (#921)", () => {
  test.each([
    ["en", true, "Test Corner Mart, Avondale, CO: Accepts SNAP/EBT", "Test Corner Mart accepts SNAP/EBT and WIC."],
    ["es", true, "Test Corner Mart, Avondale, CO: Acepta SNAP/EBT", "Test Corner Mart acepta SNAP/EBT y WIC."],
    // Non-SNAP: the #704 title ladder (its rung depends on length) and the
    // name-and-place sentence first, as before.
    ["en", false, null, "Test Corner Mart is a convenience store"],
    ["es", false, null, "Test Corner Mart es una tienda"],
  ] as const)("%s, accepts_snap %s", (locale, snap, title, opening) => {
    const v = { ...base, accepts_snap: snap, accepts_wic: snap };
    if (title) expect(buildVenueTitle(v, locale)).toBe(title);
    else expect(buildVenueTitle(v, locale)).toMatch(/^Test Corner Mart – .* Avondale, CO$/);
    const description = buildVenueMetaDescription(v, locale);
    expect(description.startsWith(opening)).toBe(true);
    expect(description.length).toBeLessThanOrEqual(160);
    // Still whole sentences after the reorder: the address sentence follows.
    expect(description).toContain("100 Test St");
  });
});
