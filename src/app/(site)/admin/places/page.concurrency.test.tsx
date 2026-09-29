/**
 * Round-trip test for /admin/places: every D1 read on the page (venues,
 * pending proposals, pending submissions, the four nav-count queries) must be
 * IN FLIGHT at once. Each D1 call from the edge to the primary costs a
 * network round trip, so awaiting them one after another made the page take
 * the sum of them instead of the slowest one. The fake never resolves a query
 * until every query has been issued, so a serial page would hang here.
 */

import { describe, expect, test, vi } from "vitest";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({ getAdminDb: (...a: unknown[]) => mockGetAdminDb(...a) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { BETTER_AUTH_RP_ID: undefined } }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/logger", () => ({ logAdminAuthFailure: vi.fn() }));

import PlacesPage from "@/app/(site)/admin/places/page";

const EXPECTED_QUERIES = 7; // 3 page reads + 4 nav counts

describe("PlacesPage — D1 reads overlap", () => {
  test("issues every query before any of them resolves", async () => {
    let issued = 0;
    const release: Array<() => void> = [];
    const pending = <T,>(value: T) => {
      issued += 1;
      return new Promise<T>((resolve) => release.push(() => resolve(value)));
    };
    const db = {
      prepare: () => ({
        all: () => pending({ success: true, results: [], meta: {} }),
        first: () => pending({ n: 0 }),
      }),
    } as unknown as D1Database;
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    const rendered = PlacesPage();
    await new Promise((r) => setTimeout(r, 0));
    expect(issued).toBe(EXPECTED_QUERIES);

    release.forEach((r) => r());
    await rendered;
  });
});
