// @vitest-environment node
/**
 * Route-level tests for GET /api/public/blessing-boxes (Blessing Boxes
 * slice 1).
 *
 * Mocks @opennextjs/cloudflare's getCloudflareContext (same pattern as
 * src/app/api/admin/venues/route.test.ts) and src/lib/blessingBoxes'
 * loadLiveBoxes, then stubs globalThis.caches (absent in vitest/node —
 * route.ts's own header notes this) to prove both the cache-miss-then-put
 * and cache-hit paths, plus the one privacy-load-bearing assertion: the
 * JSON response never contains host_contact, even indirectly.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockLoadLiveBoxes = vi.fn();
vi.mock("@/lib/blessingBoxes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/blessingBoxes")>("@/lib/blessingBoxes");
  return { ...actual, loadLiveBoxes: (...args: unknown[]) => mockLoadLiveBoxes(...args) };
});

import { GET } from "@/app/api/public/blessing-boxes/route";

function makeBox(overrides: Partial<PublicBlessingBox> = {}): PublicBlessingBox {
  return {
    id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    name: "216 W Routt Blessing Box",
    category: "blessing_box",
    lat: 38.25902,
    lng: -104.625612,
    address: "216 W Routt Ave, Pueblo, CO 81004",
    source: "directory.plentiful.org/colorado/pueblo",
    last_verified: "2026-09-15",
    box: {
      hostName: "Jane Doe",
      hostNote: "Stocked every Saturday.",
      mostNeeded: "Canned soup",
      installedOn: "2026-01-15",
      removedOn: null,
      status: "unknown",
      lastFilledAt: null,
      recentCheckins: [],
      latestPhoto: null,
    },
    ...overrides,
  };
}

function makeRequest(): NextRequest {
  return new NextRequest("https://pueblofoodmap.com/api/public/blessing-boxes");
}

describe("GET /api/public/blessing-boxes", () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockLoadLiveBoxes.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} }, ctx: { waitUntil: vi.fn() } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    (globalThis as { caches?: unknown }).caches = originalCaches;
  });

  test("no caches global (e.g. plain node) -> still returns the boxes, degrades to always-compute", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    mockLoadLiveBoxes.mockResolvedValue([makeBox()]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { boxes: PublicBlessingBox[] };
    expect(data.boxes).toHaveLength(1);
    expect(data.boxes[0].id).toBe("plentiful-blessing-box-216-w-routt-plentiful-1454");
  });

  // The route trusts loadLiveBoxes' own contract for what's public — that
  // contract (host_contact is never selected/mapped) is proved directly
  // against the real mapper in src/lib/blessingBoxes.test.ts. This test only
  // proves the route serializes whatever loadLiveBoxes hands it, without
  // adding or dropping fields of its own.
  test("serializes exactly what loadLiveBoxes returns, field for field", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    const box = makeBox();
    mockLoadLiveBoxes.mockResolvedValue([box]);

    const res = await GET(makeRequest());
    const data = (await res.json()) as { boxes: PublicBlessingBox[] };
    expect(data.boxes).toEqual([box]);
  });

  test("D1 read failure (getCloudflareContext throws) -> 200 with an empty boxes array, never 500s", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { boxes: PublicBlessingBox[] };
    expect(data.boxes).toEqual([]);
  });

  test("cache hit -> returns the cached response, never calls loadLiveBoxes", async () => {
    const cachedResponse = new Response(JSON.stringify({ boxes: [makeBox({ id: "cached" })] }), {
      headers: { "Content-Type": "application/json" },
    });
    const match = vi.fn().mockResolvedValue(cachedResponse);
    const put = vi.fn();
    (globalThis as { caches?: CacheStorage }).caches = {
      default: { match, put } as unknown as Cache,
    } as unknown as CacheStorage;

    const res = await GET(makeRequest());
    const data = (await res.json()) as { boxes: PublicBlessingBox[] };
    expect(data.boxes[0].id).toBe("cached");
    expect(match).toHaveBeenCalledTimes(1);
    expect(mockLoadLiveBoxes).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test("cache miss -> computes fresh, then puts the response into the cache via ctx.waitUntil", async () => {
    const match = vi.fn().mockResolvedValue(undefined);
    const put = vi.fn().mockResolvedValue(undefined);
    (globalThis as { caches?: CacheStorage }).caches = {
      default: { match, put } as unknown as Cache,
    } as unknown as CacheStorage;
    const waitUntil = vi.fn((p: Promise<unknown>) => p);
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} }, ctx: { waitUntil } });
    mockLoadLiveBoxes.mockResolvedValue([makeBox()]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(match).toHaveBeenCalledTimes(1);
    expect(mockLoadLiveBoxes).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
  });

  test("response carries a 60s Cache-Control header", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    mockLoadLiveBoxes.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
