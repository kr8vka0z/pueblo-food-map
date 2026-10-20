/**
 * dashboardAnalyticsFetch.test.ts — the admin Dashboard's two analytics
 * loaders, run together exactly as page.tsx runs them (one shared limiter per
 * render), must never hold more than 5 outbound fetches open at once (Workers
 * queues anything past 6 per request, and a queued fetch burns its timeout
 * while it waits) nor more than 3 PostHog queries (PostHog's own per-project
 * cap, past which it queues them server-side), must retry one transient PostHog 5xx rather than null the
 * whole section, must keep every Cloudflare query inside its 13w2d range
 * limit (90d used to ask for 180 days and always failed), and must give up
 * (null, never throw) at the overall deadline instead of hanging the page.
 */

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { CF_ANALYTICS_ACCOUNT_ID: "acct" } }),
}));

import { loadVisitorsAnalytics, _clearVisitorsAnalyticsCacheForTests } from "@/lib/cfAnalytics";
import { loadMapUsageAnalytics, _clearMapUsageAnalyticsCacheForTests } from "@/lib/posthogQuery";
import { ANALYTICS_DEADLINE_MS, createFetchLimiter } from "@/lib/analyticsFetch";

const CF_BODY = { data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [], rumWebVitalsEventsAdaptiveGroups: [] }] } } };
/** Cloudflare's own cap: 13 weeks 2 days. */
const CF_MAX_RANGE_DAYS = 93;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("incident-2026-10-19-dashboard-analytics-timeouts: Dashboard analytics — shared limit, one retry, Cloudflare range cap, deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    _clearVisitorsAnalyticsCacheForTests();
    _clearMapUsageAnalyticsCacheForTests();
  });

  test("both loaders keep <= 5 fetches in flight, retry a single PostHog 5xx, and keep every Cloudflare range <= 93 days (90d)", async () => {
    vi.stubEnv("CF_ANALYTICS_API_TOKEN", "cf-test");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "ph-test");

    let inFlight = 0;
    let peak = 0;
    let posthogCalls = 0;
    let posthogInFlight = 0;
    let posthogPeak = 0;
    const cfRangesDays: number[] = [];
    const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
      const isPosthog = url.includes("posthog");
      inFlight++;
      peak = Math.max(peak, inFlight);
      if (isPosthog) posthogPeak = Math.max(posthogPeak, ++posthogInFlight);
      // A real delay, so overlapping calls actually overlap.
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (isPosthog) posthogInFlight--;
      if (url.includes("cloudflare")) {
        const { since, until } = JSON.parse(String(init.body)).variables as { since: string; until: string };
        cfRangesDays.push((Date.parse(until) - Date.parse(since)) / MS_PER_DAY + 1);
        return new Response(JSON.stringify(CF_BODY), { status: 200 });
      }
      posthogCalls++;
      if (posthogCalls === 1) return new Response("upstream hiccup", { status: 502 });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);

    const now = new Date("2026-10-19T12:00:00Z");
    const limit = createFetchLimiter();
    const [visitors, mapUsage] = await Promise.all([
      loadVisitorsAnalytics("90d", now, limit),
      loadMapUsageAnalytics("90d", "630731", undefined, now, limit),
    ]);

    expect(visitors).not.toBeNull();
    expect(mapUsage).not.toBeNull();
    expect(peak).toBeLessThanOrEqual(5);
    // PostHog runs only 3 queries at once per project and queues the rest on its side.
    expect(posthogPeak).toBeLessThanOrEqual(3);
    expect(cfRangesDays.length).toBeGreaterThan(0);
    expect(Math.max(...cfRangesDays)).toBeLessThanOrEqual(CF_MAX_RANGE_DAYS);
    // 3 Cloudflare (current pageloads, previous pageloads, LCP) + 8 PostHog + 1 retry.
    expect(mockFetch).toHaveBeenCalledTimes(12);
  });

  test("a PostHog call that never answers -> null at the overall deadline, never hangs", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "ph-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );

    const pending = loadMapUsageAnalytics("7d", "630731", undefined, new Date("2026-10-19T12:00:00Z"));
    await vi.advanceTimersByTimeAsync(ANALYTICS_DEADLINE_MS);

    await expect(pending).resolves.toBeNull();
  });
});
