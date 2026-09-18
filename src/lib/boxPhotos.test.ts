/**
 * Tests for src/lib/boxPhotos.ts (Blessing Boxes slice 5) — the D1
 * shapes/SQL/helpers layer, proved against fake D1Database objects, same
 * convention blessingBoxes.test.ts's own D1-reads section uses.
 */

import { describe, expect, test } from "vitest";
import {
  countPendingReview,
  insertPendingPhoto,
  loadApprovedBoxPhotoById,
  loadApprovedPhotosForVenue,
  loadBoxPhotoById,
  loadLatestApprovedPhotosForVenues,
  loadReviewQueue,
} from "@/lib/boxPhotos";

describe("loadLatestApprovedPhotosForVenues", () => {
  test("empty id list short-circuits to an empty map without querying", async () => {
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    const map = await loadLatestApprovedPhotosForVenues(db, []);
    expect(map.size).toBe(0);
  });

  test("maps each row's venue_id to its {id, createdAt}", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: [
              { id: 1, venue_id: "a", created_at: "2026-09-18T10:00:00.000Z" },
              { id: 2, venue_id: "b", created_at: "2026-09-18T11:00:00.000Z" },
            ],
          }),
        }),
      }),
    } as unknown as D1Database;
    const map = await loadLatestApprovedPhotosForVenues(db, ["a", "b"]);
    expect(map.get("a")).toEqual({ id: 1, createdAt: "2026-09-18T10:00:00.000Z" });
    expect(map.get("b")).toEqual({ id: 2, createdAt: "2026-09-18T11:00:00.000Z" });
  });
});

describe("loadApprovedPhotosForVenue", () => {
  test("returns [] with no rows, not a throw, and passes the limit through", async () => {
    let boundArgs: unknown[] = [];
    const db = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    } as unknown as D1Database;
    expect(await loadApprovedPhotosForVenue(db, "a", 24)).toEqual([]);
    expect(boundArgs).toEqual(["a", 24]);
  });
});

describe("loadBoxPhotoById / loadApprovedBoxPhotoById", () => {
  test("loadBoxPhotoById returns any status row", async () => {
    const row = { id: 1, status: "pending" };
    const db = { prepare: () => ({ bind: () => ({ first: async () => row }) }) } as unknown as D1Database;
    expect(await loadBoxPhotoById(db, 1)).toEqual(row);
  });

  test("loadApprovedBoxPhotoById is a separate, status-scoped query, not a filter applied after the fact", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ first: async () => null }) };
      },
    } as unknown as D1Database;
    await loadApprovedBoxPhotoById(db, 1);
    expect(seenSql).toContain("status = 'approved'");
  });
});

describe("loadReviewQueue / countPendingReview", () => {
  test("loadReviewQueue returns [] with no rows", async () => {
    const db = { prepare: () => ({ all: async () => ({ results: [] }) }) } as unknown as D1Database;
    expect(await loadReviewQueue(db)).toEqual([]);
  });

  test("countPendingReview returns 0 when the count row is missing", async () => {
    const db = { prepare: () => ({ first: async () => null }) } as unknown as D1Database;
    expect(await countPendingReview(db)).toBe(0);
  });

  test("countPendingReview returns the row's count", async () => {
    const db = { prepare: () => ({ first: async () => ({ n: 3 }) }) } as unknown as D1Database;
    expect(await countPendingReview(db)).toBe(3);
  });
});

describe("insertPendingPhoto", () => {
  test("returns the new row's id from meta.last_row_id", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({ run: async () => ({ meta: { last_row_id: 55 } }) }),
      }),
    } as unknown as D1Database;
    const id = await insertPendingPhoto(db, {
      venueId: "a",
      checkinId: null,
      r2Key: "box-photos/a/x.jpg",
      width: 200,
      height: 100,
      bytes: 12345,
    });
    expect(id).toBe(55);
  });

  test("throws if D1 doesn't return a last_row_id — never silently returns an undefined id", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ run: async () => ({ meta: {} }) }) }),
    } as unknown as D1Database;
    await expect(
      insertPendingPhoto(db, { venueId: "a", checkinId: null, r2Key: "x", width: 1, height: 1, bytes: 1 }),
    ).rejects.toThrow("last_row_id");
  });
});
