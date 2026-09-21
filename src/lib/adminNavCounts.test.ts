/**
 * adminNavCounts.test.ts — coverage for the four admin nav badge counts,
 * including the "one broken table degrades to 0 without touching the
 * others" guarantee (src/lib/adminNavCounts.ts's own header).
 */

import { describe, expect, test, vi } from "vitest";
import { loadAdminNavCounts, countPendingSubmissions, countPendingProposals } from "@/lib/adminNavCounts";

vi.mock("@/lib/boxPhotos", () => ({ countPendingReview: vi.fn() }));
vi.mock("@/lib/boxAdopters", () => ({ countPendingAdopters: vi.fn() }));

import { countPendingReview } from "@/lib/boxPhotos";
import { countPendingAdopters } from "@/lib/boxAdopters";

/** A fake D1 whose `.first()` resolves to `n`, or throws if `n` is undefined — simulates a missing/broken table. */
function makeFakeDb(n: number | undefined): D1Database {
  return {
    prepare: () => ({
      first: async () => {
        if (n === undefined) throw new Error("no such table");
        return { n };
      },
    }),
  } as unknown as D1Database;
}

describe("countPendingSubmissions / countPendingProposals", () => {
  test("returns the count from the row", async () => {
    expect(await countPendingSubmissions(makeFakeDb(3))).toBe(3);
    expect(await countPendingProposals(makeFakeDb(7))).toBe(7);
  });

  test("returns 0 when the row is missing", async () => {
    const db = { prepare: () => ({ first: async () => null }) } as unknown as D1Database;
    expect(await countPendingSubmissions(db)).toBe(0);
  });
});

describe("loadAdminNavCounts", () => {
  test("bundles all four counts", async () => {
    vi.mocked(countPendingReview).mockResolvedValue(2);
    vi.mocked(countPendingAdopters).mockResolvedValue(1);
    const db = {
      prepare: (sql: string) => ({
        first: async () => (sql.includes("public_submissions") ? { n: 5 } : { n: 4 }),
      }),
    } as unknown as D1Database;

    const counts = await loadAdminNavCounts(db);
    expect(counts).toEqual({ submissions: 5, proposals: 4, photos: 2, adopters: 1 });
  });

  test("one failing count degrades to 0 without affecting the others", async () => {
    vi.mocked(countPendingReview).mockRejectedValue(new Error("box_photos table missing"));
    vi.mocked(countPendingAdopters).mockResolvedValue(1);
    const db = {
      prepare: () => ({ first: async () => ({ n: 9 }) }),
    } as unknown as D1Database;

    const counts = await loadAdminNavCounts(db);
    expect(counts.photos).toBe(0);
    expect(counts.submissions).toBe(9);
    expect(counts.proposals).toBe(9);
    expect(counts.adopters).toBe(1);
  });
});
