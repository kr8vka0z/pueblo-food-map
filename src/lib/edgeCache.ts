/**
 * edgeCache.ts — shared Workers Cache API (caches.default) response helper
 * for the public blessing-box read routes (Blessing Boxes slices 1 + 3:
 * GET /api/public/blessing-boxes and GET /api/public/blessing-boxes/activity;
 * later the public events routes), plus serveFromEdgeCache, the lower-level
 * match/build/put step those share with the binary photo serve route
 * (GET /api/public/box-photos/[id]).
 *
 * Extracted after a real shared bug, found in PR #472 review: both routes'
 * own best-effort load() functions degrade a D1 failure to an empty 200 (so
 * a database blip never breaks the page) — but the routes were then
 * unconditionally cache.put()-ing that response for 60s, which meant a
 * MOMENTARY database blip blanked the public map / activity feed for up to
 * a minute AFTER the database was healthy again. One helper, one fix: a
 * caller's load() reports whether its result is a degraded fallback, and
 * this helper skips the cache.put() (never the response itself, which is
 * always returned) whenever it is.
 *
 * PER-COLO CACHE: `caches.default` is per Cloudflare data center (colo), not
 * zone-wide, and a Worker has no zone-wide purge API without an
 * account-scoped token this app doesn't use elsewhere. So bustEdgeCache()
 * below can only delete the entry in the colo that handled the write; every
 * other colo keeps serving its copy until the 60s CACHE_TTL_SECONDS (or the
 * route's own Cache-Control) expires. That TTL, not the purge, is the real
 * freshness bound across colos.
 */

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";

const CACHE_TTL_SECONDS = 60;

/** A best-effort load's result plus whether it's a genuine value or a degraded (error) fallback. */
export interface BestEffortResult<T> {
  data: T;
  /** true when `data` is a fallback produced after a read failure — never cache this. */
  degraded: boolean;
  /** HTTP status to answer with; default 200. Anything but 200 is never cached (a 404 for an id that is published a minute later must not stick). */
  status?: number;
}

/**
 * The Workers-runtime `caches.default`, or undefined where it doesn't exist.
 * It is a Workers extension to the standard CacheStorage interface — absent
 * in vitest/node, so route tests stub it; every caller treats undefined as
 * "always compute fresh" rather than throwing.
 */
export function edgeCacheDefault(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

/**
 * The one match -> build -> put sequence every edge-cached route shares.
 * Returns a cache hit as-is (build never runs). Otherwise runs `build()` and
 * returns its response, storing it for the next request ONLY when it is a
 * 200 and not `degraded` — a degraded fallback or a non-200 (a 404 for an id
 * published a minute later) must never stick in the cache. The put goes
 * through ctx.waitUntil so it never delays the response; without a live
 * ExecutionContext it is skipped, since caching is a performance nicety,
 * never required for the response to be correct.
 */
export async function serveFromEdgeCache(
  cacheKey: Request,
  build: () => Promise<{ response: Response; degraded?: boolean }>,
): Promise<Response> {
  const cache = edgeCacheDefault();
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const { response, degraded = false } = await build();

  if (cache && !degraded && response.status === 200) {
    try {
      const { ctx } = getCloudflareContext();
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // No live ExecutionContext (e.g. running outside a real Worker request).
    }
  }

  return response;
}

/**
 * Deletes one or more Cloudflare Workers-edge cache entries for the CURRENT
 * colo only (`caches.default` is per-colo, not zone-wide — see
 * this file's header) — best-effort, a delete failure must
 * never fail the write that triggered it.
 *
 * Slice 5 (photos) made this a shared helper, because a check-in or needs
 * write busts only the box list, but a photo's moderation decision
 * (approve/reject/flag) needs to bust TWO cache entries: the box list
 * (`/api/public/blessing-boxes`, whose response embeds `latestPhoto`) and
 * the photo's own serve route (`/api/public/box-photos/<id>`) — a flagged
 * photo must actually stop being servable, not just drop off the list. One
 * shared function means that "bust every affected cache key" rule lives in exactly
 * one place rather than being re-derived per caller.
 */
export async function bustEdgeCache(req: Request, paths: readonly string[]): Promise<void> {
  const cache = edgeCacheDefault();
  if (!cache) return;
  await Promise.all(
    paths.map(async (path) => {
      try {
        await cache.delete(new Request(new URL(path, req.url)));
      } catch {
        // best-effort only — the 60s TTL is the real freshness bound either way
      }
    }),
  );
}

export interface EdgeCacheOptions {
  /**
   * Key the cache entry on the URL WITHOUT its query string. Only the public
   * events routes turn this on (#759): their purge deletes the bare path, so
   * a `?x=N` variant keyed on the full URL would hold a stale 200 the purge
   * can never reach. The blessing-box routes keep the full-URL key.
   */
  ignoreQuery?: boolean;
}

/**
 * Serves a GET request from the Workers edge cache when possible, otherwise
 * runs `load()`, returns its data as JSON with a 60s Cache-Control header,
 * and — ONLY when the load was not degraded and is a 200 — stores that
 * response in the cache for the next request (serveFromEdgeCache). Mirrors
 * the caches.default pattern both public blessing-box routes established
 * (see each route's own file header for the wider Cache API rationale).
 */
export async function respondWithEdgeCache<T>(
  req: Request,
  load: () => Promise<BestEffortResult<T>>,
  { ignoreQuery = false }: EdgeCacheOptions = {},
): Promise<Response> {
  const { origin, pathname } = new URL(req.url);
  const cacheKey = new Request(ignoreQuery ? origin + pathname : req.url, req);

  return serveFromEdgeCache(cacheKey, async () => {
    const { data, degraded, status = 200 } = await load();
    const response = NextResponse.json(data, {
      status,
      // A non-200 (404 for a not-yet-published event, or a degraded read) must
      // not sit in a browser cache for a minute: the admin purge can't reach
      // it, so a link shared just before publishing would look dead.
      headers: { "Cache-Control": status === 200 ? `public, max-age=${CACHE_TTL_SECONDS}` : "no-store" },
    });
    return { response, degraded };
  });
}
