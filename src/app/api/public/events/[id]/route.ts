/**
 * GET /api/public/events/[id] — one special event for a shared link (#759,
 * umbrella #156).
 *
 * WHY it exists: the feed (/api/public/events) only carries published events
 * that have not ended, so a link shared before the event and opened after it
 * (or after a cancel) would find nothing. This read returns a `published`
 * event even after it ended, and a `cancelled` one with the admin's note, so
 * the card can say "This event has ended" / "Cancelled" instead of going blank.
 *
 * Privacy: `draft` and `archived` rows, unknown ids, and a missing table all
 * answer with the SAME 404 body, so the response never reveals that a draft
 * exists. Same explicit column list as the feed plus status and the cancel
 * note (src/lib/events.ts).
 *
 * Auth: none (public-route convention, reads ADMIN_DB directly). Caching: the
 * same 60s edge cache as the feed through respondWithEdgeCache(); only a
 * 200 is stored, so a 404 for an event published a minute later never sticks,
 * and admin writes purge this path (purgeEventsFeed).
 *
 * FAIL SOFT: a D1 failure (e.g. the migration is not applied to production
 * yet) is a 404, never a 500, flagged `degraded` so it is never cached.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadPublicEventById, type PublicEventDetail } from "@/lib/events";
import { logEventsReadFailure } from "@/lib/logger";
import { respondWithEdgeCache, type BestEffortResult } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

type Body = { event: PublicEventDetail } | { event: null };

async function loadEvent(id: string): Promise<BestEffortResult<Body>> {
  try {
    const { env } = getCloudflareContext();
    const event = await loadPublicEventById(env.ADMIN_DB, id);
    return event
      ? { data: { event }, degraded: false }
      : { data: { event: null }, degraded: false, status: 404 };
  } catch (err) {
    logEventsReadFailure(err instanceof Error ? err.message : "unknown error");
    return { data: { event: null }, degraded: true, status: 404 };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return respondWithEdgeCache(req, () => loadEvent(id));
}
