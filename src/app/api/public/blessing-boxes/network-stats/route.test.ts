// @vitest-environment node
/**
 * Route-level tests for GET /api/public/blessing-boxes/network-stats
 * (Blessing Boxes slice 7). Mirrors
 * src/app/api/public/blessing-boxes/activity/route.test.ts's structure —
 * same getCloudflareContext mock + caches.default stub pattern.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NetworkStatsData } from "@/lib/boxStats";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockLoadNetworkStatsData = vi.fn();
vi.mock("@/lib/boxStats", async () => {
  const actual = await vi.importActual<typeof import("@/lib/boxStats")>("@/lib/boxStats");
  return { ...actual, loadNetworkStatsData: (...args: unknown[]) => mockLoadNetworkStatsData(...args) };
});

import { GET } from "@/app/api/public/blessing-boxes/network-stats/route";

function makeRequest(): NextRequest {
  return new NextRequest("https://pueblofoodmap.com/api/public/blessing-boxes/network-stats");
}

const emptyData: NetworkStatsData = { boxes: [], checkins: [], photos: [] };

describe("GET /api/public/blessing-boxes/network-stats", () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockLoadNetworkStatsData.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} }, ctx: { waitUntil: vi.fn() } });
    delete (globalThis as { caches?: unknown }).caches;
  });

  afterEach(() => {
    vi.clearAllMocks();
    (globalThis as { caches?: unknown }).caches = originalCaches;
  });

  test("serializes exactly what loadNetworkStatsData returns", async () => {
    const data: NetworkStatsData = {
      boxes: [{ id: "box-1", name: "216 W Routt", archived: false }],
      checkins: [{ venue_id: "box-1", kind: "filled", visibility: "visible", created_at: "2026-09-17T12:00:00.000Z" }],
      photos: [{ venue_id: "box-1", created_at: "2026-09-17T12:00:00.000Z" }],
    };
    mockLoadNetworkStatsData.mockResolvedValue(data);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(data);
  });

  test("D1 read failure (getCloudflareContext throws) -> 200 with empty data, never 500s", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(emptyData);
  });

  test("loadNetworkStatsData itself throwing -> 200 with empty data", async () => {
    mockLoadNetworkStatsData.mockRejectedValue(new Error("d1 boom"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(emptyData);
  });

  test("response carries a 60s Cache-Control header", async () => {
    mockLoadNetworkStatsData.mockResolvedValue(emptyData);
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  test("cache hit -> returns the cached response, never calls loadNetworkStatsData", async () => {
    const cachedResponse = new Response(JSON.stringify(emptyData), {
      headers: { "Content-Type": "application/json" },
    });
    const match = vi.fn().mockResolvedValue(cachedResponse);
    const put = vi.fn();
    (globalThis as { caches?: CacheStorage }).caches = { default: { match, put } as unknown as Cache } as unknown as CacheStorage;

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(match).toHaveBeenCalledTimes(1);
    expect(mockLoadNetworkStatsData).not.toHaveBeenCalled();
  });
});
