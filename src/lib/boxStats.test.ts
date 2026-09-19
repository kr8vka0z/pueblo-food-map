/**
 * Tests for src/lib/boxStats.ts (Blessing Boxes slice 7 — Numbers).
 * Covers the pure aggregation logic against plain fixtures, no D1 needed —
 * same convention blessingBoxes.test.ts/boxActivity.test.ts already use for
 * their own pure-function halves.
 */

import { describe, test, expect } from "vitest";
import {
  filterByPeriod,
  computeCheckinCounts,
  computePairAverages,
  computeNetworkPairAverages,
  groupCheckinsByVenue,
  formatDurationMs,
  rankLongestSinceLastFill,
  rankMostEmptyReports,
  rankSlowestRefill,
  computeMilestones,
  periodStartMs,
  loadNetworkStatsData,
  type NetworkStatsCheckin,
  type NeedLoveBox,
} from "@/lib/boxStats";
import type { CheckinStatusInput } from "@/lib/blessingBoxes";

function ci(overrides: Partial<CheckinStatusInput> = {}): CheckinStatusInput {
  return { kind: "filled", visibility: "visible", created_at: "2026-09-01T00:00:00.000Z", ...overrides };
}

const NOW = new Date("2026-09-17T12:00:00.000Z");

// ─── periodStartMs / filterByPeriod ─────────────────────────────────────────

describe("periodStartMs / filterByPeriod", () => {
  test("'all' has no lower bound", () => {
    expect(periodStartMs("all", NOW)).toBeNull();
  });

  test("7d/30d/90d compute the expected lower bound", () => {
    expect(periodStartMs("7d", NOW)).toBe(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(periodStartMs("30d", NOW)).toBe(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(periodStartMs("90d", NOW)).toBe(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
  });

  test("filterByPeriod keeps items exactly on the boundary (inclusive)", () => {
    const boundary = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const items = [{ created_at: boundary }];
    expect(filterByPeriod(items, "7d", NOW)).toHaveLength(1);
  });

  test("filterByPeriod drops items just before the boundary", () => {
    const justBefore = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000 - 1).toISOString();
    const items = [{ created_at: justBefore }];
    expect(filterByPeriod(items, "7d", NOW)).toHaveLength(0);
  });

  test("'all' returns every item, oldest included", () => {
    const items = [{ created_at: "2020-01-01T00:00:00.000Z" }];
    expect(filterByPeriod(items, "all", NOW)).toEqual(items);
  });
});

// ─── computeCheckinCounts ────────────────────────────────────────────────────

describe("computeCheckinCounts", () => {
  test("counts each public kind separately, sums to totalCheckins", () => {
    const checkins = [
      ci({ kind: "filled" }),
      ci({ kind: "filled" }),
      ci({ kind: "took" }),
      ci({ kind: "low" }),
      ci({ kind: "empty" }),
      ci({ kind: "empty" }),
      ci({ kind: "empty" }),
    ];
    const counts = computeCheckinCounts(checkins);
    expect(counts).toEqual({ fills: 2, uses: 1, lowReports: 1, emptyReports: 3, totalCheckins: 7 });
  });

  test("a hidden check-in never counts, of any kind", () => {
    const checkins = [ci({ kind: "filled", visibility: "hidden" }), ci({ kind: "empty", visibility: "hidden" })];
    expect(computeCheckinCounts(checkins)).toEqual({ fills: 0, uses: 0, lowReports: 0, emptyReports: 0, totalCheckins: 0 });
  });

  test("'problem' reports never count toward any public number, including totalCheckins", () => {
    const checkins = [ci({ kind: "filled" }), ci({ kind: "problem" })];
    expect(computeCheckinCounts(checkins).totalCheckins).toBe(1);
  });

  test("no check-ins -> all zeros, not an error", () => {
    expect(computeCheckinCounts([])).toEqual({ fills: 0, uses: 0, lowReports: 0, emptyReports: 0, totalCheckins: 0 });
  });
});

// ─── computePairAverages ─────────────────────────────────────────────────────

describe("computePairAverages", () => {
  test("a box with no check-ins -> every average is null (rendered '—', never 0)", () => {
    expect(computePairAverages([])).toEqual({ emptyToFillMs: null, fillToFillMs: null, fillToEmptyMs: null });
  });

  test("a lone 'empty' with no later 'filled' contributes no pair -> null, not 0", () => {
    const checkins = [ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" })];
    expect(computePairAverages(checkins).emptyToFillMs).toBeNull();
  });

  test("empty -> next fill: single pair computes the exact gap", () => {
    const checkins = [
      ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-03T00:00:00.000Z" }),
    ];
    expect(computePairAverages(checkins).emptyToFillMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  test("fill -> next fill: consecutive fills pair up, skipping other kinds between them", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "took", created_at: "2026-09-02T00:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-05T00:00:00.000Z" }),
    ];
    expect(computePairAverages(checkins).fillToFillMs).toBe(4 * 24 * 60 * 60 * 1000);
  });

  test("fill -> next empty: computes the drain time", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-04T00:00:00.000Z" }),
    ];
    expect(computePairAverages(checkins).fillToEmptyMs).toBe(3 * 24 * 60 * 60 * 1000);
  });

  test("multiple pairs of the same type average together", () => {
    const checkins = [
      ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-02T00:00:00.000Z" }), // 1 day
      ci({ kind: "empty", created_at: "2026-09-05T00:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-08T00:00:00.000Z" }), // 3 days
    ];
    // average of 1 and 3 days = 2 days
    expect(computePairAverages(checkins).emptyToFillMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  test("a hidden or 'problem' check-in is never part of a pair, out of order input is sorted first", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-05T00:00:00.000Z" }), // out of order on purpose
      ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-02T00:00:00.000Z", visibility: "hidden" }), // must be ignored
      ci({ kind: "problem", created_at: "2026-09-01T12:00:00.000Z" }), // must be ignored
    ];
    // the only valid pair is empty(9/1) -> filled(9/5), the hidden filled on 9/2 must not win
    expect(computePairAverages(checkins).emptyToFillMs).toBe(4 * 24 * 60 * 60 * 1000);
  });

  // ─── Repeat-safe empty<->fill pairing (fix, 2026-09-19) ─────────────────
  // The earlier "for every fromKind, find the first later toKind" approach
  // let a repeat check-in of the SAME kind generate a spurious extra pair —
  // see collectCheckinPairDeltas' own header in boxStats.ts for the full
  // spell/window reasoning these four tests each isolate one piece of.

  test("empty -> fill: repeated 'empty' reports before the next fill add no extra pairs (one pair per empty spell)", () => {
    const checkins = [
      ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-01T06:00:00.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-01T12:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-03T00:00:00.000Z" }),
    ];
    // exactly ONE pair: the FIRST empty (9/1 00:00) -> the fill, not three.
    expect(computePairAverages(checkins).emptyToFillMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  test("fill -> empty: only the LAST 'filled' before an 'empty' pairs with it, not an earlier superseded fill", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-02T00:00:00.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-05T00:00:00.000Z" }),
    ];
    // must pair with the 9/2 fill (3 days), never forward-pair the 9/1 fill (4 days).
    expect(computePairAverages(checkins).fillToEmptyMs).toBe(3 * 24 * 60 * 60 * 1000);
  });

  test("fill -> empty: only the FIRST empty of a spell closes the pair", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-01T00:00:00.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-02T00:00:00.000Z" }), // closes the pair (1 day)
      ci({ kind: "empty", created_at: "2026-09-04T00:00:00.000Z" }), // repeat in the same spell, no pair
      ci({ kind: "filled", created_at: "2026-09-10T00:00:00.000Z" }),
    ];
    expect(computePairAverages(checkins).fillToEmptyMs).toBe(1 * 24 * 60 * 60 * 1000);
  });

  test("real dev data (practice box 2 timeline, all fields verified against Kyle's reported values)", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-02T01:45:10.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-02T07:59:20.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-02T08:01:13.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-02T08:01:59.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-02T08:26:37.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-02T08:26:49.000Z" }),
    ];
    const averages = computePairAverages(checkins);
    // fill -> empty: exactly two pairs — (07:59:20 -> 08:01:13) = 113,000ms,
    // (08:01:59 -> 08:26:37) = 1,478,000ms. The 01:45:10 fill must NOT pair
    // forward across the later 07:59:20 fill to the 08:01:13 empty (the
    // pre-fix bug: 3 pairs, adding a spurious 01:45:10 -> 08:01:13 pair).
    expect(averages.fillToEmptyMs).toBe((113_000 + 1_478_000) / 2);
    // empty -> fill: exactly two pairs — (08:01:13 -> 08:01:59) = 46,000ms,
    // (08:26:37 -> 08:26:49) = 12,000ms.
    expect(averages.emptyToFillMs).toBe((46_000 + 12_000) / 2);
  });
});

// ─── computeNetworkPairAverages ──────────────────────────────────────────────

describe("computeNetworkPairAverages", () => {
  test("pools every pair across boxes -- NOT the mean of each box's own mean", () => {
    // Box A: one pair, 1 day. Box B: three pairs, 9 days each.
    const byBox = new Map<string, CheckinStatusInput[]>([
      [
        "a",
        [
          ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-09-02T00:00:00.000Z" }),
        ],
      ],
      [
        "b",
        [
          ci({ kind: "empty", created_at: "2026-01-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-01-10T00:00:00.000Z" }),
          ci({ kind: "empty", created_at: "2026-02-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-02-10T00:00:00.000Z" }),
          ci({ kind: "empty", created_at: "2026-03-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-03-10T00:00:00.000Z" }),
        ],
      ],
    ]);
    // Mean-of-means would be (1 + 9) / 2 = 5 days. Pooled mean is
    // (1 + 9 + 9 + 9) / 4 = 7 days -- box B's 3 pairs correctly outweigh box A's 1.
    const result = computeNetworkPairAverages(byBox);
    expect(result.emptyToFillMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("no boxes / no pairs -> null, not NaN or 0", () => {
    expect(computeNetworkPairAverages(new Map())).toEqual({
      emptyToFillMs: null,
      fillToFillMs: null,
      fillToEmptyMs: null,
    });
  });

  test("a pair never crosses a box boundary", () => {
    const byBox = new Map<string, CheckinStatusInput[]>([
      ["a", [ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" })]],
      ["b", [ci({ kind: "filled", created_at: "2026-09-05T00:00:00.000Z" })]],
    ]);
    expect(computeNetworkPairAverages(byBox).emptyToFillMs).toBeNull();
  });
});

// ─── groupCheckinsByVenue ────────────────────────────────────────────────────

describe("groupCheckinsByVenue", () => {
  test("groups by venue_id, preserving each box's own check-ins only", () => {
    const checkins: NetworkStatsCheckin[] = [
      { venue_id: "a", kind: "filled", visibility: "visible", created_at: "2026-09-01T00:00:00.000Z" },
      { venue_id: "b", kind: "empty", visibility: "visible", created_at: "2026-09-02T00:00:00.000Z" },
      { venue_id: "a", kind: "took", visibility: "visible", created_at: "2026-09-03T00:00:00.000Z" },
    ];
    const byVenue = groupCheckinsByVenue(checkins);
    expect(byVenue.get("a")).toEqual([
      { kind: "filled", visibility: "visible", created_at: "2026-09-01T00:00:00.000Z" },
      { kind: "took", visibility: "visible", created_at: "2026-09-03T00:00:00.000Z" },
    ]);
    expect(byVenue.get("b")).toEqual([{ kind: "empty", visibility: "visible", created_at: "2026-09-02T00:00:00.000Z" }]);
  });

  test("empty input -> empty map", () => {
    expect(groupCheckinsByVenue([]).size).toBe(0);
  });
});

// ─── formatDurationMs ────────────────────────────────────────────────────────

describe("formatDurationMs", () => {
  test("under 24h formats as whole hours", () => {
    expect(formatDurationMs(5 * 60 * 60 * 1000)).toEqual({ value: 5, unit: "hours" });
  });

  test("24h and over formats as days, rounded to one decimal", () => {
    expect(formatDurationMs(2.5 * 24 * 60 * 60 * 1000)).toEqual({ value: 2.5, unit: "days" });
  });

  test("exactly 24h formats as 1 day, not 24 hours", () => {
    expect(formatDurationMs(24 * 60 * 60 * 1000)).toEqual({ value: 1, unit: "days" });
  });
});

// ─── Boxes that need love ────────────────────────────────────────────────────

function needLoveBox(overrides: Partial<NeedLoveBox> = {}): NeedLoveBox {
  return { id: "box-1", name: "Box 1", archived: false, checkins: [], ...overrides };
}

describe("rankLongestSinceLastFill", () => {
  test("a never-filled box sorts before every filled box", () => {
    const boxes = [
      needLoveBox({ id: "filled", name: "Filled", checkins: [ci({ kind: "filled", created_at: "2026-09-16T00:00:00.000Z" })] }),
      needLoveBox({ id: "never", name: "Never" }),
    ];
    const ranked = rankLongestSinceLastFill(boxes);
    expect(ranked[0].id).toBe("never");
    expect(ranked[0].lastFilledAt).toBeNull();
  });

  test("among filled boxes, the OLDEST last-filled date sorts first (longest since)", () => {
    const boxes = [
      needLoveBox({ id: "recent", name: "Recent", checkins: [ci({ kind: "filled", created_at: "2026-09-16T00:00:00.000Z" })] }),
      needLoveBox({ id: "old", name: "Old", checkins: [ci({ kind: "filled", created_at: "2026-01-01T00:00:00.000Z" })] }),
    ];
    expect(rankLongestSinceLastFill(boxes).map((b) => b.id)).toEqual(["old", "recent"]);
  });

  test("archived boxes are excluded entirely", () => {
    const boxes = [needLoveBox({ id: "archived", archived: true })];
    expect(rankLongestSinceLastFill(boxes)).toEqual([]);
  });

  test("respects the limit", () => {
    const boxes = Array.from({ length: 10 }, (_, i) => needLoveBox({ id: `b${i}`, name: `B${i}` }));
    expect(rankLongestSinceLastFill(boxes, 3)).toHaveLength(3);
  });
});

describe("rankMostEmptyReports", () => {
  test("sorted descending by empty-report count", () => {
    const boxes = [
      needLoveBox({ id: "a", name: "A", checkins: [ci({ kind: "empty" })] }),
      needLoveBox({ id: "b", name: "B", checkins: [ci({ kind: "empty" }), ci({ kind: "empty" }), ci({ kind: "empty" })] }),
    ];
    expect(rankMostEmptyReports(boxes).map((b) => b.id)).toEqual(["b", "a"]);
  });

  test("a box with zero empty reports is excluded, not shown at 0", () => {
    const boxes = [needLoveBox({ id: "clean", checkins: [ci({ kind: "filled" })] })];
    expect(rankMostEmptyReports(boxes)).toEqual([]);
  });

  test("archived boxes are excluded entirely", () => {
    const boxes = [needLoveBox({ id: "archived", archived: true, checkins: [ci({ kind: "empty" })] })];
    expect(rankMostEmptyReports(boxes)).toEqual([]);
  });

  test("a hidden empty report never counts", () => {
    const boxes = [needLoveBox({ id: "a", checkins: [ci({ kind: "empty", visibility: "hidden" })] })];
    expect(rankMostEmptyReports(boxes)).toEqual([]);
  });
});

describe("rankSlowestRefill", () => {
  test("sorted descending by average empty->fill time", () => {
    const boxes = [
      needLoveBox({
        id: "fast",
        name: "Fast",
        checkins: [
          ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-09-02T00:00:00.000Z" }),
        ],
      }),
      needLoveBox({
        id: "slow",
        name: "Slow",
        checkins: [
          ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-09-10T00:00:00.000Z" }),
        ],
      }),
    ];
    expect(rankSlowestRefill(boxes).map((b) => b.id)).toEqual(["slow", "fast"]);
  });

  test("a box with no qualifying pair is excluded, never shown as slowest by default", () => {
    const boxes = [needLoveBox({ id: "no-pair", checkins: [ci({ kind: "empty" })] })];
    expect(rankSlowestRefill(boxes)).toEqual([]);
  });

  test("archived boxes are excluded entirely", () => {
    const boxes = [
      needLoveBox({
        id: "archived",
        archived: true,
        checkins: [
          ci({ kind: "empty", created_at: "2026-09-01T00:00:00.000Z" }),
          ci({ kind: "filled", created_at: "2026-09-10T00:00:00.000Z" }),
        ],
      }),
    ];
    expect(rankSlowestRefill(boxes)).toEqual([]);
  });
});

// ─── computeMilestones ───────────────────────────────────────────────────────

describe("computeMilestones", () => {
  test("below the first threshold on both metrics -> no milestones at all", () => {
    expect(computeMilestones({ fills: 3, uses: 9 })).toEqual([]);
  });

  test("reports the SINGLE highest threshold crossed per metric, not every one crossed", () => {
    const milestones = computeMilestones({ fills: 260, uses: 0 });
    expect(milestones).toEqual([{ metric: "fills", threshold: 250 }]);
  });

  test("both metrics can independently reach a milestone", () => {
    const milestones = computeMilestones({ fills: 12, uses: 30 });
    expect(milestones).toContainEqual({ metric: "fills", threshold: 10 });
    expect(milestones).toContainEqual({ metric: "uses", threshold: 25 });
  });

  test("exactly on a threshold counts as reached", () => {
    expect(computeMilestones({ fills: 10, uses: 0 })).toEqual([{ metric: "fills", threshold: 10 }]);
  });
});

// ─── loadNetworkStatsData (fake D1Database, SQL-text discriminated) ─────────
// Same convention blessingBoxes.test.ts's makeFakeDbWithPhotos uses: a fake
// D1Database that picks a canned result set by inspecting the prepared SQL
// text, since there's no real D1 binding in a unit test.

function makeFakeNetworkDb(
  venueRows: { id: string; name: string; status: string }[],
  checkinRows: NetworkStatsCheckin[],
  photoRows: { venue_id: string; created_at: string }[],
) {
  const prepare = (sql: string) => {
    if (sql.includes("FROM venues")) {
      return { all: async () => ({ results: venueRows }) };
    }
    if (sql.includes("FROM box_checkins")) {
      return { all: async () => ({ results: checkinRows }) };
    }
    if (sql.includes("FROM box_photos")) {
      return { all: async () => ({ results: photoRows }) };
    }
    throw new Error(`unexpected query: ${sql}`);
  };
  return { prepare } as unknown as D1Database;
}

describe("loadNetworkStatsData", () => {
  test("maps a non-archived venue's status into a plain archived boolean (draft and published both read false)", async () => {
    const db = makeFakeNetworkDb(
      [
        { id: "a", name: "A", status: "published" },
        { id: "b", name: "B", status: "draft" },
      ],
      [],
      [],
    );
    const data = await loadNetworkStatsData(db);
    expect(data.boxes).toEqual([
      { id: "a", name: "A", archived: false },
      { id: "b", name: "B", archived: false },
    ]);
  });

  // Fix, 2026-09-19 (reversing this slice's earlier "network totals keep an
  // archived box's history forever" design — see boxStats.ts's own header
  // and AGENTS.md's slice 7 section for the record): archived boxes must
  // never reach this route's response at all, same exclusion every other
  // public box query in this repo already applies. The fake DB below
  // doesn't simulate real SQL filtering (it just echoes back whatever rows
  // the test hands it), so these three tests assert the SQL TEXT itself —
  // the only way a unit test can catch a future edit that drops the
  // exclusion clause, same pattern the `visibility = 'visible'` test below
  // already established for the check-ins query.
  test("the venues query excludes archived boxes at the SQL level", async () => {
    let capturedSql = "";
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM venues")) capturedSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadNetworkStatsData(db);
    expect(capturedSql).toContain("v.status != 'archived'");
  });

  test("the check-ins query excludes archived boxes at the SQL level, not only non-problem/visible", async () => {
    let capturedSql = "";
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM box_checkins")) capturedSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadNetworkStatsData(db);
    expect(capturedSql).toContain("v.status != 'archived'");
  });

  test("the photos query excludes archived boxes at the SQL level", async () => {
    let capturedSql = "";
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM box_photos")) capturedSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadNetworkStatsData(db);
    expect(capturedSql).toContain("v.status != 'archived'");
  });

  test("passes checkins and photos through unchanged", async () => {
    const checkins: NetworkStatsCheckin[] = [
      { venue_id: "a", kind: "filled", visibility: "visible", created_at: "2026-09-17T00:00:00.000Z" },
    ];
    const photos = [{ venue_id: "a", created_at: "2026-09-17T00:00:00.000Z" }];
    const db = makeFakeNetworkDb([], checkins, photos);
    const data = await loadNetworkStatsData(db);
    expect(data.checkins).toEqual(checkins);
    expect(data.photos).toEqual(photos);
  });

  test("a photos-table failure degrades photos to [] without taking down boxes/checkins", async () => {
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM venues")) return { all: async () => ({ results: [{ id: "a", name: "A", status: "published" }] }) };
        if (sql.includes("FROM box_checkins")) return { all: async () => ({ results: [] }) };
        if (sql.includes("FROM box_photos")) throw new Error("no such table: box_photos");
        throw new Error(`unexpected query: ${sql}`);
      },
    } as unknown as D1Database;
    const data = await loadNetworkStatsData(db);
    expect(data.boxes).toHaveLength(1);
    expect(data.photos).toEqual([]);
  });

  test("a checkins-table failure propagates (an outage is a full stats outage, matching loadVisibleCheckins' own posture)", async () => {
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM venues")) return { all: async () => ({ results: [] }) };
        if (sql.includes("FROM box_checkins")) throw new Error("no such table: box_checkins");
        throw new Error(`unexpected query: ${sql}`);
      },
    } as unknown as D1Database;
    await expect(loadNetworkStatsData(db)).rejects.toThrow("no such table: box_checkins");
  });

  // Belt-and-suspenders: the pure aggregation functions filter `visibility`
  // themselves (see publicCheckins() in boxStats.ts), but a hidden check-in
  // must never even leave D1 in a PUBLIC route's response — same structural
  // "never even fetch the private thing" rule every other public check-in
  // read in this repo enforces at the SQL level (SELECT_VISIBLE_CHECKINS_SQL,
  // blessingBoxes.ts). This asserts the SQL text itself, not just the
  // pure-function layer, so a future edit that drops the WHERE clause fails
  // a test instead of shipping a data leak silently.
  test("the check-ins query filters visibility = 'visible' at the SQL level, not only in application code", async () => {
    let capturedSql = "";
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM box_checkins")) capturedSql = sql;
        if (sql.includes("FROM venues")) return { all: async () => ({ results: [] }) };
        if (sql.includes("FROM box_checkins")) return { all: async () => ({ results: [] }) };
        if (sql.includes("FROM box_photos")) return { all: async () => ({ results: [] }) };
        throw new Error(`unexpected query: ${sql}`);
      },
    } as unknown as D1Database;
    await loadNetworkStatsData(db);
    expect(capturedSql).toContain("visibility = 'visible'");
  });
});
