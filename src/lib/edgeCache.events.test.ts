// @vitest-environment node
/**
 * edgeCache.events.test.ts — the two options only the public events routes use
 * (#759): a non-200 is sent `no-store`, and `ignoreQuery` keys the entry on the
 * bare path so the admin purge (which deletes the bare path) always clears it.
 * An in-memory Cache stands in for caches.default.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bustEdgeCache, respondWithEdgeCache } from "@/lib/edgeCache";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ ctx: { waitUntil: (p: Promise<unknown>) => p } }),
}));

const originalCaches = (globalThis as { caches?: unknown }).caches;
let store: Map<string, Response>;

beforeEach(() => {
  store = new Map();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (req: Request) => store.get(req.url)?.clone(),
      put: async (req: Request, res: Response) => void store.set(req.url, res),
      delete: async (req: Request) => store.delete(req.url),
    },
  };
});
afterEach(() => {
  (globalThis as { caches?: unknown }).caches = originalCaches;
});

const at = (path: string) => new Request(`https://pueblofoodmap.com${path}`);

describe("non-200 responses", () => {
  test("a 404 (including a degraded one) is no-store; a 200 keeps the 60s header", async () => {
    const notFound = await respondWithEdgeCache(at("/api/public/events/x"), async () => ({ data: { event: null }, degraded: false, status: 404 }));
    const degraded = await respondWithEdgeCache(at("/api/public/events/x"), async () => ({ data: { event: null }, degraded: true, status: 404 }));
    const ok = await respondWithEdgeCache(at("/api/public/events/x"), async () => ({ data: { event: {} }, degraded: false }));

    expect(notFound.headers.get("Cache-Control")).toBe("no-store");
    expect(degraded.headers.get("Cache-Control")).toBe("no-store");
    expect(ok.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});

describe("ignoreQuery", () => {
  test("a request with a query string is stored under, and served from, the bare-path key, and the purge clears it", async () => {
    const load = vi.fn(async () => ({ data: { events: [1] }, degraded: false }));

    await respondWithEdgeCache(at("/api/public/events?x=1"), load, { ignoreQuery: true });
    expect([...store.keys()]).toEqual(["https://pueblofoodmap.com/api/public/events"]);

    // A different query variant is a hit on the same entry.
    await respondWithEdgeCache(at("/api/public/events?x=2"), load, { ignoreQuery: true });
    expect(load).toHaveBeenCalledTimes(1);

    await bustEdgeCache(at("/anything"), ["/api/public/events"]);
    expect(store.size).toBe(0);
  });

  test("without the option the full URL stays the key (blessing-box routes unchanged)", async () => {
    await respondWithEdgeCache(at("/api/public/blessing-boxes?x=1"), async () => ({ data: {}, degraded: false }));

    expect([...store.keys()]).toEqual(["https://pueblofoodmap.com/api/public/blessing-boxes?x=1"]);
  });
});
