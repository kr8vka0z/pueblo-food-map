/**
 * Tests for src/lib/boxAdopters.ts (Blessing Boxes slice 6) — the D1
 * shapes/SQL/helpers layer, proved against fake D1Database objects, same
 * convention boxPhotos.test.ts uses.
 */

import { describe, expect, test } from "vitest";
import {
  countPendingAdopters,
  insertAdopterApplication,
  isAdopterConfirmTokenValid,
  loadAdopterByConfirmToken,
  loadAdopterById,
  loadApprovedAdopterNamesForVenues,
  loadApprovedAdopters,
  loadPendingAdopters,
} from "@/lib/boxAdopters";

describe("loadPendingAdopters / loadApprovedAdopters", () => {
  test("loadPendingAdopters returns [] with no rows", async () => {
    const db = { prepare: () => ({ all: async () => ({ results: [] }) }) } as unknown as D1Database;
    expect(await loadPendingAdopters(db)).toEqual([]);
  });

  test("loadPendingAdopters queries status = 'pending', joined to the venue name", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadPendingAdopters(db);
    expect(seenSql).toContain("status = 'pending'");
    expect(seenSql).toContain("venue_name");
  });

  test("loadApprovedAdopters queries status = 'approved'", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadApprovedAdopters(db);
    expect(seenSql).toContain("status = 'approved'");
  });
});

describe("countPendingAdopters", () => {
  test("returns 0 when the count row is missing", async () => {
    const db = { prepare: () => ({ first: async () => null }) } as unknown as D1Database;
    expect(await countPendingAdopters(db)).toBe(0);
  });

  test("returns the row's count", async () => {
    const db = { prepare: () => ({ first: async () => ({ n: 2 }) }) } as unknown as D1Database;
    expect(await countPendingAdopters(db)).toBe(2);
  });
});

describe("loadAdopterById / loadAdopterByConfirmToken", () => {
  test("loadAdopterById returns the row by id", async () => {
    const row = { id: 1, status: "pending" };
    const db = { prepare: () => ({ bind: () => ({ first: async () => row }) }) } as unknown as D1Database;
    expect(await loadAdopterById(db, 1)).toEqual(row);
  });

  test("loadAdopterByConfirmToken queries by confirm_token, not id", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ first: async () => null }) };
      },
    } as unknown as D1Database;
    await loadAdopterByConfirmToken(db, "abc");
    expect(seenSql).toContain("confirm_token = ?");
  });
});

describe("loadApprovedAdopterNamesForVenues", () => {
  test("empty id list short-circuits to an empty map without querying", async () => {
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    const map = await loadApprovedAdopterNamesForVenues(db, []);
    expect(map.size).toBe(0);
  });

  test("groups display names per venue, preserving row order (oldest first per the query's own ORDER BY)", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: [
              { venue_id: "a", display_name: "The Nguyen Family" },
              { venue_id: "a", display_name: "Mesa Church" },
              { venue_id: "b", display_name: "Jane Doe" },
            ],
          }),
        }),
      }),
    } as unknown as D1Database;
    const map = await loadApprovedAdopterNamesForVenues(db, ["a", "b"]);
    expect(map.get("a")).toEqual(["The Nguyen Family", "Mesa Church"]);
    expect(map.get("b")).toEqual(["Jane Doe"]);
  });

  test("orders by created_at ASC (oldest first) — a public 'Cared for by' roster, not a most-recent callout", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    await loadApprovedAdopterNamesForVenues(db, ["a"]);
    expect(seenSql).toContain("ORDER BY created_at ASC");
  });
});

describe("insertAdopterApplication", () => {
  test("returns the new row's id and a confirm token, both bound into the INSERT", async () => {
    let boundArgs: unknown[] = [];
    const db = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { run: async () => ({ meta: { last_row_id: 7 } }) };
        },
      }),
    } as unknown as D1Database;
    const result = await insertAdopterApplication(db, {
      venueId: "box-1",
      displayName: "Jane Doe",
      email: "jane@example.com",
      note: "We stock it every Sunday",
    });
    expect(result.id).toBe(7);
    expect(typeof result.confirmToken).toBe("string");
    expect(result.confirmToken).toHaveLength(64); // 32 bytes hex-encoded
    expect(boundArgs).toEqual(["box-1", "Jane Doe", "jane@example.com", "We stock it every Sunday", result.confirmToken]);
  });

  test("throws if D1 doesn't return a last_row_id — never silently returns an undefined id", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ run: async () => ({ meta: {} }) }) }),
    } as unknown as D1Database;
    await expect(
      insertAdopterApplication(db, { venueId: "a", displayName: "x", email: "x@example.com", note: null }),
    ).rejects.toThrow("last_row_id");
  });
});

describe("isAdopterConfirmTokenValid", () => {
  test("true when created just now", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    expect(isAdopterConfirmTokenValid({ created_at: now.toISOString() }, now)).toBe(true);
  });

  test("true at exactly 7 days old", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const created = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(isAdopterConfirmTokenValid({ created_at: created.toISOString() }, now)).toBe(true);
  });

  test("false once older than 7 days", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const created = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1000);
    expect(isAdopterConfirmTokenValid({ created_at: created.toISOString() }, now)).toBe(false);
  });
});
