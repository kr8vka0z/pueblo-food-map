/**
 * edgeCache.ts — shared Workers Cache API (caches.default) response helper
 * for the public blessing-box read routes (Blessing Boxes slices 1 + 3:
 * GET /api/public/blessing-boxes and GET /api/public/blessing-boxes/activity).
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
 */

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const CACHE_TTL_SECONDS = 60;

/** A best-effort load's result plus whether it's a genuine value or a degraded (error) fallback. */
export interface BestEffortResult<T> {
  data: T;
  /** true when `data` is a fallback produced after a read failure — never cache this. */
  degraded: boolean;
}

/**
 * Serves a GET request from the Workers edge cache when possible, otherwise
 * runs `load()`, returns its data as JSON with a 60s Cache-Control header,
 * and — ONLY when the load was not degraded — stores that response in the
 * cache for the next request. Mirrors the caches.default pattern both
 * public blessing-box routes established (see each route's own file header
 * for the wider Cache API rationale); this file is just the ONE place that
 * pattern now lives, so a future fix to it only has to happen once.
 */
/**
 * Deletes one or more Cloudflare Workers-edge cache entries for the CURRENT
 * colo only (`caches.default` is per-colo, not zone-wide — see
 * respondWithEdgeCache's own header) — best-effort, a delete failure must
 * never fail the write that triggered it.
 *
 * Slice 5 (photos) generalizes the checkins route's own single-path
 * `bustListCache` into this shared helper, because a photo's moderation
 * decision (approve/reject/flag) now needs to bust THREE cache entries, not
 * one: the box list (`/api/public/blessing-boxes`, whose response embeds
 * `latestPhoto`), that box's photo history list
 * (`/api/public/blessing-boxes/<id>/photos`), and the photo's own serve
 * route (`/api/public/box-photos/<id>`) — a flagged photo must actually
 * stop being servable, not just drop off the two list views. One shared
 * function means that "bust every affected cache key" rule lives in exactly
 * one place rather than being re-derived per caller.
 */
export async function bustEdgeCache(req: Request, paths: readonly string[]): Promise<void> {
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
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

export async function respondWithEdgeCache<T>(
  req: Request,
  load: () => Promise<BestEffortResult<T>>,
): Promise<Response> {
  // caches.default is a Workers-runtime extension to the standard
  // CacheStorage interface — absent in vitest/node, so route tests stub it;
  // absent here degrades to "always compute fresh" rather than throwing.
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(req.url, req);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const { data, degraded } = await load();
  const response = NextResponse.json(data, {
    headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
  });

  if (cache && !degraded) {
    try {
      const { ctx } = getCloudflareContext();
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // No live ExecutionContext (e.g. running outside a real Worker
      // request) — caching is a performance nicety, never required for
      // this response to be correct.
    }
  }

  return response;
}
