/**
 * GET /api/public/events — the public read of special events (#757,
 * umbrella #156). Returns published events that have not ended, soonest
 * first, in the PublicEvent shape (src/lib/events.ts) — no drafts, cancelled
 * or archived rows, and no internal columns.
 *
 * Auth: none. Same public-route convention as /api/public/blessing-boxes:
 * reads getCloudflareContext().env.ADMIN_DB directly, never getAdminDb().
 *
 * Caching: 60s at the Cloudflare edge through the shared
 * respondWithEdgeCache() (src/lib/edgeCache.ts), exactly like the box list.
 * Every admin events write purges this path (bustEdgeCache), so a publish
 * shows up without waiting the full minute on that colo.
 *
 * FAIL SOFT, on purpose: this code can reach production before the `events`
 * migration is applied there (the production migration is a manual,
 * owner-approved step, AGENTS.md "Promotion checklist"). A missing table or
 * any D1 failure therefore answers an empty list with a 200, not a 500, and
 * flags it `degraded` so respondWithEdgeCache() never stores the fallback
 * and sends it `no-store` — the first request after the table appears
 * serves real data.
 */

import { NextRequest } from "next/server";
import { loadPublicEvents, type PublicEvent } from "@/lib/events";
import { logEventsReadFailure } from "@/lib/logger";
import { bestEffort, respondWithEdgeCache } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return respondWithEdgeCache(
    req,
    () =>
      bestEffort(
        async (db): Promise<{ events: PublicEvent[] }> => ({ events: await loadPublicEvents(db) }),
        { events: [] },
        logEventsReadFailure,
      ),
    { ignoreQuery: true },
  );
}
