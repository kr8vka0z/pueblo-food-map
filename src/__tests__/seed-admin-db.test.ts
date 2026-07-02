/**
 * Tests for scripts/seed-admin-db.ts (#237 checkpoint b).
 *
 * Covers the pure validation/SQL-generation logic the seed script's
 * correctness rests on: SQL text escaping, the tri-state accepts_snap/wic
 * mapping, the PUEBLO_COUNTY_BBOX check, and the duplicate-id + name/coords
 * "possible rename" similarity heuristics (spec §7 step 3). Does not touch
 * D1/wrangler — see the script's own file header for why that's a separate,
 * manually-run step.
 *
 * The final describe block runs the checks against the REAL 108-record
 * dataset — this is the actual acceptance criterion ("Known pair this MUST
 * catch... If your check does NOT surface that pair, the heuristic is
 * wrong — fix it until it does."), not just a synthetic fixture.
 */

import { describe, test, expect } from "vitest";
import {
  sqlText,
  sqlTriState,
  isInsideBbox,
  buildInsertSql,
  buildSourceRecords,
  findDuplicateIds,
  findSimilarPairs,
  type SourceRecord,
} from "../../scripts/seed-admin-db";
import type { Venue } from "@/types/venue";
import { pfpVenues } from "@/data/venues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-id",
    name: "Test Venue",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

// ─── sqlText ────────────────────────────────────────────────────────────────

describe("sqlText", () => {
  test("undefined -> bare NULL", () => {
    expect(sqlText(undefined)).toBe("NULL");
  });

  test("null -> bare NULL", () => {
    expect(sqlText(null)).toBe("NULL");
  });

  test("plain string -> single-quoted", () => {
    expect(sqlText("hello")).toBe("'hello'");
  });

  test("embedded apostrophe is doubled (SQL-escaped)", () => {
    expect(sqlText("J R's Country Store")).toBe("'J R''s Country Store'");
  });

  test("multiple apostrophes all doubled", () => {
    expect(sqlText("Loaf 'N Jug 'n stuff")).toBe("'Loaf ''N Jug ''n stuff'");
  });
});

// ─── sqlTriState ────────────────────────────────────────────────────────────

describe("sqlTriState", () => {
  test("undefined -> NULL (unknown)", () => {
    expect(sqlTriState(undefined)).toBe("NULL");
  });
  test("false -> 0", () => {
    expect(sqlTriState(false)).toBe("0");
  });
  test("true -> 1", () => {
    expect(sqlTriState(true)).toBe("1");
  });
});

// ─── isInsideBbox ───────────────────────────────────────────────────────────

describe("isInsideBbox", () => {
  const bbox: [[number, number], [number, number]] = [
    [-105, 37],
    [-104, 38],
  ];

  test("point inside bounds", () => {
    expect(isInsideBbox(37.5, -104.5, bbox)).toBe(true);
  });

  test("point outside to the west", () => {
    expect(isInsideBbox(37.5, -105.5, bbox)).toBe(false);
  });

  test("point outside to the east", () => {
    expect(isInsideBbox(37.5, -103.5, bbox)).toBe(false);
  });

  test("point outside to the south", () => {
    expect(isInsideBbox(36.5, -104.5, bbox)).toBe(false);
  });

  test("point outside to the north", () => {
    expect(isInsideBbox(38.5, -104.5, bbox)).toBe(false);
  });

  test("boundary is inclusive", () => {
    expect(isInsideBbox(37, -105, bbox)).toBe(true);
    expect(isInsideBbox(38, -104, bbox)).toBe(true);
  });

  test("defaults to PUEBLO_COUNTY_BBOX when no bbox passed", () => {
    expect(isInsideBbox(38.2544, -104.6091)).toBe(true); // downtown Pueblo
  });
});

// ─── buildInsertSql ─────────────────────────────────────────────────────────

describe("buildInsertSql", () => {
  const seedTimestamp = "2026-07-01T00:00:00.000Z";

  test("required-only record: exact column order + NULLs for absent fields", () => {
    const sql = buildInsertSql({ venue: makeVenue(), sourceType: "pfp" }, seedTimestamp);
    expect(sql).toBe(
      "INSERT INTO venues (id, name, category, lat, lng, address, hours_weekly, accepts_snap, accepts_wic, phone, email, url, notes, operator, source, last_verified, status, source_type, outside_county, created_by, updated_by, published_at, published_by) VALUES " +
        "('test-id', 'Test Venue', 'pantry', 38.25, -104.6, '123 Test St', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'test', '2026-01-01', 'published', 'pfp', 0, 'seed@pueblofoodmap.com', 'seed@pueblofoodmap.com', '2026-07-01T00:00:00.000Z', 'seed@pueblofoodmap.com');",
    );
  });

  test("explicit accepts_snap/accepts_wic seed as 1/0, not NULL", () => {
    const sql = buildInsertSql(
      { venue: makeVenue({ accepts_snap: true, accepts_wic: false }), sourceType: "osm" },
      seedTimestamp,
    );
    expect(sql).toContain(", 1, 0,"); // accepts_snap=1, accepts_wic=0
  });

  test("hours_weekly is JSON-encoded", () => {
    const sql = buildInsertSql(
      { venue: makeVenue({ hours_weekly: { wed: ["16:00-19:00"] } }), sourceType: "pfp" },
      seedTimestamp,
    );
    expect(sql).toContain(`'${JSON.stringify({ wed: ["16:00-19:00"] })}'`);
  });

  test("apostrophe in name/notes survives as valid, balanced-quote SQL", () => {
    const sql = buildInsertSql(
      {
        venue: makeVenue({ name: "Loaf 'N Jug", notes: "Operated by Loaf 'N Jug" }),
        sourceType: "osm",
      },
      seedTimestamp,
    );
    expect(sql).toContain("'Loaf ''N Jug'");
    expect(sql).toContain("'Operated by Loaf ''N Jug'");
    // An unescaped apostrophe would desync quoting and leave an odd count.
    const quoteCount = (sql.match(/'/g) || []).length;
    expect(quoteCount % 2).toBe(0);
  });

  test("outside_county is 1 when the record fails PUEBLO_COUNTY_BBOX", () => {
    const sql = buildInsertSql(
      { venue: makeVenue({ lat: 0, lng: 0 }), sourceType: "pfp" }, // null island, far outside CO
      seedTimestamp,
    );
    expect(sql).toContain("'pfp', 1,");
  });
});

// ─── findDuplicateIds ───────────────────────────────────────────────────────

describe("findDuplicateIds", () => {
  test("no duplicates -> empty array", () => {
    const records: SourceRecord[] = [
      { venue: makeVenue({ id: "a" }), sourceType: "pfp" },
      { venue: makeVenue({ id: "b" }), sourceType: "osm" },
    ];
    expect(findDuplicateIds(records)).toEqual([]);
  });

  test("flags an id appearing in two different source namespaces", () => {
    const records: SourceRecord[] = [
      { venue: makeVenue({ id: "shared-id" }), sourceType: "pfp" },
      { venue: makeVenue({ id: "shared-id" }), sourceType: "osm" },
      { venue: makeVenue({ id: "unique" }), sourceType: "plentiful" },
    ];
    expect(findDuplicateIds(records)).toEqual([{ id: "shared-id", sources: ["pfp", "osm"] }]);
  });
});

// ─── findSimilarPairs ───────────────────────────────────────────────────────

describe("findSimilarPairs", () => {
  test("no candidates among clearly distinct venues", () => {
    const records: SourceRecord[] = [
      {
        venue: makeVenue({ id: "a", name: "Alpha Pantry", lat: 38.1, lng: -104.1, phone: "111" }),
        sourceType: "pfp",
      },
      {
        venue: makeVenue({ id: "b", name: "Beta Grocery", lat: 38.5, lng: -104.9, phone: "222" }),
        sourceType: "osm",
      },
    ];
    expect(findSimilarPairs(records)).toEqual([]);
  });

  test("flags same name + coordinates within 0.001 degrees (case/whitespace-insensitive)", () => {
    const records: SourceRecord[] = [
      { venue: makeVenue({ id: "a", name: "Corner Store", lat: 38.25, lng: -104.6 }), sourceType: "osm" },
      {
        venue: makeVenue({ id: "b", name: "  corner store  ", lat: 38.2505, lng: -104.6005 }),
        sourceType: "osm",
      },
    ];
    const pairs = findSimilarPairs(records);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].reason).toContain("same name + coordinates");
  });

  test("flags identical non-empty phone even with different names/locations", () => {
    const records: SourceRecord[] = [
      {
        venue: makeVenue({ id: "a", name: "North Branch", lat: 38.1, lng: -104.1, phone: "(719) 555-0100" }),
        sourceType: "plentiful",
      },
      {
        venue: makeVenue({ id: "b", name: "South Branch", lat: 38.9, lng: -104.9, phone: "(719) 555-0100" }),
        sourceType: "plentiful",
      },
    ];
    const pairs = findSimilarPairs(records);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].reason).toContain("same phone");
  });

  test("does not flag two distinct venues sharing only a name (different coords, no phone match)", () => {
    const records: SourceRecord[] = [
      { venue: makeVenue({ id: "a", name: "7-Eleven", lat: 38.1, lng: -104.1 }), sourceType: "osm" },
      { venue: makeVenue({ id: "b", name: "7-Eleven", lat: 38.9, lng: -104.9 }), sourceType: "osm" },
    ];
    expect(findSimilarPairs(records)).toEqual([]);
  });
});

// ─── Real 108-record seed set (acceptance criteria, spec §7 step 3) ────────

describe("real 108-record seed set (acceptance criteria)", () => {
  const records = buildSourceRecords();

  test("totals 108 records: 10 pfp + 60 osm + 38 plentiful", () => {
    expect(pfpVenues).toHaveLength(10);
    expect(groceryOsmVenues).toHaveLength(60);
    expect(plentifulPantries).toHaveLength(38);
    expect(records).toHaveLength(108);
  });

  test("no duplicate ids across the combined pfp+osm+plentiful namespace", () => {
    expect(findDuplicateIds(records)).toEqual([]);
  });

  test("surfaces the known Plentiful soup-kitchen duplicate pair", () => {
    const pairs = findSimilarPairs(records);
    const flaggedIds = new Set(pairs.flatMap((p) => [p.aId, p.bId]));
    expect(flaggedIds.has("plentiful-pueblo-community-soup-kitchen-1bc98af5")).toBe(true);
    expect(flaggedIds.has("plentiful-pueblo-community-soup-kitchen-plentiful-3195")).toBe(true);
  });

  test("every record is inside PUEBLO_COUNTY_BBOX", () => {
    const outside = records.filter((r) => !isInsideBbox(r.venue.lat, r.venue.lng));
    expect(outside).toEqual([]);
  });
});
