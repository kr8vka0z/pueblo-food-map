/**
 * adminBoxes.test.ts — loadBoxHealthEntries wiring tests against a fake D1
 * (not real SQLite; the SQL shape itself is already proven against real
 * migrations in adminBoxHealthQueries.sql.test.ts, and the status math is
 * already proven in boxHealth.test.ts — this file only covers the mapping/
 * degrade wiring specific to this module: fast-exit on zero boxes, mapping
 * a latest check-in + sponsor names onto each venue, and degrading to "no
 * sponsor data" when the adopter-names read fails).
 */

import { describe, expect, test } from "vitest";
import { loadBoxHealthEntries, groupBoxReviewItems } from "@/lib/adminBoxes";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

interface FakeBoxVenueRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  removed_on?: string | null;
}

/** Minimal fake D1: routes by a substring match on the SQL text, same convention every other admin lib's own test file uses when a real SQLite fixture isn't warranted. */
function makeFakeDb(opts: {
  venues: FakeBoxVenueRow[];
  latestCheckins?: { venue_id: string; kind: string; note: string | null; created_at: string }[];
  adopterNamesFails?: boolean;
  adopterNameRows?: { venue_id: string; display_name: string }[];
}) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => {
          if (sql.includes("box_adopters")) {
            if (opts.adopterNamesFails) throw new Error("adopter read failed");
            return { results: opts.adopterNameRows ?? [], meta: {} };
          }
          return { results: [], meta: {} };
        },
      }),
      all: async () => {
        // Check box_checkins FIRST — SELECT_LATEST_CHECKIN_PER_BOX_SQL's own
        // WHERE clause also contains "v.category = 'blessing_box'", so the
        // venues check below would otherwise shadow it.
        if (sql.includes("box_checkins")) {
          return { results: opts.latestCheckins ?? [], meta: {} };
        }
        if (sql.includes("LEFT JOIN blessing_boxes")) {
          return { results: opts.venues.map((v) => ({ removed_on: null, ...v })), meta: {} };
        }
        return { results: [], meta: {} };
      },
    }),
  } as unknown as D1Database;
}

describe("loadBoxHealthEntries", () => {
  test("zero boxes -> empty array, no further reads attempted", async () => {
    const db = makeFakeDb({ venues: [] });
    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));
    expect(entries).toEqual([]);
  });

  test("maps each venue's latest check-in into a BoxHealth via the shared computeBoxHealth", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-1", name: "Blessing Box - Routt", address: "216 W Routt", lat: 38.27, lng: -104.6 }],
      latestCheckins: [{ venue_id: "box-1", kind: "empty", note: "bare", created_at: "2026-09-19T00:00:00.000Z" }],
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries).toHaveLength(1);
    expect(entries[0].venueId).toBe("box-1");
    expect(entries[0].health.status).toBe("empty");
    expect(entries[0].health.latest?.note).toBe("bare");
    expect(entries[0].sponsors).toEqual([]);
  });

  test("a box with no check-in row reads as 'quiet' with a null latest report", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-2", name: "Blessing Box - Elm", address: "1 Elm St", lat: 38.2, lng: -104.5 }],
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries[0].health.status).toBe("quiet");
    expect(entries[0].health.latest).toBeNull();
  });

  test("adopter-name read failure degrades to sponsors: [], never throws", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-3", name: "Blessing Box - Main", address: "2 Main St", lat: 38.2, lng: -104.5 }],
      adopterNamesFails: true,
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries[0].sponsors).toEqual([]);
  });

  // #671: the Sponsor column needs the FULL adopter list, not just the
  // first name, to render the public card's "A, B, +N more" format.
  test("passes every approved adopter name through, not just the first", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-5", name: "Blessing Box - Sunny", address: "5 Sunny St", lat: 38.2, lng: -104.5 }],
      adopterNameRows: [
        { venue_id: "box-5", display_name: "Jamie R." },
        { venue_id: "box-5", display_name: "Sam T." },
      ],
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries[0].sponsors).toEqual(["Jamie R.", "Sam T."]);
  });

  test("passes blessing_boxes.removed_on straight through as removedOn", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-4", name: "Blessing Box - Gone", address: "4 Test St", lat: 38.2, lng: -104.5, removed_on: "2026-08-01" }],
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries[0].removedOn).toBe("2026-08-01");
  });
});

function photoRow(overrides: Partial<AdminBoxPhotoRow> = {}): AdminBoxPhotoRow {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "Box 1",
    checkin_id: null,
    checkin_kind: null,
    status: "pending",
    flag_count: 0,
    created_at: "2026-09-18T15:00:00.000Z",
    ...overrides,
  };
}

function adopterRow(overrides: Partial<AdminBoxAdopterRow> = {}): AdminBoxAdopterRow {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "Box 1",
    display_name: "The Martinez Family",
    email: "martinez@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-18T15:00:00.000Z",
    created_at: "2026-09-18T14:00:00.000Z",
    ...overrides,
  };
}

describe("groupBoxReviewItems", () => {
  test("empty inputs -> empty map", () => {
    expect(groupBoxReviewItems([], [])).toEqual({});
  });

  test("groups a pending photo and a sponsor request under their own venue ids", () => {
    const result = groupBoxReviewItems(
      [photoRow({ id: 5, venue_id: "box-1", status: "pending" })],
      [adopterRow({ id: 9, venue_id: "box-2", display_name: "The Lee Family" })],
    );
    expect(result["box-1"]).toEqual({ photo: { id: 5, status: "pending", flagCount: 0 } });
    expect(result["box-2"]).toEqual({ sponsorRequest: { displayName: "The Lee Family" } });
  });

  test("a venue with both a photo and a sponsor request gets both under one entry", () => {
    const result = groupBoxReviewItems(
      [photoRow({ id: 5, venue_id: "box-1" })],
      [adopterRow({ id: 9, venue_id: "box-1", display_name: "The Lee Family" })],
    );
    expect(result["box-1"]).toEqual({
      photo: { id: 5, status: "pending", flagCount: 0 },
      sponsorRequest: { displayName: "The Lee Family" },
    });
  });

  test("a flagged photo wins over a pending one for the same venue, regardless of array order", () => {
    const result = groupBoxReviewItems(
      [
        photoRow({ id: 1, venue_id: "box-1", status: "pending" }),
        photoRow({ id: 2, venue_id: "box-1", status: "flagged", flag_count: 3 }),
      ],
      [],
    );
    expect(result["box-1"]).toEqual({ photo: { id: 2, status: "flagged", flagCount: 3 } });
  });

  test("a venue with no review items has no entry in the map", () => {
    const result = groupBoxReviewItems([photoRow({ venue_id: "box-1" })], []);
    expect(result["box-2"]).toBeUndefined();
  });
});
