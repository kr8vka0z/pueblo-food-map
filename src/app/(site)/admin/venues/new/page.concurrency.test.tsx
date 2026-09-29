/**
 * Round-trip test for /admin/venues/new: the submission prefill, proposal
 * prefill and four nav-count reads (6 D1 calls) must all be in flight
 * together. Each D1 call is an edge -> primary round trip; held open until all
 * are issued so a serial page would fail.
 */

import { describe, expect, test, vi } from "vitest";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({ getAdminDb: (...a: unknown[]) => mockGetAdminDb(...a) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/AddVenueForm", () => ({ default: () => null }));

import NewVenuePage from "@/app/(site)/admin/venues/new/page";

describe("NewVenuePage — D1 reads overlap", () => {
  test("prefill and nav-count reads are all issued before any resolves", async () => {
    let issued = 0;
    const release: Array<() => void> = [];
    const pending = <T,>(value: T) => {
      issued += 1;
      return new Promise<T>((resolve) => release.push(() => resolve(value)));
    };
    const stmt = {
      bind: () => stmt,
      all: () => pending({ success: true, results: [], meta: {} }),
      first: () => pending({ n: 0 }),
    };
    mockGetAdminDb.mockResolvedValue({ db: { prepare: () => stmt }, identity: { email: "a@example.com" } });

    const rendered = NewVenuePage({ searchParams: Promise.resolve({ submission: "1", proposal: "2" }) });
    await new Promise((r) => setTimeout(r, 0));
    expect(issued).toBe(6);

    release.forEach((r) => r());
    await rendered;
  });
});
