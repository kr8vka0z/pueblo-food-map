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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Venue } from "@/types/venue";
import { venues, pfpVenues, categoryLabels, categoryColors, categoryIcon } from "@/data/venues";
import { publishedVenues, publishedAt } from "@/data/published-venues";
import { serializePublishedVenuesFile } from "@/lib/publishVenues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";
import { benefitFlags } from "@/data/benefit-flags";

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

  test("venues applies the benefit-flag overlay on top of publishedVenues, NULL-guarded so an admin D1 edit wins (#597, #238)", () => {
    // venues.ts builds `venues` as publishedVenues.map(overlay); this pins that
    // wiring. Anchored to publishedVenues (not the seed spread) so it stays
    // valid after an admin publish regenerates published-venues.ts from D1.
    // NULL-guarded per column, matching venues.ts's own logic: the overlay
    // fills a field only when the published value is `undefined` (D1 NULL);
    // an explicit non-undefined value (an admin edit that survived a
    // publish) is never overwritten.
    const expected: Venue[] = publishedVenues.map((v) => {
      const f = benefitFlags[v.id];
      if (!f) return v;
      return {
        ...v,
        accepts_snap: v.accepts_snap === undefined ? f.snap : v.accepts_snap,
        accepts_wic: v.accepts_wic === undefined ? f.wic : v.accepts_wic,
      };
    });
    expect(JSON.stringify(venues)).toBe(JSON.stringify(expected));
  });

  test("venues overlay lets an explicit D1 accepts_snap/accepts_wic value win over benefit-flags.ts (#238 'admin edits win')", () => {
    // Direct behavioral proof, independent of the wiring-pins-itself test
    // above (that test would pass even with a bug shared between venues.ts
    // and its own re-implementation here). Walks every overlay-covered id and
    // asserts the NULL-guard per field: a published value wins, an unset one
    // is filled from benefit-flags.ts. Written to hold in either snapshot
    // state: before 0014 was published every field was unset, and after the
    // 2026-09-25 publish nearly all are set. Pinning one state broke that
    // publish's data-only PR.
    for (const [id, flags] of Object.entries(benefitFlags)) {
      const publishedRow = publishedVenues.find((v) => v.id === id);
      if (!publishedRow) continue;
      const resolved = venues.find((v) => v.id === id)!;
      expect(resolved.accepts_snap).toBe(publishedRow.accepts_snap ?? flags.snap);
      expect(resolved.accepts_wic).toBe(publishedRow.accepts_wic ?? flags.wic);
    }
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
