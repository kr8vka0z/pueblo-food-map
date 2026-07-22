/**
 * Invariants for the venues data layer that survive admin publishes.
 *
 * published-venues.ts is regenerated from Cloudflare D1 on every publish, so
 * this file no longer pins its exact contents (that was a one-time #237
 * extraction proof, now discharged). What it still guards: the benefit-flag
 * overlay wiring in venues.ts, the seed-array split, the pfpVenues re-export
 * matching its leaf module, and the untouched category maps.
 */

import { describe, test, expect } from "vitest";
import type { Venue } from "@/types/venue";
import { venues, pfpVenues, categoryLabels, categoryColors, categoryIcon } from "@/data/venues";
import { publishedVenues } from "@/data/published-venues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";
import { benefitFlags } from "@/data/benefit-flags";

describe("venues data-layer invariants", () => {
  test("venues applies the benefit-flag overlay on top of publishedVenues", () => {
    // venues.ts builds `venues` as publishedVenues.map(overlay); this pins that
    // wiring. Anchored to publishedVenues (not the seed spread) so it stays
    // valid after an admin publish regenerates published-venues.ts from D1.
    const expected: Venue[] = publishedVenues.map((v) => {
      const f = benefitFlags[v.id];
      return f ? { ...v, accepts_snap: f.snap, accepts_wic: f.wic } : v;
    });
    expect(JSON.stringify(venues)).toBe(JSON.stringify(expected));
  });

  test("seed arrays total 108 records: 10 pfp + 60 osm + 38 plentiful", () => {
    expect(pfpVenues).toHaveLength(10);
    expect(groceryOsmVenues).toHaveLength(60);
    expect(plentifulPantries).toHaveLength(38);
  });

  test("pfpVenues re-exported from venues.ts matches the leaf module used to build publishedVenues", async () => {
    // Guards specifically against a transcription slip when the pfpVenues
    // literal was extracted into its own file (src/data/pfp-venues.ts) —
    // if that copy ever drifted from what venues.ts re-exports, this would
    // be the first thing to catch it (the two tests above would also fail,
    // but less directly).
    const { pfpVenues: leafPfpVenues } = await import("@/data/pfp-venues");
    expect(JSON.stringify(pfpVenues)).toBe(JSON.stringify(leafPfpVenues));
  });

  test("categoryLabels / categoryColors / categoryIcon are untouched by the refactor", () => {
    expect(categoryLabels).toEqual({
      pantry: "Food Pantry",
      grocery: "Grocery / Supermarket",
      convenience: "Convenience Store",
      farm: "Farm / Market",
      garden: "Community Garden",
      edible_landscape: "Edible Landscape",
      meal_site: "Meal Site",
    });
    expect(categoryColors.pantry).toBe("#BE2D45");
    expect(categoryIcon.pantry).toBe("ShoppingBasket");
  });
});
