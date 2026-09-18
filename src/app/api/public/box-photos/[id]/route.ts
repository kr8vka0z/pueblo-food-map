/**
 * GET /api/public/box-photos/[id] — streams an approved blessing-box photo's
 * JPEG bytes from R2 (Blessing Boxes slice 5).
 *
 * APPROVED ONLY, enforced structurally: loadApprovedBoxPhotoById() (src/lib/
 * boxPhotos.ts) filters `status = 'approved'` at the SQL level, so a
 * pending/rejected/flagged photo's row is never even fetched, and its R2
 * bytes are never read at all — same "never even reach the private thing"
 * guarantee this app already applies to host_contact and 'problem' check-in
 * reports (see blessingBoxes.ts's own header). An admin needs to preview a
 * NOT-yet-approved photo — that's the separate GET /api/admin/box-photos/
 * [id]/preview route, gated by getAdminDb(), which this route is not.
 *
 * Caching — Workers Cache API (caches.default), NOT `immutable`/a 1-year
 * max-age: unlike a venue's static assets, an approved photo can be
 * FLAGGED or REJECTED later and must stop serving promptly — the approve/
 * reject/flag routes all bustEdgeCache() this exact path on any status
 * change, but that purge is per-colo (see respondWithEdgeCache's own
 * header), so the Cache-Control TTL is the real cross-colo bound. 5 minutes
 * (fix, 2026-09-18, PR #490 review; was 1 hour) is the deliberate choice: a
 * flagged/rejected photo can now only ever linger on an un-purged colo (or
 * in a visitor's own browser cache — same header governs both) for up to 5
 * minutes, not up to an hour — a moderation trade-off, not a technical
 * ceiling. `cache.put()` below has no TTL of its own; the Cache API reads it
 * straight off this same Cache-Control header, so one constant governs both.
 *
 * A 404 (bad id, no approved row, or the R2 object itself missing) is NEVER
 * cached — same "never cache a degraded/negative result" rule
 * respondWithEdgeCache() enforces for the JSON routes, applied by hand here
 * since this route serves binary bytes, not JSON.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadApprovedBoxPhotoById } from "@/lib/boxPhotos";
import { logBlessingBoxesReadFailure } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 5 * 60; // see this file's own header for why 5 minutes, not immutable/1-year

function notFound(): Response {
  return new Response(null, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await params;
  const photoId = Number(rawId);
  if (!Number.isInteger(photoId) || photoId <= 0) return notFound();

  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(req.url, req);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  let db: D1Database;
  let bucket: R2Bucket;
  try {
    ({ env: { ADMIN_DB: db, BOX_PHOTOS: bucket } } = getCloudflareContext());
  } catch {
    return notFound(); // no live Worker context — degrade the same as "not found," never a 500 for a public image request
  }

  let row;
  try {
    row = await loadApprovedBoxPhotoById(db, photoId);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error (box_photos serve read)");
    return notFound();
  }
  if (!row) return notFound();

  const object = await bucket.get(row.r2_key);
  if (!object) return notFound(); // D1 row exists but the R2 object is gone — never crash a public image request over it

  const bytes = await object.arrayBuffer();
  const response = new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });

  if (cache) {
    try {
      const { ctx } = getCloudflareContext();
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // No live ExecutionContext — caching is a performance nicety only.
    }
  }

  return response;
}
