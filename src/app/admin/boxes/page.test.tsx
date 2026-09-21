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

import { afterEach, describe, expect, test, vi } from "vitest";
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

vi.mock("@/components/AdminBoxesMap", () => ({
  default: () => <div data-testid="admin-boxes-map-stub" />,
}));

import BoxesPage from "@/app/admin/boxes/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

/** Every query this page (and every lib function it calls) issues resolves to zero rows. */
function makeFakeDb() {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ success: true, results: [], meta: {} }),
    first: async () => ({ n: 0 }),
  };
  return { prepare: () => stmt } as unknown as object;
}

describe("BoxesPage (/admin/boxes) — auth guard", () => {
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
