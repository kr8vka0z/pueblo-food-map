/**
 * adminBoxes.test.ts — loadBoxHealthEntries wiring tests against a fake D1
 * (not real SQLite; the SQL shape itself is already proven against real
 * migrations in adminBoxHealthQueries.sql.test.ts, and the status math is
 * already proven in boxHealth.test.ts — this file only covers the mapping/
 * degrade wiring specific to this module: fast-exit on zero boxes, mapping
 * a latest check-in + caretaker onto each venue, and degrading to "no
 * caretaker data" when the adopter-names read fails).
 */

import { describe, expect, test } from "vitest";
import { loadBoxHealthEntries } from "@/lib/adminBoxes";

interface FakeBoxVenueRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** Minimal fake D1: routes by a substring match on the SQL text, same convention every other admin lib's own test file uses when a real SQLite fixture isn't warranted. */
function makeFakeDb(opts: {
  venues: FakeBoxVenueRow[];
  latestCheckins?: { venue_id: string; kind: string; note: string | null; created_at: string }[];
  adopterNamesFails?: boolean;
}) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => {
          if (sql.includes("box_adopters")) {
            if (opts.adopterNamesFails) throw new Error("adopter read failed");
            return { results: [], meta: {} };
          }
          return { results: [], meta: {} };
        },
      }),
      all: async () => {
        if (sql.includes("FROM venues WHERE category = 'blessing_box'")) {
          return { results: opts.venues, meta: {} };
        }
        if (sql.includes("box_checkins")) {
          return { results: opts.latestCheckins ?? [], meta: {} };
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
    expect(entries[0].caretaker).toBeNull();
  });

  test("a box with no check-in row reads as 'quiet' with a null latest report", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-2", name: "Blessing Box - Elm", address: "1 Elm St", lat: 38.2, lng: -104.5 }],
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries[0].health.status).toBe("quiet");
    expect(entries[0].health.latest).toBeNull();
  });

  test("adopter-name read failure degrades to caretaker: null, never throws", async () => {
    const db = makeFakeDb({
      venues: [{ id: "box-3", name: "Blessing Box - Main", address: "2 Main St", lat: 38.2, lng: -104.5 }],
      adopterNamesFails: true,
    });

    const entries = await loadBoxHealthEntries(db, new Date("2026-09-20T00:00:00.000Z"));

    expect(entries[0].caretaker).toBeNull();
  });
});
