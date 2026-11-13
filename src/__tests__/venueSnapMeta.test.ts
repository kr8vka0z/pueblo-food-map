/**
 * #921: search titles and descriptions for stores that take SNAP. A SNAP
 * venue's title reads "<Name>, <City>, CO: Accepts SNAP/EBT" and its meta
 * description opens with the SNAP/WIC sentence; a non-SNAP venue keeps the
 * #704 shape. Synthetic fixtures only (see venueSummary.test.ts's header).
 */

import { describe, test, expect } from "vitest";
import { buildVenueMetaDescription, buildVenueTitle, parseVenueCity } from "@/lib/venueSummary";
import { publishedVenues } from "@/data/published-venues";
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

  // A long name drops ", CO" but never the place (Codex round 1: "Walmart
  // Supercenter, Pueblo West" lost its town under the old "Name: Accepts" rung).
  // SNAP drops out only when even the shortest SNAP rung can't fit 70 chars
  // (es "Pueblo Farmer's Market" with the "Condado de Pueblo" fallback).
  test.each(["en", "es"] as const)("every published SNAP venue keeps its place in its %s title", (locale) => {
    const suffix = " · Pueblo Food Map".length;
    for (const v of publishedVenues.filter((v) => v.accepts_snap === true)) {
      const title = buildVenueTitle(v, locale);
      const city = parseVenueCity(v.address, locale);
      expect(title).toContain(city);
      expect(title.length + suffix).toBeLessThanOrEqual(70);
      if (!title.includes("SNAP/EBT")) expect(`${v.name}, ${city}: SNAP/EBT`.length + suffix).toBeGreaterThan(70);
    }
  });
});
