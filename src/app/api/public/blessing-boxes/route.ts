/**
 * GET /api/public/blessing-boxes — the live box layer's one read endpoint
 * (Blessing Boxes Build Plan, architecture call #1: "boxes are live, not
 * published").
 *
 * Returns every non-archived blessing_box venue, joined with its
 * blessing_boxes row, in the PublicBlessingBox shape (src/lib/blessingBoxes.ts)
 * — `host_contact` is never selected, so there's nothing to accidentally leak.
 *
 * Auth: none — same public-route convention as /suggest/submit and
 * /report/submit (getCloudflareContext().env.ADMIN_DB read directly, never
 * getAdminDb(), which exists specifically for AUTHENTICATED /admin/** routes).
 *
 * Caching: held at the Cloudflare edge for 60s via the Workers Cache API
 * (caches.default) — a bare Cache-Control response header does nothing on a
 * Worker response (it's advisory to the BROWSER, not Cloudflare's edge); the
 * cache.put()/cache.match() pair below is what actually holds the response
 * at the edge, matching the build plan's "held at the edge ~60 seconds" line.
 * This repo had no prior Cache API example to follow — built directly from
 * Cloudflare's documented caches.default pattern.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadLiveBoxes, type PublicBlessingBox } from "@/lib/blessingBoxes";
import { logBlessingBoxesReadFailure } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 60;

async function loadBoxesBestEffort(): Promise<PublicBlessingBox[]> {
  try {
    const { env } = getCloudflareContext();
    return await loadLiveBoxes(env.ADMIN_DB);
  } catch (err) {
    // Best-effort, never blocking (same convention as public_submissions'
    // insert path, src/lib/publicSubmissions.ts): a D1 blip degrades the
    // live layer to "no boxes this request" rather than 500ing the map.
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return [];
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  // caches.default is a Workers-runtime extension to the standard
  // CacheStorage interface (lib.dom's own CacheStorage type has no `default`
  // member, hence the narrower local cast below) — absent in vitest/jsdom,
  // so route.test.ts stubs it. Not present at all (e.g. an unexpected local
  // runtime) degrades to "always compute fresh" rather than throwing.
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(req.url, req);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const boxes = await loadBoxesBestEffort();
  const response = NextResponse.json(
    { boxes },
    { headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` } },
  );

  if (cache) {
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
