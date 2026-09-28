/**
 * DashboardPage (/admin) test — rewritten for #680 ("Admin Dashboard
 * overhaul"), whose own Layout item 2 states: "This replaces today's
 * NeedsDecisionPanel / needs-help list / stale list blocks." The previous
 * version of this file asserted on those three retired blocks by name
 * (NeedsDecisionPanel's empty-state copy, BoxHealthList's "Every box is
 * doing fine.", StalePlacesList's "Every published place has been checked
 * recently."); none of that markup exists on the page anymore, so this file
 * is rewritten rather than patched — covering criterion: issue #680's own
 * Layout item 2, "This replaces today's NeedsDecisionPanel / needs-help
 * list / stale list blocks."
 *
 * Still covers the SAME auth-guard contract every other admin page's own
 * page.test.tsx pins (this page's getAdminDb() -> forbidden() fail-closed
 * wiring), plus a render smoke test that every new #680 section reaches the
 * page with SOME data. The actual data shaping (period math, KPI deltas,
 * box-stats aggregation, most-needed ranking) is covered by dedicated tests
 * against the pure functions themselves (boxStats.test.ts, cfAnalytics.test.ts,
 * KpiCard.test.tsx, BarList.test.tsx, DailyBars.test.tsx,
 * DashboardNeedsStrip.test.tsx) — this file does not re-derive any of that.
 *
 * The fake db below is deliberately lenient (every `.all()` resolves to
 * zero rows, every `.first()` to `{n: 0}`) rather than routing by exact SQL
 * text, same convention this file has always used — with zero rows
 * everywhere, every section lands on its own already-tested empty state.
 * CF_ANALYTICS_API_TOKEN is unset in the test environment, so
 * loadVisitorsAnalytics() returns null without ever calling fetch — the
 * Visitors section's own "unavailable" branch is what renders here (its
 * populated branch is covered by cfAnalytics.test.ts + KpiCard/BarList/
 * DailyBars' own render tests).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/adminOrigin";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

// Same mock shape as /admin/places' own page.test.tsx (#673) — this page
// now also calls getCloudflareContext() directly, to gate the Publish bar
// on isProductionWorker(). BETTER_AUTH_RP_ID undefined = production, same
// default that file uses; the dedicated staging behavior is unit-tested at
// isProductionWorker()'s own call sites, not re-proven here.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

import DashboardPage from "@/app/(site)/admin/page";
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

function noSearchParams() {
  return { searchParams: Promise.resolve({}) };
}

describe("DashboardPage (/admin) — auth guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CF_ANALYTICS_API_TOKEN;
    delete process.env.POSTHOG_PERSONAL_API_KEY;
  });

  test("success: renders the greeting and every #680 section's empty state, forbidden() not called", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });

    render(await DashboardPage(noSearchParams()));

    expect(screen.getByText("Hi admin")).toBeDefined();
    expect(screen.getByText("Visitors")).toBeDefined();
    expect(screen.getByText("Visitor numbers are unavailable right now.")).toBeDefined();
    // #681's own "Done when": "If PostHog is unreachable or the key is
    // missing, only this section shows 'Usage numbers are unavailable right
    // now'" — POSTHOG_PERSONAL_API_KEY is unset in the test environment
    // (same convention as CF_ANALYTICS_API_TOKEN above), so this is the
    // section's own "unavailable" branch; its populated branch is covered
    // by posthogQuery.test.ts + KpiCard/BarList's own render tests.
    expect(screen.getByText("What people do on the map")).toBeDefined();
    expect(screen.getByText("Usage numbers are unavailable right now.")).toBeDefined();
    expect(screen.getByText("Blessing boxes")).toBeDefined();
    expect(screen.getByText("Map data health")).toBeDefined();
    expect(screen.getByText("No automated data refresh has run yet.")).toBeDefined();
    // The period switch defaults to 30 days and links to the other two.
    expect(screen.getByRole("link", { name: "7 days" }).getAttribute("href")).toBe("/admin?period=7d");
    expect(screen.getByRole("link", { name: "90 days" }).getAttribute("href")).toBe("/admin?period=90d");
    // No unpublished changes -> the Publish bar itself never renders.
    expect(screen.queryByText(/waiting to go live/i)).toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("an explicit ?period= is honored; an unrecognized one falls back to 30 days", async () => {
    mockGetAdminDb.mockResolvedValue({ db: makeFakeDb(), identity: { email: "admin@example.com" } });
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });

    const first = render(await DashboardPage({ searchParams: Promise.resolve({ period: "7d" }) }));
    expect(screen.getByRole("link", { name: "7 days" }).getAttribute("aria-current")).toBe("page");
    first.unmount();

    render(await DashboardPage({ searchParams: Promise.resolve({ period: "not-a-real-period" }) }));
    expect(screen.getByRole("link", { name: "30 days" }).getAttribute("aria-current")).toBe("page");
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(DashboardPage(noSearchParams())).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("not_allowlisted");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(DashboardPage(noSearchParams())).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
