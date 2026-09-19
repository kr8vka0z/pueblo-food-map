/**
 * Pure-function tests for src/lib/boxActivity.ts (Blessing Boxes slice 3).
 * buildActivityQuery is tested directly against its generated SQL/params
 * (no D1 needed) — loadBoxActivity's thin D1-calling wrapper is proved via
 * the public route's own tests (route.test.ts), which stub the db.
 */

import { describe, expect, test, vi } from "vitest";
import {
  ACTIVITY_PAGE_SIZE_DEFAULT,
  buildActivityQuery,
  clampPage,
  clampPageSize,
  loadBoxActivity,
} from "@/lib/boxActivity";

describe("clampPage", () => {
  test("undefined/0/negative/NaN all clamp to 1", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(NaN)).toBe(1);
  });
  test("a fractional page floors", () => {
    expect(clampPage(2.9)).toBe(2);
  });
  test("an absurdly large page clamps to the max (200)", () => {
    expect(clampPage(999999)).toBe(200);
  });
  test("a normal page passes through", () => {
    expect(clampPage(3)).toBe(3);
  });
});

describe("clampPageSize", () => {
  test("undefined/0/negative/NaN all clamp to the default (25)", () => {
    expect(clampPageSize(undefined)).toBe(ACTIVITY_PAGE_SIZE_DEFAULT);
    expect(clampPageSize(0)).toBe(ACTIVITY_PAGE_SIZE_DEFAULT);
    expect(clampPageSize(-1)).toBe(ACTIVITY_PAGE_SIZE_DEFAULT);
    expect(clampPageSize(NaN)).toBe(ACTIVITY_PAGE_SIZE_DEFAULT);
  });
  test("an oversized request clamps to the max (100)", () => {
    expect(clampPageSize(1000)).toBe(100);
  });
  test("a small request (e.g. D3's per-box embed) passes through", () => {
    expect(clampPageSize(5)).toBe(5);
  });
});

describe("buildActivityQuery", () => {
  test("no filters -> both halves present, no venue/kind/date clauses, default page size + offset 0", () => {
    const { sql, params } = buildActivityQuery({});
    expect(sql).toContain("FROM box_checkins t");
    expect(sql).toContain("FROM box_events t");
    expect(sql).toContain("v.category = 'blessing_box'");
    expect(sql).toContain("v.status != 'archived'");
    expect(sql).toContain("t.visibility = 'visible'");
    expect(sql).toContain("t.kind != 'problem'");
    expect(sql).toContain("ORDER BY created_at DESC, source DESC, row_id DESC");
    expect(params).toEqual([26, 0]); // LIMIT (pageSize+1), OFFSET
  });

  test("venueId filter binds the same value into both halves' WHERE clauses", () => {
    const { sql, params } = buildActivityQuery({ venueId: "box-1" });
    expect(sql).toContain("t.venue_id = ?");
    // Both halves get their own bound param — appears twice.
    expect(params.filter((p) => p === "box-1")).toHaveLength(2);
  });

  test("a checkin-side kind ('filled') filters the checkin half and excludes the event half (1=0)", () => {
    const { sql, params } = buildActivityQuery({ kind: "filled" });
    expect(sql).toContain("t.kind = ?");
    expect(sql).toContain("1 = 0");
    expect(params).toContain("filled");
  });

  test("an event-side kind ('moved') filters the event half and excludes the checkin half (1=0)", () => {
    const { sql, params } = buildActivityQuery({ kind: "moved" });
    expect(sql).toContain("t.kind = ?");
    expect(sql).toContain("1 = 0");
    expect(params).toContain("moved");
  });

  test("an unrecognized kind excludes BOTH halves (1=0 twice), never 400s at this layer", () => {
    const { sql } = buildActivityQuery({ kind: "not-a-real-kind" });
    expect(sql.match(/1 = 0/g)).toHaveLength(2);
  });

  test("from/to bind UTC day boundaries: from = start of day, to = start of the NEXT day (exclusive upper bound)", () => {
    const { params } = buildActivityQuery({ from: "2026-09-01", to: "2026-09-05" });
    expect(params).toContain("2026-09-01T00:00:00.000Z");
    expect(params).toContain("2026-09-06T00:00:00.000Z"); // to + 1 day
  });

  test("a malformed date is silently dropped, not bound and not thrown", () => {
    const { sql, params } = buildActivityQuery({ from: "not-a-date" });
    expect(sql).not.toContain("t.created_at >= ?");
    expect(params).toEqual([26, 0]);
  });

  test("page 2 with a custom pageSize computes the right LIMIT/OFFSET", () => {
    const { params } = buildActivityQuery({ page: 2, pageSize: 5 });
    expect(params).toEqual([6, 5]); // LIMIT 5+1, OFFSET (2-1)*5
  });

  // #511 — photo + sponsor entries. Gated behind `includeBoxExtras`, NOT
  // `venueId`: the global /boxes/activity feed also lets a visitor filter to
  // one box via its own dropdown, and these two kinds must appear on the
  // dedicated per-box history page ONLY (issue #511's own risk note).
  describe("includeBoxExtras (photo + sponsor entries, #511)", () => {
    test("false/undefined — neither box_photos nor box_adopters is queried at all", () => {
      const { sql } = buildActivityQuery({ venueId: "box-1" });
      expect(sql).not.toContain("box_photos");
      expect(sql).not.toContain("box_adopters");
    });

    test("true — both halves join in, approved-only, with the deterministic 9-column shape", () => {
      const { sql } = buildActivityQuery({ includeBoxExtras: true });
      expect(sql).toContain("FROM box_photos t");
      expect(sql).toContain("FROM box_adopters t");
      expect(sql).toContain("'photo' AS source");
      expect(sql).toContain("'sponsor' AS source");
      expect(sql).toContain("'photo_added' AS kind");
      expect(sql).toContain("'sponsor_added' AS kind");
      // Approved-only, never a pending/rejected/flagged row.
      expect(sql).toContain("t.status = 'approved'");
      // Sponsors are dated by approval, not application — box_adopters.reviewed_at.
      expect(sql).toContain("t.reviewed_at AS created_at");
      expect(sql).toContain("t.reviewed_at IS NOT NULL");
      // Sponsor display name only, never carries the email column.
      expect(sql).not.toContain("t.email");
    });

    test("true + venueId — the venue filter binds into every half, including the two new ones", () => {
      const { params } = buildActivityQuery({ includeBoxExtras: true, venueId: "box-1" });
      expect(params.filter((p) => p === "box-1")).toHaveLength(4); // checkin, event, photo, sponsor
    });

    test("still respects date-range filters on the new halves", () => {
      const { sql, params } = buildActivityQuery({ includeBoxExtras: true, from: "2026-09-01", to: "2026-09-05" });
      expect(sql).toContain("t.created_at >= ?");
      expect(sql).toContain("t.reviewed_at >= ?");
      // Bound into all 4 halves now: checkin + event (created_at), photo (created_at), sponsor (reviewed_at).
      expect(params.filter((p) => p === "2026-09-01T00:00:00.000Z")).toHaveLength(4);
    });
  });
});

describe("loadBoxActivity", () => {
  function fakeDb(rows: unknown[]) {
    const all = vi.fn().mockResolvedValue({ results: rows });
    const bind = vi.fn(() => ({ all }));
    const prepare = vi.fn(() => ({ bind }));
    return { prepare } as unknown as D1Database;
  }

  test("hasMore is true when more rows come back than the page size (the +1 probe row)", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      venue_id: "box-1",
      venue_name: "Box",
      venue_address: "1 Main St",
      source: "checkin",
      kind: "filled",
      detail: null,
      created_at: `2026-09-0${i + 1}T00:00:00.000Z`,
    }));
    const page = await loadBoxActivity(fakeDb(rows), { pageSize: 5 });
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    expect(page.page).toBe(1);
  });

  test("hasMore is false when fewer rows come back than the page size", async () => {
    const rows = [
      {
        venue_id: "box-1",
        venue_name: "Box",
        venue_address: "1 Main St",
        source: "event",
        kind: "added",
        detail: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const page = await loadBoxActivity(fakeDb(rows), { pageSize: 5 });
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });

  test("empty results -> empty items, hasMore false, no throw", async () => {
    const page = await loadBoxActivity(fakeDb([]), {});
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  test("a photo row maps photo_id onto ActivityItem.photoId", async () => {
    const rows = [
      {
        venue_id: "box-1",
        venue_name: "Box",
        venue_address: "1 Main St",
        source: "photo",
        kind: "photo_added",
        detail: null,
        photo_id: 42,
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const page = await loadBoxActivity(fakeDb(rows), { includeBoxExtras: true });
    expect(page.items[0].photoId).toBe(42);
  });

  test("a sponsor row maps detail (the approved display name) onto ActivityItem.detail, photoId null", async () => {
    const rows = [
      {
        venue_id: "box-1",
        venue_name: "Box",
        venue_address: "1 Main St",
        source: "sponsor",
        kind: "sponsor_added",
        detail: "Jane D.",
        photo_id: null,
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const page = await loadBoxActivity(fakeDb(rows), { includeBoxExtras: true });
    expect(page.items[0].detail).toBe("Jane D.");
    expect(page.items[0].photoId).toBeNull();
  });
});
