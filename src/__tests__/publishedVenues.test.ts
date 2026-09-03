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
  // through auto-merge. This test is that proof: it reads the file's raw
  // source (not the imported module — importing already executes whatever
  // code is there), isolates the text after the declaration's `= ` exactly
  // as serializePublishedVenuesFile() (src/lib/publishVenues.ts) emits it,
  // and JSON.parses that slice. JSON.parse accepts only data — no function
  // calls, no identifiers, no side effects — so a pass here is a structural
  // guarantee the file is a JSON literal, not just a filename match.
  test("published-venues.ts's exported literal is provably a JSON data literal, not executable code", () => {
    const raw = readFileSync(join(process.cwd(), "src", "data", "published-venues.ts"), "utf-8");
    const marker = "export const publishedVenues: Venue[] = ";
    const markerIndex = raw.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);

    const afterDeclaration = raw.slice(markerIndex + marker.length).trimEnd();
    expect(afterDeclaration.endsWith(";")).toBe(true);
    const literalText = afterDeclaration.slice(0, -1);

    const parsed: unknown = JSON.parse(literalText);
    expect(parsed).toEqual(publishedVenues);
  });

  // Board review finding #2: serializePublishedVenuesFile() now ALSO emits a
  // `publishedAt` const (src/lib/publishVenues.ts) so the map-wide freshness
  // line has something to read at runtime — a header comment isn't readable
  // by component code. This extends the proof above to that new export: the
  // same JSON.parse-only technique confirms it's inert string data (not, say,
  // a `new Date()` call that would tick every build), which the data_only CI
  // carve-out (ci.yml #336) depends on for every future publish, not just
  // `publishedVenues`.
  test("published-venues.ts's exported publishedAt is provably a JSON string literal, not executable code", () => {
    const raw = readFileSync(join(process.cwd(), "src", "data", "published-venues.ts"), "utf-8");
    const marker = "export const publishedAt = ";
    const markerIndex = raw.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    // publishedAt must appear before publishedVenues — the existing marker
    // slice above assumes nothing follows the venues array declaration.
    expect(markerIndex).toBeLessThan(raw.indexOf("export const publishedVenues: Venue[] = "));

    const afterDeclaration = raw.slice(markerIndex + marker.length);
    const lineEnd = afterDeclaration.indexOf("\n");
    const statement = afterDeclaration.slice(0, lineEnd).trimEnd();
    expect(statement.endsWith(";")).toBe(true);
    const literalText = statement.slice(0, -1);

    const parsed: unknown = JSON.parse(literalText);
    expect(typeof parsed).toBe("string");
    expect(parsed).toBe(publishedAt);
    // A real ISO timestamp, not just any string — proves it round-trips
    // through Date parsing the way formatPublishedDate() (dataFreshness.ts)
    // consumes it.
    expect(Number.isNaN(new Date(parsed as string).getTime())).toBe(false);
  });

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
