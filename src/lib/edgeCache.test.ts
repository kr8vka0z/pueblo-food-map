// @vitest-environment node
/**
 * edgeCache.test.ts — proves the one contract respondWithEdgeCache() exists
 * to enforce (PR #472 review, item 1): a degraded (best-effort-failed) load
 * must still return its fallback data as a normal 200, but must NEVER be
 * written into the Workers edge cache — otherwise a momentary D1 blip gets
 * cached and blanks the public page for up to 60s after the database is
 * healthy again.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { respondWithEdgeCache } from "@/lib/edgeCache";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

function makeRequest(): Request {
  return new Request("https://pueblofoodmap.com/api/public/blessing-boxes");
}

function stubCache() {
  const match = vi.fn().mockResolvedValue(undefined);
  const put = vi.fn().mockResolvedValue(undefined);
  (globalThis as { caches?: CacheStorage }).caches = {
    default: { match, put } as unknown as Cache,
  } as unknown as CacheStorage;
  return { match, put };
}

describe("respondWithEdgeCache", () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockReturnValue({ ctx: { waitUntil: vi.fn((p: Promise<unknown>) => p) } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    (globalThis as { caches?: unknown }).caches = originalCaches;
  });

  test("a degraded load returns its fallback data as a normal 200", async () => {
    const { put } = stubCache();
    const res = await respondWithEdgeCache(makeRequest(), async () => ({
      data: { boxes: [] },
      degraded: true,
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ boxes: [] });
    expect(put).not.toHaveBeenCalled();
  });

  test("a degraded load must NOT call cache.put", async () => {
    const { put } = stubCache();
    await respondWithEdgeCache(makeRequest(), async () => ({ data: { boxes: [] }, degraded: true }));
    expect(put).not.toHaveBeenCalled();
  });

  test("a healthy load MUST call cache.put", async () => {
    const { put } = stubCache();
    await respondWithEdgeCache(makeRequest(), async () => ({
      data: { boxes: [{ id: "box-1" }] },
      degraded: false,
    }));
    expect(put).toHaveBeenCalledTimes(1);
  });

  test("cache hit returns the cached response without ever calling load()", async () => {
    const cachedResponse = new Response(JSON.stringify({ boxes: [{ id: "cached" }] }), {
      headers: { "Content-Type": "application/json" },
    });
    const match = vi.fn().mockResolvedValue(cachedResponse);
    const put = vi.fn();
    (globalThis as { caches?: CacheStorage }).caches = {
      default: { match, put } as unknown as Cache,
    } as unknown as CacheStorage;

    const load = vi.fn();
    const res = await respondWithEdgeCache(makeRequest(), load);
    expect(await res.json()).toEqual({ boxes: [{ id: "cached" }] });
    expect(load).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test("no caches global (e.g. plain node) -> still returns data, never throws", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    const res = await respondWithEdgeCache(makeRequest(), async () => ({
      data: { boxes: [] },
      degraded: false,
    }));
    expect(res.status).toBe(200);
  });

  test("response carries a 60s Cache-Control header regardless of degraded state", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    const res = await respondWithEdgeCache(makeRequest(), async () => ({ data: {}, degraded: true }));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
