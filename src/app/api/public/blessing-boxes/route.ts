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
 * Worker response (it's advisory to the BROWSER, not Cloudflare's edge).
 * The actual cache.put()/cache.match() pair lives in the shared
 * respondWithEdgeCache() helper (src/lib/edgeCache.ts) — see that file's
 * header for why it's shared with the activity route rather than
 * duplicated: a degraded (D1-failure) load must never be cached, and that
 * rule needs to live in exactly one place.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadLiveBoxes, type PublicBlessingBox } from "@/lib/blessingBoxes";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import { respondWithEdgeCache, type BestEffortResult } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

async function loadBoxesBestEffort(): Promise<BestEffortResult<{ boxes: PublicBlessingBox[] }>> {
  try {
    const { env } = getCloudflareContext();
    const boxes = await loadLiveBoxes(env.ADMIN_DB);
    return { data: { boxes }, degraded: false };
  } catch (err) {
    // Best-effort, never blocking (same convention as public_submissions'
    // insert path, src/lib/publicSubmissions.ts): a D1 blip degrades the
    // live layer to "no boxes this request" rather than 500ing the map —
    // but `degraded: true` tells respondWithEdgeCache() to never cache
    // this fallback (see edgeCache.ts's own header).
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return { data: { boxes: [] }, degraded: true };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return respondWithEdgeCache(req, loadBoxesBestEffort);
}
