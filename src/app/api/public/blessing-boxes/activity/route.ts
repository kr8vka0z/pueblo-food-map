/**
 * GET /api/public/blessing-boxes/activity — the combined public activity
 * feed (Blessing Boxes slice 3, Discovery stories D1-D3): a single,
 * newest-first list mixing check-ins and box lifecycle events. Powers both
 * /boxes/activity (the global feed, D1/D2) and BoxContent's own per-box
 * "recent activity" panel (D3, `?box=<id>&limit=5`).
 *
 * Query params, all optional: `box` (a venue id), `kind` (one of
 * src/lib/boxActivity.ts's ACTIVITY_KINDS — an unrecognized value returns
 * an empty page rather than a 400, same "never error a public GET on bad
 * input" convention every other public route in this app follows), `from`/
 * `to` ('YYYY-MM-DD', both inclusive), `page` (1-based), `limit` (page
 * size — smaller for D3's embed than the global feed's default).
 *
 * Auth: none — same public-route convention as GET /api/public/blessing-
 * boxes (getCloudflareContext().env.ADMIN_DB read directly).
 *
 * Caching: same Workers Cache API (caches.default) pattern as the box list
 * endpoint, held at the edge for 60s. Cache matching is on the full request
 * URL (Cache API default), which already includes every filter's
 * querystring — so `?box=x` and `?box=y` naturally cache as separate
 * entries with no extra key-building code needed.
 *
 * Best-effort: a D1 failure degrades to an EMPTY page (never a 500) — same
 * resilience posture as every other public blessing-box read.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadBoxActivity, type ActivityFilters, type ActivityPage } from "@/lib/boxActivity";
import { logBlessingBoxesReadFailure } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 60;

function parseFilters(url: URL): ActivityFilters {
  const num = (v: string | null): number | undefined => {
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    venueId: url.searchParams.get("box") || undefined,
    kind: url.searchParams.get("kind") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    page: num(url.searchParams.get("page")),
    pageSize: num(url.searchParams.get("limit")),
  };
}

async function loadActivityBestEffort(filters: ActivityFilters): Promise<ActivityPage> {
  try {
    const { env } = getCloudflareContext();
    return await loadBoxActivity(env.ADMIN_DB, filters);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return { items: [], hasMore: false, page: 1 };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  // Same Workers-runtime caches.default pattern as
  // GET /api/public/blessing-boxes/route.ts — see that file's own header.
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(req.url, req);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const filters = parseFilters(new URL(req.url));
  const page = await loadActivityBestEffort(filters);
  const response = NextResponse.json(page, {
    headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
  });

  if (cache) {
    try {
      const { ctx } = getCloudflareContext();
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // No live ExecutionContext — caching is a performance nicety, never
      // required for this response to be correct.
    }
  }

  return response;
}
