// @vitest-environment node
/**
 * Route-level tests for GET /api/public/box-photos/[id] (Blessing Boxes
 * slice 5) — proves the one load-bearing rule: only an APPROVED photo's
 * bytes are ever served, and a 404 is never cached.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { GET } from "@/app/api/public/box-photos/[id]/route";

const PHOTO_ID = 42;
const URL = `https://pueblofoodmap.com/api/public/box-photos/${PHOTO_ID}`;

function makeDb(row: { r2_key: string } | null) {
  return {
    prepare: () => ({ bind: () => ({ first: async () => row }) }),
  } as unknown as D1Database;
}

function makeBucket(objectBytes: Uint8Array | null) {
  const get = vi.fn().mockResolvedValue(objectBytes ? { arrayBuffer: async () => objectBytes.buffer } : null);
  return { get, bucket: { get } as unknown as R2Bucket };
}

function callGet(id: string = String(PHOTO_ID)) {
  return GET(new NextRequest(URL), { params: Promise.resolve({ id }) });
}

describe("GET /api/public/box-photos/[id]", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    delete (globalThis as { caches?: unknown }).caches;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { caches?: unknown }).caches;
  });

  test("non-numeric id -> 404, never touches D1/R2", async () => {
    const res = await callGet("not-a-number");
    expect(res.status).toBe(404);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("no matching approved row -> 404", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeDb(null), BOX_PHOTOS: {} } });
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  test("row exists but the R2 object is missing -> 404, not a crash", async () => {
    const { bucket } = makeBucket(null);
    mockGetCloudflareContext.mockReturnValue({
      env: { ADMIN_DB: makeDb({ r2_key: "box-photos/a/x.jpg" }), BOX_PHOTOS: bucket },
    });
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  test("success: streams the JPEG bytes with a 1-hour Cache-Control, not immutable/1-year", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { bucket, get } = makeBucket(bytes);
    mockGetCloudflareContext.mockReturnValue({
      env: { ADMIN_DB: makeDb({ r2_key: "box-photos/a/x.jpg" }), BOX_PHOTOS: bucket },
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(get).toHaveBeenCalledWith("box-photos/a/x.jpg");
  });

  test("D1 read failure -> 404, degrades rather than 500s", async () => {
    const db = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error("boom"); } }) }) } as unknown as D1Database;
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db, BOX_PHOTOS: {} } });
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  test("no Cloudflare context available -> 404, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await callGet();
    expect(res.status).toBe(404);
  });

  test("a cache hit is served without ever touching D1/R2", async () => {
    const cachedResponse = new Response(new Uint8Array([9, 9]), { status: 200 });
    const match = vi.fn().mockResolvedValue(cachedResponse);
    (globalThis as { caches?: CacheStorage }).caches = { default: { match } as unknown as Cache } as unknown as CacheStorage;
    const res = await callGet();
    expect(res).toBe(cachedResponse);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("a successful response is cached via ctx.waitUntil(cache.put(...))", async () => {
    const bytes = new Uint8Array([1]);
    const { bucket } = makeBucket(bytes);
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn().mockResolvedValue(undefined);
    (globalThis as { caches?: CacheStorage }).caches = { default: { match, put } as unknown as Cache } as unknown as CacheStorage;
    const waitUntil = vi.fn((p: Promise<unknown>) => p);
    mockGetCloudflareContext.mockReturnValue({
      env: { ADMIN_DB: makeDb({ r2_key: "box-photos/a/x.jpg" }), BOX_PHOTOS: bucket },
      ctx: { waitUntil },
    });
    await callGet();
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  test("a 404 is never written into the cache", async () => {
    const put = vi.fn();
    const match = vi.fn().mockResolvedValue(undefined);
    (globalThis as { caches?: CacheStorage }).caches = { default: { match, put } as unknown as Cache } as unknown as CacheStorage;
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeDb(null), BOX_PHOTOS: {} } });
    await callGet();
    expect(put).not.toHaveBeenCalled();
  });
});
