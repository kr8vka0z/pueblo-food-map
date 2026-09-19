/**
 * Tests for boxStats.ts's "current network numbers" addition (issue #512):
 * computeNetworkOverview's pure math, and loadNetworkStatsData()'s new
 * approved-sponsor-count query. New file rather than an edit to
 * boxStats.test.ts, to keep this addition's tests scoped to what it actually
 * changed.
 */

import { describe, test, expect } from "vitest";
import { computeNetworkOverview, loadNetworkStatsData } from "@/lib/boxStats";

// ─── computeNetworkOverview ──────────────────────────────────────────────────

describe("computeNetworkOverview", () => {
  test("zero boxes -> avg reads a plain '0', never 'NaN' or '0.0'", () => {
    expect(computeNetworkOverview(0, 0)).toEqual({ boxCount: 0, sponsorCount: 0, avgSponsorsPerBox: "0" });
  });

  test("zero boxes with a nonzero sponsor count still reads '0' (defensive — shouldn't happen in practice)", () => {
    expect(computeNetworkOverview(0, 3).avgSponsorsPerBox).toBe("0");
  });

  test("rounds to one decimal", () => {
    expect(computeNetworkOverview(5, 2).avgSponsorsPerBox).toBe("0.4");
  });

  test("zero sponsors on a nonzero box count reads '0.0', not the divide-by-zero '0'", () => {
    expect(computeNetworkOverview(3, 0).avgSponsorsPerBox).toBe("0.0");
  });

  test("passes boxCount/sponsorCount through unchanged", () => {
    expect(computeNetworkOverview(10, 4)).toEqual({ boxCount: 10, sponsorCount: 4, avgSponsorsPerBox: "0.4" });
  });
});

// ─── loadNetworkStatsData — approved sponsor count ──────────────────────────

function makeFakeDb(sponsorRows: { count: number }[] | null) {
  return {
    prepare: (sql: string) => {
      if (sql.includes("FROM venues")) return { all: async () => ({ results: [] }) };
      if (sql.includes("FROM box_checkins")) return { all: async () => ({ results: [] }) };
      if (sql.includes("FROM box_photos")) return { all: async () => ({ results: [] }) };
      if (sql.includes("FROM box_adopters")) {
        if (sponsorRows === null) throw new Error("no such table: box_adopters");
        return { all: async () => ({ results: sponsorRows }) };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  } as unknown as D1Database;
}

describe("loadNetworkStatsData — approved sponsor count", () => {
  test("reads the count from the sponsor query", async () => {
    const data = await loadNetworkStatsData(makeFakeDb([{ count: 4 }]));
    expect(data.approvedSponsorCount).toBe(4);
  });

  test("a missing box_adopters table degrades to 0, never throws (best-effort, same posture as the photos query)", async () => {
    const data = await loadNetworkStatsData(makeFakeDb(null));
    expect(data.approvedSponsorCount).toBe(0);
  });

  test("the sponsor query is scoped to approved status and live boxes, and never selects email", async () => {
    let capturedSql = "";
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM box_adopters")) {
          capturedSql = sql;
          return { all: async () => ({ results: [{ count: 0 }] }) };
        }
        if (sql.includes("FROM venues")) return { all: async () => ({ results: [] }) };
        if (sql.includes("FROM box_checkins")) return { all: async () => ({ results: [] }) };
        if (sql.includes("FROM box_photos")) return { all: async () => ({ results: [] }) };
        throw new Error(`unexpected query: ${sql}`);
      },
    } as unknown as D1Database;
    await loadNetworkStatsData(db);
    expect(capturedSql).toContain("a.status = 'approved'");
    expect(capturedSql).toContain("v.status != 'archived'");
    expect(capturedSql.toLowerCase()).not.toContain("email");
  });

  test("a pending or rejected adopter is excluded by the WHERE clause, not counted", async () => {
    // The fake DB can't simulate a real WHERE filter, so this asserts the
    // clause text itself is present — same "assert the SQL, not a fake
    // engine's behavior" convention the archived-box exclusion tests above
    // already use in boxStats.test.ts.
    let capturedSql = "";
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM box_adopters")) {
          capturedSql = sql;
          return { all: async () => ({ results: [{ count: 0 }] }) };
        }
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadNetworkStatsData(db);
    expect(capturedSql).toContain("WHERE a.status = 'approved'");
  });
});
