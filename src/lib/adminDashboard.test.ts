/**
 * adminDashboard.test.ts — pure-function coverage for src/lib/adminDashboard.ts.
 */

import { describe, expect, test } from "vitest";
import { selectStalePlaces, bucketCheckinsByWeek } from "@/lib/adminDashboard";
import type { AdminVenueRow } from "@/types/venue";

const NOW = new Date("2026-09-21T12:00:00.000Z");

function venueRow(overrides: Partial<AdminVenueRow> = {}): Pick<AdminVenueRow, "id" | "name" | "category" | "status" | "last_verified"> {
  return {
    id: "v1",
    name: "Test Pantry",
    category: "pantry",
    status: "published",
    last_verified: "2025-01-01",
    ...overrides,
  };
}

describe("selectStalePlaces", () => {
  test("excludes anything under the month threshold", () => {
    const fresh = venueRow({ id: "fresh", last_verified: "2026-09-01" }); // ~3 weeks old
    const { items } = selectStalePlaces([fresh], NOW, { months: 12 });
    expect(items).toHaveLength(0);
  });

  test("includes rows at/over the month threshold, oldest first", () => {
    const old1 = venueRow({ id: "old1", name: "Old One", last_verified: "2025-01-01" });
    const old2 = venueRow({ id: "old2", name: "Old Two", last_verified: "2024-06-01" });
    const { items, totalCount } = selectStalePlaces([old1, old2], NOW, { months: 12 });
    expect(totalCount).toBe(2);
    expect(items.map((i) => i.id)).toEqual(["old2", "old1"]); // oldest last_verified first
    expect(items[0].monthsSince).toBeGreaterThanOrEqual(12);
  });

  test("excludes draft/archived rows and blessing boxes even when stale", () => {
    const draft = venueRow({ id: "draft", status: "draft", last_verified: "2020-01-01" });
    const archived = venueRow({ id: "archived", status: "archived", last_verified: "2020-01-01" });
    const box = venueRow({ id: "box", category: "blessing_box", last_verified: "2020-01-01" });
    const { items } = selectStalePlaces([draft, archived, box], NOW, { months: 12 });
    expect(items).toHaveLength(0);
  });

  test("totalCount reflects every stale row even when items is capped by limit", () => {
    const rows = Array.from({ length: 5 }, (_, i) => venueRow({ id: `v${i}`, last_verified: "2024-01-01" }));
    const { items, totalCount } = selectStalePlaces(rows, NOW, { months: 12, limit: 2 });
    expect(items).toHaveLength(2);
    expect(totalCount).toBe(5);
  });
});

describe("bucketCheckinsByWeek", () => {
  test("returns `weeks` buckets, oldest first, all zero when there are no check-ins", () => {
    const buckets = bucketCheckinsByWeek([], NOW, 8);
    expect(buckets).toHaveLength(8);
    expect(buckets.every((b) => b.ok === 0 && b.trouble === 0)).toBe(true);
    // Oldest bucket's start is before the newest bucket's start.
    expect(Date.parse(buckets[0].weekStart)).toBeLessThan(Date.parse(buckets[7].weekStart));
  });

  test("splits filled/took into ok and low/empty/problem into trouble", () => {
    const checkins = [
      { kind: "filled" as const, createdAt: "2026-09-20T00:00:00.000Z" },
      { kind: "took" as const, createdAt: "2026-09-20T01:00:00.000Z" },
      { kind: "low" as const, createdAt: "2026-09-20T02:00:00.000Z" },
      { kind: "empty" as const, createdAt: "2026-09-20T03:00:00.000Z" },
      { kind: "problem" as const, createdAt: "2026-09-20T04:00:00.000Z" },
    ];
    const buckets = bucketCheckinsByWeek(checkins, NOW, 8);
    const lastBucket = buckets[buckets.length - 1];
    expect(lastBucket.ok).toBe(2);
    expect(lastBucket.trouble).toBe(3);
  });

  test("a check-in older than the whole window is dropped, not crashed on", () => {
    const checkins = [{ kind: "filled" as const, createdAt: "2020-01-01T00:00:00.000Z" }];
    const buckets = bucketCheckinsByWeek(checkins, NOW, 8);
    expect(buckets.reduce((sum, b) => sum + b.ok + b.trouble, 0)).toBe(0);
  });

  test("a malformed timestamp is dropped, not thrown", () => {
    const checkins = [{ kind: "filled" as const, createdAt: "not-a-date" }];
    expect(() => bucketCheckinsByWeek(checkins, NOW, 8)).not.toThrow();
  });
});
