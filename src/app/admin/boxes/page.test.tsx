/**
 * BoxesPage (/admin/boxes) auth-guard test — same rationale as
 * src/app/admin/page.test.tsx (the Dashboard's own page test): the data
 * shaping here is already covered by dedicated tests against the pure
 * functions (boxHealth.test.ts, adminDashboard.test.ts) and the
 * presentational components (BoxHealthList/BoxReportsChart/AllBoxesTable/
 * BoxesWaitingChips .test.tsx files) — this file only pins the
 * getAdminDb() -> forbidden() fail-closed wiring and that a real render
 * reaches every section with SOME data.
 *
 * AdminBoxesMap is mocked to a stub (same reason its own dedicated test
 * file mocks react-map-gl/mapbox wholesale — jsdom has no real WebGL
 * context, and this page test isn't the place to re-prove marker
 * rendering).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";

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

// Captures the entries prop each render passes, so item 2's "removed boxes
// excluded from the map" fix is provable without a real WebGL canvas.
const mapEntriesSpy = vi.fn();
vi.mock("@/components/AdminBoxesMap", () => ({
  default: (props: { entries: { venueId: string }[] }) => {
    mapEntriesSpy(props.entries);
    return <div data-testid="admin-boxes-map-stub" />;
  },
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
    caretaker: null,
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

  test("success: renders the signed-in email, the map stub, and every section's empty state", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });

    render(await BoxesPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByText("Blessing boxes — 0 in service")).toBeDefined();
    expect(screen.getByTestId("admin-boxes-map-stub")).toBeDefined();
    expect(screen.getByText("Every box is doing fine.")).toBeDefined();
    expect(screen.getByText("Every box has reported in recently.")).toBeDefined();
    expect(screen.getByText(/No box reports in the last 8 weeks/)).toBeDefined();
    expect(screen.getByText("No blessing boxes yet.")).toBeDefined();
    // Zero pending photos/adopters -> the "Waiting on you" strip renders nothing.
    expect(screen.queryByText("Waiting on you:")).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  // Item 2 regression: a removed box must not reach the map (a "does this
  // need attention" surface), but AllBoxesTable still gets every box —
  // it's the one place a removed box is supposed to keep showing, marked
  // removed.
  test("removed box excluded from the map, still present in the all-boxes table", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });
    mockLoadBoxHealthEntries.mockResolvedValue([
      boxEntry({ venueId: "active-box", name: "Active Box", removedOn: null }),
      boxEntry({ venueId: "removed-box", name: "Removed Box", removedOn: "2026-08-01T00:00:00.000Z" }),
    ]);

    render(await BoxesPage());

    expect(screen.getByText("Blessing boxes — 1 in service")).toBeDefined();
    const mapEntries = mapEntriesSpy.mock.calls.at(-1)?.[0] as { venueId: string }[];
    expect(mapEntries.map((e) => e.venueId)).toEqual(["active-box"]);
    // AllBoxesTable renders both names — removed boxes stay visible there.
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
