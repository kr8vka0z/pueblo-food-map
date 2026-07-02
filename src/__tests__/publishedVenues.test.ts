/**
 * Byte-identical proof for the published-venues.ts extraction
 * (#237 checkpoint d, Part 1 / spec §7 step 1).
 *
 * This is the whole safety argument for the refactor: reconstruct the OLD
 * expression venues.ts used to compute inline
 * (`[...pfpVenues, ...groceryOsmVenues, ...plentifulPantries].map(overlay)`)
 * from the three raw source arrays directly, and assert the NEW `venues` /
 * `publishedVenues` exports are byte-for-byte identical via JSON.stringify
 * equality (deep structural equality alone wouldn't catch e.g. an
 * accidentally-added/reordered key — stringify does, given both sides
 * enumerate object keys in the same insertion order here).
 */

import { describe, test, expect } from "vitest";
import type { Venue } from "@/types/venue";
import { venues, pfpVenues, categoryLabels, categoryColors, categoryIcon } from "@/data/venues";
import { publishedVenues } from "@/data/published-venues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";
import { benefitFlags } from "@/data/benefit-flags";

describe("published-venues.ts extraction is byte-identical to pre-refactor venues.ts", () => {
  test("publishedVenues === the pre-refactor combined spread, byte for byte", () => {
    const oldCombined: Venue[] = [...pfpVenues, ...groceryOsmVenues, ...plentifulPantries];
    expect(JSON.stringify(publishedVenues)).toBe(JSON.stringify(oldCombined));
  });

  test("venues === the pre-refactor overlay expression, byte for byte", () => {
    const oldExpression: Venue[] = [...pfpVenues, ...groceryOsmVenues, ...plentifulPantries].map(
      (v) => {
        const f = benefitFlags[v.id];
        return f ? { ...v, accepts_snap: f.snap, accepts_wic: f.wic } : v;
      },
    );
    expect(JSON.stringify(venues)).toBe(JSON.stringify(oldExpression));
  });

  test("totals 108 records: 10 pfp + 60 osm + 38 plentiful", () => {
    expect(pfpVenues).toHaveLength(10);
    expect(groceryOsmVenues).toHaveLength(60);
    expect(plentifulPantries).toHaveLength(38);
    expect(publishedVenues).toHaveLength(108);
    expect(venues).toHaveLength(108);
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
