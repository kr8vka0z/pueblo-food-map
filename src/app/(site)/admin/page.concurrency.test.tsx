/**
 * Round-trip test for /admin (Dashboard): the Cloudflare and PostHog analytics
 * calls must start together with the D1 reads, not after them. They are
 * independent network calls (each capped at a 4s timeout, and the in-memory
 * cache is empty on a cold Worker, which is exactly what a first visit after
 * sign-in hits), so awaiting them one after another stacked their latency on
 * top of the D1 reads. D1 stays held open below until both loaders have been
 * called; a serial page would never reach them and the assertion would fail.
 */

import { describe, expect, test, vi } from "vitest";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({ getAdminDb: (...a: unknown[]) => mockGetAdminDb(...a) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { BETTER_AUTH_RP_ID: undefined, POSTHOG_PROJECT_ID: "1" } }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/logger", () => ({ logAdminAuthFailure: vi.fn() }));

const mockLoadVisitors = vi.fn(async () => null);
vi.mock("@/lib/cfAnalytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cfAnalytics")>()),
  loadVisitorsAnalytics: (...a: unknown[]) => (mockLoadVisitors as (...x: unknown[]) => unknown)(...a),
}));
const mockLoadMapUsage = vi.fn(async () => null);
vi.mock("@/lib/posthogQuery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/posthogQuery")>()),
  loadMapUsageAnalytics: (...a: unknown[]) => (mockLoadMapUsage as (...x: unknown[]) => unknown)(...a),
}));

import DashboardPage from "@/app/(site)/admin/page";

describe("DashboardPage — external analytics overlap the D1 reads", () => {
  test("Cloudflare + PostHog calls start before any D1 read resolves", async () => {
    let releaseD1!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseD1 = resolve;
    });
    const stmt = {
      bind: () => stmt,
      all: async () => (await gate, { success: true, results: [], meta: {} }),
      first: async () => (await gate, { n: 0 }),
    };
    mockGetAdminDb.mockResolvedValue({ db: { prepare: () => stmt }, identity: { email: "admin@example.com" } });

    const rendered = DashboardPage({ searchParams: Promise.resolve({}) });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockLoadVisitors).toHaveBeenCalledTimes(1);
    expect(mockLoadMapUsage).toHaveBeenCalledTimes(1);

    releaseD1();
    await rendered;
  });
});
