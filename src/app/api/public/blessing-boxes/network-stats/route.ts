/**
 * GET /api/public/blessing-boxes/network-stats — Blessing Boxes slice 7
 * ("Numbers"). Ships the raw data /boxes/activity's network-wide Numbers
 * section needs (every blessing-box venue's archived flag, every non-problem
 * check-in, every approved photo timestamp) — NOT pre-aggregated counts.
 * `src/lib/boxStats.ts`'s pure functions do the actual counting/averaging on
 * the client, the exact same logic src/lib/boxStats.test.ts already proves
 * against fixtures, so this route stays a thin, untested-logic-free data
 * passthrough — same split GET /api/public/blessing-boxes/activity already
 * uses (loadBoxActivity does the work, the route just serves it).
 *
 * WHY a client fetch here rather than reading D1 straight from
 * /boxes/activity/page.tsx: that page is a deliberately static server shell
 * (English `metadata` export, no D1/cookies() read — see its own header) so
 * it stays trivially prerenderable; this route extends the SAME public
 * blessing-box API pattern GET /api/public/blessing-boxes/activity already
 * established, rather than making the page itself dynamic.
 *
 * Auth: none — same public-route convention as every other GET under
 * /api/public/blessing-boxes (getCloudflareContext().env.ADMIN_DB read
 * directly, never getAdminDb()).
 *
 * Caching: same shared Workers Cache API helper (respondWithEdgeCache,
 * src/lib/edgeCache.ts) the other two public blessing-box GETs already use —
 * 60s at the edge, and a degraded (D1-failure) response is never cached.
 *
 * Best-effort: a D1 failure degrades to `{ boxes: [], checkins: [], photos: [] }`
 * (every number then reads 0 or "—") rather than a 500 — same resilience
 * posture as every other public blessing-box read.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadNetworkStatsData, type NetworkStatsData } from "@/lib/boxStats";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import { respondWithEdgeCache, type BestEffortResult } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

const EMPTY_DATA: NetworkStatsData = { boxes: [], checkins: [], photos: [] };

async function loadNetworkStatsBestEffort(): Promise<BestEffortResult<NetworkStatsData>> {
  try {
    const { env } = getCloudflareContext();
    const data = await loadNetworkStatsData(env.ADMIN_DB);
    return { data, degraded: false };
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return { data: EMPTY_DATA, degraded: true };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return respondWithEdgeCache(req, loadNetworkStatsBestEffort);
}
