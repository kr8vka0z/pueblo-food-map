// @vitest-environment node
/**
 * Route-level tests for GET /api/public/blessing-boxes/activity (Blessing
 * Boxes slice 3). Mirrors
 * src/app/api/public/blessing-boxes/route.test.ts's structure (same
 * getCloudflareContext mock + caches.default stub pattern) — this file adds
 * the query-param parsing and the D1-failure-degrades-to-empty-page case.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ActivityPage } from "@/lib/boxActivity";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockLoadBoxActivity = vi.fn();
vi.mock("@/lib/boxActivity", async () => {
  const actual = await vi.importActual<typeof import("@/lib/boxActivity")>("@/lib/boxActivity");
  return { ...actual, loadBoxActivity: (...args: unknown[]) => mockLoadBoxActivity(...args) };
});

import { GET } from "@/app/api/public/blessing-boxes/activity/route";

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/activity${query}`);
}

const emptyPage: ActivityPage = { items: [], hasMore: false, page: 1 };

describe("GET /api/public/blessing-boxes/activity", () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockLoadBoxActivity.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} }, ctx: { waitUntil: vi.fn() } });
    delete (globalThis as { caches?: unknown }).caches;
  });

  afterEach(() => {
    vi.clearAllMocks();
    (globalThis as { caches?: unknown }).caches = originalCaches;
  });

  test("no filters -> loadBoxActivity called with an all-undefined filters object", async () => {
    mockLoadBoxActivity.mockResolvedValue(emptyPage);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockLoadBoxActivity).toHaveBeenCalledWith(
      {},
      { venueId: undefined, kind: undefined, from: undefined, to: undefined, page: undefined, pageSize: undefined },
    );
  });

  test("query params are parsed through to loadBoxActivity's filters", async () => {
    mockLoadBoxActivity.mockResolvedValue(emptyPage);
    await GET(makeRequest("?box=box-1&kind=filled&from=2026-09-01&to=2026-09-05&page=2&limit=5"));
    expect(mockLoadBoxActivity).toHaveBeenCalledWith(
      {},
      { venueId: "box-1", kind: "filled", from: "2026-09-01", to: "2026-09-05", page: 2, pageSize: 5 },
    );
  });

  test("non-numeric page/limit are dropped (undefined), never crash the route", async () => {
    mockLoadBoxActivity.mockResolvedValue(emptyPage);
    const res = await GET(makeRequest("?page=abc&limit=xyz"));
    expect(res.status).toBe(200);
    const call = mockLoadBoxActivity.mock.calls[0][1] as { page?: number; pageSize?: number };
    expect(call.page).toBeUndefined();
    expect(call.pageSize).toBeUndefined();
  });

  test("serializes exactly what loadBoxActivity returns", async () => {
    const page: ActivityPage = {
      items: [
        {
          source: "checkin",
          kind: "filled",
          detail: null,
          createdAt: "2026-09-17T12:00:00.000Z",
          venueId: "box-1",
          venueName: "216 W Routt",
          venueAddress: "216 W Routt Ave",
        },
      ],
      hasMore: true,
      page: 1,
    };
    mockLoadBoxActivity.mockResolvedValue(page);
    const res = await GET(makeRequest());
    const data = (await res.json()) as ActivityPage;
    expect(data).toEqual(page);
  });

  test("D1 read failure (getCloudflareContext throws) -> 200 with an empty page, never 500s", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as ActivityPage;
    expect(data).toEqual({ items: [], hasMore: false, page: 1 });
  });

  test("loadBoxActivity itself throwing -> 200 with an empty page", async () => {
    mockLoadBoxActivity.mockRejectedValue(new Error("d1 boom"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as ActivityPage;
    expect(data).toEqual({ items: [], hasMore: false, page: 1 });
  });

  test("response carries a 60s Cache-Control header", async () => {
    mockLoadBoxActivity.mockResolvedValue(emptyPage);
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  test("cache hit -> returns the cached response, never calls loadBoxActivity", async () => {
    const cachedResponse = new Response(JSON.stringify({ items: [], hasMore: false, page: 1 }), {
      headers: { "Content-Type": "application/json" },
    });
    const match = vi.fn().mockResolvedValue(cachedResponse);
    const put = vi.fn();
    (globalThis as { caches?: CacheStorage }).caches = { default: { match, put } as unknown as Cache } as unknown as CacheStorage;

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(match).toHaveBeenCalledTimes(1);
    expect(mockLoadBoxActivity).not.toHaveBeenCalled();
  });
});
