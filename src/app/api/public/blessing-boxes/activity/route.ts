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
 * endpoint, held at the edge for 60s, via the shared respondWithEdgeCache()
 * helper (src/lib/edgeCache.ts) — see that file's header for why the
 * cache.put()/cache.match() logic is shared rather than duplicated: a
 * degraded (D1-failure) load must never be cached, in either route. Cache
 * matching is on the full request URL (Cache API default), which already
 * includes every filter's querystring — so `?box=x` and `?box=y` naturally
 * cache as separate entries with no extra key-building code needed.
 *
 * Best-effort: a D1 failure degrades to an EMPTY page (never a 500) — same
 * resilience posture as every other public blessing-box read.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadBoxActivity, type ActivityFilters, type ActivityPage } from "@/lib/boxActivity";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import { respondWithEdgeCache, type BestEffortResult } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

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

async function loadActivityBestEffort(filters: ActivityFilters): Promise<BestEffortResult<ActivityPage>> {
  try {
    const { env } = getCloudflareContext();
    const page = await loadBoxActivity(env.ADMIN_DB, filters);
    return { data: page, degraded: false };
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    // `degraded: true` tells respondWithEdgeCache() to never cache this
    // fallback — see edgeCache.ts's own header.
    return { data: { items: [], hasMore: false, page: 1 }, degraded: true };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const filters = parseFilters(new URL(req.url));
  return respondWithEdgeCache(req, () => loadActivityBestEffort(filters));
}
