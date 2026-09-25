/**
 * Invariants for the venues data layer that survive admin publishes.
 *
 * published-venues.ts is regenerated from Cloudflare D1 on every publish, so
 * this file no longer pins its exact contents (that was a one-time #237
 * extraction proof, now discharged). What it still guards: that venues.ts
 * exposes publishedVenues unchanged (#597 — the old benefit-flag overlay is
 * gone, D1 is the sole SNAP/WIC source), the seed-array split, the pfpVenues
 * re-export matching its leaf module, and the untouched category maps.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { venues, pfpVenues, categoryLabels, categoryColors, categoryIcon } from "@/data/venues";
import { publishedVenues, publishedAt } from "@/data/published-venues";
import { serializePublishedVenuesFile } from "@/lib/publishVenues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";

describe("venues data-layer invariants", () => {
  // The data_only carve-out (ci.yml / weekly-security-audit.yml #336) skips
  // lint/full-suite/audit for a publish-bot PR on the strength of PATH alone
  // (the diff touches exactly src/data/published-venues.ts). Nothing else
  // proves the file's BODY is actually data — a .ts module, anything
  // syntactically valid after `export const publishedVenues: Venue[] =`
  // passes typecheck/build/Semgrep/TruffleHog and rides the carve-out
  // through auto-merge.
  //
  // Board review fix: the prior version of this proof only parsed the TEXT
  // AFTER a marker string (`export const publishedVenues: Venue[] = ` /
  // `export const publishedAt = `) — it never looked at anything BEFORE
  // those markers, so executable code sitting ahead of them (e.g. in the
  // header, or between the two declarations) would pass undetected. This
  // byte-equality assertion is strictly stronger: it reserializes the
  // imported data through the REAL serializer the publish route calls
  // (serializePublishedVenuesFile, src/lib/publishVenues.ts) and asserts the
  // committed file's raw source is IDENTICAL, byte for byte, to that output.
  // The only way this passes is if the whole file — header, imports, BOTH
  // exports, down to whitespace — is exactly what the serializer would have
  // produced from this same data. There is no region left unchecked.
  test("published-venues.ts's raw source is byte-identical to serializePublishedVenuesFile() output", () => {
    const raw = readFileSync(join(process.cwd(), "src", "data", "published-venues.ts"), "utf-8");
    expect(raw).toBe(serializePublishedVenuesFile(publishedVenues, { publishedAt }));
  });

  test("venues is publishedVenues directly — no runtime overlay, D1 is the sole SNAP/WIC source (#597)", () => {
    // The old benefit-flags.ts overlay is deleted; venues.ts now just
    // re-exports publishedVenues. Pins that wiring (identity, not a copy) so
    // a future edit can't silently reintroduce a transform here, and that
    // SNAP/WIC fields on `venues` always equal published-venues.ts's own —
    // no separate flag source left to drift out of sync.
    expect(venues).toBe(publishedVenues);
    expect(venues.filter((v) => v.accepts_snap).length).toBe(
      publishedVenues.filter((v) => v.accepts_snap).length,
    );
    expect(venues.filter((v) => v.accepts_wic).length).toBe(
      publishedVenues.filter((v) => v.accepts_wic).length,
    );
  });

  test("seed arrays total 106 records: 10 pfp + 60 osm + 36 plentiful", () => {
    expect(pfpVenues).toHaveLength(10);
    expect(groceryOsmVenues).toHaveLength(60);
    expect(plentifulPantries).toHaveLength(36);
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

  // Blessing Boxes slice 1 added an 8th category — categoryLabels below now
  // includes it, updated at the same time the category-picker components
  // (formerly CategoryDropdown.tsx, now FilterPanel.tsx/CategoryChips.tsx) did.
  test("categoryLabels / categoryColors / categoryIcon are untouched by the publish refactor (blessing_box added by a later slice)", () => {
    expect(categoryLabels).toEqual({
      pantry: "Food Pantry",
      grocery: "Grocery / Supermarket",
      convenience: "Convenience Store",
      farm: "Farm / Market",
      garden: "Community Garden",
      edible_landscape: "Edible Landscape",
      meal_site: "Meal Site",
      blessing_box: "Blessing Box",
    });
    expect(categoryColors.pantry).toBe("#BE2D45");
    expect(categoryIcon.pantry).toBe("ShoppingBasket");
  });
});
