/**
 * BoxesPage (/admin/boxes) auth-guard test — same rationale as
 * src/app/admin/page.test.tsx (the Dashboard's own page test): the data
 * shaping here is already covered by dedicated tests against the pure
 * functions (boxHealth.test.ts, adminDashboard.test.ts) and the
 * presentational components (BoxReportsChart/AllBoxesTable/
 * BoxesWaitingChips .test.tsx files) — this file only pins the
 * getAdminDb() -> forbidden() fail-closed wiring and that a real render
 * reaches every section with SOME data.
 *
 * #678 removed the status map (AdminBoxesMap) from this page entirely, so
 * the mock + entries-spy this file used to carry for it are gone too — the
 * "removed box excluded from a map" regression it used to guard is now
 * moot (there is no map on this tab anymore; AllBoxesTable's own tests
 * cover how a removed box renders in the table).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/adminOrigin";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

const mockLoadBoxHealthEntries = vi.fn();
vi.mock("@/lib/adminBoxes", () => ({
  loadBoxHealthEntries: (...args: unknown[]) => mockLoadBoxHealthEntries(...args),
}));

import BoxesPage from "@/app/admin/boxes/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";
import type { BoxHealthEntry } from "@/lib/boxHealth";

/** Every query this page (and every lib function it calls) issues resolves to zero rows. */
function makeFakeDb() {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ success: true, results: [], meta: {} }),
    first: async () => ({ n: 0 }),
  };
  return { prepare: () => stmt } as unknown as object;
}

function boxEntry(overrides: Partial<BoxHealthEntry> = {}): BoxHealthEntry {
  return {
    venueId: "box-1",
    name: "Test Box",
    address: "123 Test St",
    lat: 38.25,
    lng: -104.6,
    health: { status: "ok", latest: null, daysSinceLastReport: null },
    sponsors: [],
    removedOn: null,
    ...overrides,
  };
}

describe("BoxesPage (/admin/boxes) — auth guard", () => {
  beforeEach(() => {
    mockLoadBoxHealthEntries.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email and every section's empty state", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });

    render(await BoxesPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByText("Blessing boxes — 0 in service")).toBeDefined();
    expect(screen.getByText(/No box reports in the last 8 weeks/)).toBeDefined();
    expect(screen.getByText("No blessing boxes yet.")).toBeDefined();
    // Zero pending photos/adopters -> the "Waiting on you" strip renders nothing.
    expect(screen.queryByText("Waiting on you:")).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("a removed box still appears in the all-boxes table, marked removed", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });
    mockLoadBoxHealthEntries.mockResolvedValue([
      boxEntry({ venueId: "active-box", name: "Active Box", removedOn: null }),
      boxEntry({ venueId: "removed-box", name: "Removed Box", removedOn: "2026-08-01T00:00:00.000Z" }),
    ]);

    render(await BoxesPage());

    expect(screen.getByText("Blessing boxes — 1 in service")).toBeDefined();
    expect(screen.getByText("Active Box")).toBeDefined();
    expect(screen.getByText("Removed Box")).toBeDefined();
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(BoxesPage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("not_allowlisted");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(BoxesPage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
