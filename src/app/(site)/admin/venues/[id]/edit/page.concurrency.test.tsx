/**
 * Round-trip test for /admin/venues/[id]/edit: once the venue row is known,
 * the page's other D1 reads (pending proposals, pending reports, and the four
 * nav counts) must all be in flight together, and the nav counts must start
 * alongside the venue read itself. Each D1 call is an edge -> primary round
 * trip, so the old one-await-per-read chain cost their sum. Every read except
 * the venue row is held open until all have been issued.
 */

import { describe, expect, test, vi } from "vitest";
import type { AdminVenueRow } from "@/types/venue";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({ getAdminDb: (...a: unknown[]) => mockGetAdminDb(...a) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { BETTER_AUTH_RP_ID: undefined } }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/AddVenueForm", () => ({ default: () => null }));
vi.mock("@/components/ArchiveVenueButton", () => ({ default: () => null }));

import EditVenuePage from "@/app/(site)/admin/venues/[id]/edit/page";

const venueRow = {
  id: "manual-abc",
  name: "Eastside Pantry",
  category: "pantry",
  lat: 38.25,
  lng: -104.6,
  address: "123 Test St, Pueblo, CO",
  hours_weekly: null,
  hours_irregular: null,
  accepts_snap: null,
  accepts_wic: null,
  phone: null,
  email: null,
  url: null,
  notes: null,
  operator: null,
  source: "Manual entry",
  last_verified: "2026-07-03",
  status: "draft",
  source_type: "manual",
  outside_county: 0,
  created_at: "2026-07-01T00:00:00.000Z",
  created_by: "admin@pueblofoodmap.com",
  updated_at: "2026-07-01T00:00:00.000Z",
  updated_by: "admin@pueblofoodmap.com",
  published_at: null,
  published_by: null,
} as AdminVenueRow;

describe("EditVenuePage — D1 reads overlap", () => {
  test("nav counts start with the venue read; every other read starts together", async () => {
    let issued = 0; // reads other than the venue row
    let openVenue!: () => void;
    const venueGate = new Promise<void>((r) => {
      openVenue = r;
    });
    const release: Array<() => void> = [];
    const pending = <T,>(value: T) => {
      issued += 1;
      return new Promise<T>((resolve) => release.push(() => resolve(value)));
    };
    const db = {
      prepare: (sql: string) => {
        const stmt = {
          bind: () => stmt,
          all: () => pending({ success: true, results: [], meta: {} }),
          first: () => (sql.includes("FROM venues") ? venueGate.then(() => venueRow) : pending({ n: 0 })),
        };
        return stmt;
      },
    } as unknown as D1Database;
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    const rendered = EditVenuePage({
      params: Promise.resolve({ id: "manual-abc" }),
      searchParams: Promise.resolve({}),
    });
    await new Promise((r) => setTimeout(r, 0));

    // The 4 nav counts are already in flight while the venue read is unresolved.
    expect(issued).toBe(4);
    openVenue();
    await new Promise((r) => setTimeout(r, 0));

    // 4 nav counts + pending proposals + pending reports
    expect(issued).toBe(6);

    release.forEach((r) => r());
    await rendered;
  });
});
