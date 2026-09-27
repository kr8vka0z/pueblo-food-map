/**
 * cfAnalytics.test.ts — buildVisitorsAnalytics (pure mapping) plus
 * loadVisitorsAnalytics' failure-fallback branches (#680's own "Tests:
 * cfAnalytics response mapping + failure fallback"). The live GraphQL shape
 * itself was verified by hand against Cloudflare's real schema/API
 * (2026-09-26, see cfAnalytics.ts's own header) — these fixtures mirror
 * that verified shape, not a guess.
 */

import { afterEach, describe, expect, test, vi } from "vitest";

const mockGetCloudflareContext = vi.fn(async () => ({ env: { CF_ANALYTICS_ACCOUNT_ID: "acct123" } }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => mockGetCloudflareContext(),
}));

import { buildVisitorsAnalytics, loadVisitorsAnalytics, _clearVisitorsAnalyticsCacheForTests } from "@/lib/cfAnalytics";

function row(date: string, deviceType: string, refererHost: string, count: number, visits: number) {
  return { count, sum: { visits }, dimensions: { date, deviceType, refererHost } };
}

describe("buildVisitorsAnalytics", () => {
  test("splits current vs previous period on the boundary date, sums visits/pageviews", () => {
    const rows = [
      row("2026-09-10", "desktop", "", 5, 5), // previous period
      row("2026-09-20", "mobile", "", 10, 10), // current
      row("2026-09-20", "desktop", "google.com", 5, 5), // current
      row("2026-09-20", "mobile", "pueblofoodmap.com", 3, 0), // current, same-site nav: 0 visits
    ];
    const result = buildVisitorsAnalytics(rows, "2026-09-15", null);
    expect(result.previousVisits).toBe(5);
    expect(result.previousPageviews).toBe(5);
    expect(result.visits).toBe(15); // 10 + 5 + 0
    expect(result.pageviews).toBe(18); // 10 + 5 + 3
  });

  test("phone share % divides mobile pageviews by total pageviews, one decimal", () => {
    const rows = [row("2026-09-20", "mobile", "", 3, 3), row("2026-09-20", "desktop", "", 1, 1)];
    const result = buildVisitorsAnalytics(rows, "2026-09-15", null);
    expect(result.phoneSharePct).toBe(75);
  });

  test("zero page views this period -> phoneSharePct is null, never NaN or Infinity", () => {
    const result = buildVisitorsAnalytics([], "2026-09-15", null);
    expect(result.phoneSharePct).toBeNull();
    expect(result.visits).toBe(0);
  });

  test("empty refererHost groups under 'Direct / bookmark'; groups sorted by visits desc", () => {
    const rows = [
      row("2026-09-20", "desktop", "", 2, 2),
      row("2026-09-20", "desktop", "google.com", 5, 5),
      row("2026-09-20", "desktop", "m.facebook.com", 1, 1),
    ];
    const result = buildVisitorsAnalytics(rows, "2026-09-15", null);
    expect(result.referrers).toEqual([
      { label: "google.com", visits: 5 },
      { label: "Direct / bookmark", visits: 2 },
      { label: "m.facebook.com", visits: 1 },
    ]);
  });

  test("a same-site-only referrer (0 visits) is dropped from the referrer list entirely", () => {
    const rows = [row("2026-09-20", "mobile", "pueblofoodmap.com", 4, 0)];
    const result = buildVisitorsAnalytics(rows, "2026-09-15", null);
    expect(result.referrers).toEqual([]);
  });

  test("dailyVisitors sums same-date rows across device types, oldest first", () => {
    const rows = [
      row("2026-09-21", "desktop", "", 1, 1),
      row("2026-09-20", "mobile", "", 2, 2),
      row("2026-09-20", "desktop", "", 3, 3),
    ];
    const result = buildVisitorsAnalytics(rows, "2026-09-15", null);
    expect(result.dailyVisitors).toEqual([
      { date: "2026-09-20", visits: 5 },
      { date: "2026-09-21", visits: 1 },
    ]);
  });

  test("passes phoneLcpMs through untouched (the caller already normalized Cloudflare's -1 sentinel)", () => {
    expect(buildVisitorsAnalytics([], "2026-09-15", 1800).phoneLcpMs).toBe(1800);
    expect(buildVisitorsAnalytics([], "2026-09-15", null).phoneLcpMs).toBeNull();
  });
});

describe("loadVisitorsAnalytics — failure fallback", () => {
  const originalToken = process.env.CF_ANALYTICS_API_TOKEN;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    _clearVisitorsAnalyticsCacheForTests();
    if (originalToken === undefined) delete process.env.CF_ANALYTICS_API_TOKEN;
    else process.env.CF_ANALYTICS_API_TOKEN = originalToken;
  });

  test("no token -> null, no fetch attempted", async () => {
    delete process.env.CF_ANALYTICS_API_TOKEN;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const result = await loadVisitorsAnalytics("30d");

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("token present, Cloudflare call fails -> null, never throws", async () => {
    process.env.CF_ANALYTICS_API_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    const result = await loadVisitorsAnalytics("30d");

    expect(result).toBeNull();
  });
});
