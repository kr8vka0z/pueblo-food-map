/**
 * Auth-guard regression test for the /admin/places Server Component page
 * (#237 checkpoint c; venue list #253). MOVED from /admin's own
 * page.test.tsx unchanged in intent (admin dashboard build moved the venue
 * list from /admin to /admin/places — see page.tsx's own header) — only the
 * import path, component name, and the nav-label assertions that follow
 * from swapping the old bespoke header for the shared AdminNav are updated.
 *
 * WHY this exists: page.tsx's own header says RSC page tests are hard in
 * this stack, so nothing pinned its auth contract directly — a future edit
 * could route around getAdminDb() (the single D1 choke point,
 * src/lib/adminDb.ts) or drop the try/catch's fail-closed handling and
 * nothing would fail red. This test calls the async Server Component
 * directly (`await PlacesPage()`) and mocks only getAdminDb, next/headers,
 * next/navigation's forbidden(), and the logger — adminOrigin.ts's real
 * AccessDeniedError is imported unmocked so `err instanceof
 * AccessDeniedError` inside the page still resolves true. Real JWT/D1
 * plumbing stays covered by adminDb.test.ts and adminOrigin.test.ts; this
 * file only proves the page wires those pieces together correctly.
 *
 * #673: the page also calls getCloudflareContext() directly now (to read
 * BETTER_AUTH_RP_ID for isProductionWorker()/isStaging), independent of the
 * getAdminDb mock above — same mock shape as
 * src/app/api/admin/publish/route.test.ts. Defaults to production
 * (BETTER_AUTH_RP_ID undefined) in every test below; the dedicated staging
 * banner + status-hiding behavior has its own test file
 * (page.staging.test.tsx).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/adminOrigin";
import type { AdminVenueRow } from "@/types/venue";

// Per-file vi.mock style matches src/app/api/admin/publish/route.test.ts and
// src/lib/adminDb.test.ts: a "mock"-prefixed const declared before the
// vi.mock call, referenced from inside the (hoisted) factory.
const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

// Value is irrelevant -- getAdminDb is mocked, so the page never actually
// reads these headers. Only its shape (a Headers-like .get()) matters.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

// Real Next.js forbidden() is a control-flow signal (it throws internally
// to unwind to the nearest forbidden boundary) -- throwing here lets the
// test assert it fired via `.rejects.toThrow`. useRouter is stubbed too
// (#256): the page's tree now includes PublishPanel, a Client Component
// that calls useRouter() for its post-publish router.refresh() -- this
// file's focus is the auth guard, not Publish, so a plain no-op stub is
// enough to let PublishPanel mount without crashing.
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

import PlacesPage from "@/app/admin/places/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

function makeVenueRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "venue-a",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "test",
    last_verified: "2026-01-01",
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin@example.com",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "admin@example.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@example.com",
    ...overrides,
  };
}

/**
 * Matches the page's real call chain: db.prepare(sql).all<AdminVenueRow>()
 * for the venues query, (#674) a second .all() for the pending
 * change_proposals query, and (#675) a third for the pending
 * public_submissions query — dispatches on SQL text so none of the three
 * ever cross wires (a fake that returned `seedRows` for any of them used to
 * work before each addition added its own query; every test below either
 * doesn't care about proposals/submissions at all, or passes them
 * explicitly).
 */
function makeFakeDb(seedRows: AdminVenueRow[], proposalRows: unknown[] = [], submissionRows: unknown[] = []) {
  return {
    prepare: (sql: string) => ({
      all: async () => ({
        success: true,
        results: sql.includes("FROM change_proposals")
          ? proposalRows
          : sql.includes("FROM public_submissions")
            ? submissionRows
            : seedRows,
        meta: {},
      }),
    }),
  } as unknown as D1Database;
}

describe("PlacesPage — auth guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email and venue rows, forbidden() not called", async () => {
    const venues = [
      makeVenueRow(),
      makeVenueRow({ id: "venue-b", name: "Main Street Grocery", category: "grocery" }),
    ];
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb(venues),
      identity: { email: "admin@example.com" },
    });
    // Production (BETTER_AUTH_RP_ID unset) — see this file's own header.
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });

    render(await PlacesPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    // Shared AdminNav (admin dashboard build) renders the nav row now —
    // "Places" is the active tab. #674 folded the old "Data refresh" nav
    // item into Places itself, and #675 folded "Review queue" the same
    // way — there is no separate link for either any more.
    const placesLink = screen.getByRole("link", { name: /^Places/ });
    expect(placesLink.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: /Data refresh/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Review queue" })).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    // "not_allowlisted" stands in for any AccessDeniedError reason OTHER
    // than "no_session" here — this test proves the generic forbidden()/403
    // branch, not this specific reason (see adminAuthErrors.ts).
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(PlacesPage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("not_allowlisted");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(PlacesPage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
