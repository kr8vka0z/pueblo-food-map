/**
 * DashboardPage (/admin) auth-guard test — same rationale as every other
 * admin page's own page.test.tsx (e.g. src/app/admin/submissions/page.test.tsx):
 * this page's getAdminDb() -> forbidden() fail-closed wiring is the one
 * thing worth pinning at this layer. The Dashboard's actual data shaping
 * (stale-places selection, box-health ranking, publish-summary math,
 * "needs a decision" grouping) is already covered by dedicated tests
 * against the pure functions themselves (src/lib/adminDashboard.test.ts,
 * boxHealth.test.ts, adminVenues.test.ts) and the presentational
 * components that render them (NeedsDecisionPanel.test.tsx,
 * BoxHealthList.test.tsx, StalePlacesList.test.tsx) — this file does not
 * re-derive any of that, only that a real render reaches those components
 * with SOME data and that the auth failure paths behave.
 *
 * The fake db below is deliberately lenient (every `.all()` resolves to
 * zero rows, every `.first()` to `{n: 0}`) rather than routing by exact SQL
 * text: with zero venues/zero pending rows in every table, every panel this
 * page renders lands on its own already-tested empty state, and the one
 * conditional query this page skips entirely when its inputs are empty
 * (loadVenueLookup's proposal-id lookup, loadBoxHealthEntries' check-in/
 * adopter reads once the box-venues query returns nothing) never fires —
 * see this page's own header for why that's true, not assumed.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
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
  // NeedsDecisionPanel (rendered by this page) calls useRouter() for its
  // own router.refresh() on a successful approve/reject — never exercised
  // by this page-level test, but the component still calls the hook on
  // every render, so it must resolve to something.
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

import DashboardPage from "@/app/admin/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

/** Every query this page (and every lib function it calls) issues resolves to zero rows — see file header for why nothing deeper ever fires with this input. */
function makeFakeDb() {
  const stmt = {
    bind: () => stmt,
    all: async () => ({ success: true, results: [], meta: {} }),
    first: async () => ({ n: 0 }),
  };
  return { prepare: () => stmt } as unknown as object;
}

describe("DashboardPage (/admin) — auth guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email and every panel's empty state, forbidden() not called", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });

    render(await DashboardPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(
      screen.getByText(
        "Nothing waiting on you. New suggestions, data changes, box photos and adoption requests show up here as they come in.",
      ),
    ).toBeDefined();
    expect(screen.getByText("Every box is doing fine.")).toBeDefined();
    expect(screen.getByText(/Every published place has been checked recently/)).toBeDefined();
    // No unpublished changes -> the Publish bar itself never renders.
    expect(screen.queryByText(/waiting to go live/i)).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(DashboardPage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("not_allowlisted");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(DashboardPage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
