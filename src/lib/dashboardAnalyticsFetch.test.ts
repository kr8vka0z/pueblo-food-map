/**
 * dashboardAnalyticsFetch.test.ts — the admin Dashboard's two analytics
 * loaders, run together exactly as page.tsx runs them, must never hold more
 * than 5 outbound fetches open at once (Workers queues anything past 6 per
 * request, and a queued fetch burns its timeout while it waits), and one
 * transient PostHog 5xx must be retried rather than nulling the whole section.
 */

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { CF_ANALYTICS_ACCOUNT_ID: "acct" } }),
}));

import { loadVisitorsAnalytics, _clearVisitorsAnalyticsCacheForTests } from "@/lib/cfAnalytics";
import { loadMapUsageAnalytics, _clearMapUsageAnalyticsCacheForTests } from "@/lib/posthogQuery";

const CF_BODY = { data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [], rumWebVitalsEventsAdaptiveGroups: [] }] } } };

describe("Dashboard analytics — concurrency cap and one retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    _clearVisitorsAnalyticsCacheForTests();
    _clearMapUsageAnalyticsCacheForTests();
  });

  test("both loaders together keep <= 5 fetches in flight, and a single PostHog 500 is retried", async () => {
    vi.stubEnv("CF_ANALYTICS_API_TOKEN", "cf-test");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "ph-test");

    let inFlight = 0;
    let peak = 0;
    let posthogCalls = 0;
    const mockFetch = vi.fn(async (url: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      // A real delay, so overlapping calls actually overlap.
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (url.includes("cloudflare")) return new Response(JSON.stringify(CF_BODY), { status: 200 });
      posthogCalls++;
      if (posthogCalls === 1) return new Response("upstream hiccup", { status: 502 });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);

    const now = new Date("2026-10-19T12:00:00Z");
    const [visitors, mapUsage] = await Promise.all([
      loadVisitorsAnalytics("30d", now),
      loadMapUsageAnalytics("30d", "630731", undefined, now),
    ]);

    expect(visitors).not.toBeNull();
    expect(mapUsage).not.toBeNull();
    expect(peak).toBeLessThanOrEqual(5);
    // 2 Cloudflare + 8 PostHog + 1 retry.
    expect(mockFetch).toHaveBeenCalledTimes(11);
  });
});
