/**
 * Auth-guard regression test for the /admin Server Component page (#237
 * checkpoint c; venue list #253).
 *
 * WHY this exists: page.tsx's own header says RSC page tests are hard in
 * this stack, so nothing pinned its auth contract directly — a future edit
 * could route around getAdminDb() (the single D1 choke point,
 * src/lib/adminDb.ts) or drop the try/catch's fail-closed handling and
 * nothing would fail red. This test calls the async Server Component
 * directly (`await AdminPage()`) and mocks only getAdminDb, next/headers,
 * next/navigation's forbidden(), and the logger — cfAccess.ts's real
 * AccessDeniedError is imported unmocked so `err instanceof
 * AccessDeniedError` inside the page still resolves true. Real JWT/D1
 * plumbing stays covered by adminDb.test.ts and cfAccess.test.ts; this file
 * only proves the page wires those pieces together correctly.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { AdminVenueRow } from "@/types/venue";

// Per-file vi.mock style matches src/app/api/admin/publish/route.test.ts and
// src/lib/adminDb.test.ts: a "mock"-prefixed const declared before the
// vi.mock call, referenced from inside the (hoisted) factory.
const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

// Value is irrelevant -- getAdminDb is mocked, so the page never actually
// reads these headers. Only its shape (a Headers-like .get()) matters.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

// Real Next.js forbidden() is a control-flow signal (it throws internally
// to unwind to the nearest forbidden boundary) -- throwing here lets the
// test assert it fired via `.rejects.toThrow`.
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

import AdminPage from "@/app/admin/page";
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

/** Matches the page's real call chain: db.prepare(sql).all<AdminVenueRow>(). */
function makeFakeDb(seedRows: AdminVenueRow[]) {
  return {
    prepare: () => ({
      all: async () => ({ success: true, results: seedRows, meta: {} }),
    }),
  } as unknown as D1Database;
}

describe("AdminPage — auth guard", () => {
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

    render(await AdminPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("invalid_token"));

    await expect(AdminPage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("invalid_token");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(AdminPage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
