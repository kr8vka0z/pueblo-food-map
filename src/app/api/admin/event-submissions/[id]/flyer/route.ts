/**
 * GET /api/admin/event-submissions/[id]/flyer — the pending flyer of a public
 * event submission (#883), for the admin list. A pending flyer has no public
 * URL at all (PENDING_FLYER_PREFIX), so the admin reads it here: session
 * only (a GET writes nothing, so no requireAdminOrigin), `no-store`.
 */

import { type NextRequest } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { PENDING_FLYER_KEY_RE } from "@/lib/eventFlyers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await getAdminDb(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { id } = await params;
  const row = await access.db.prepare("SELECT flyer_key FROM event_submissions WHERE id = ?").bind(id).first<{ flyer_key: string | null }>();
  if (!row?.flyer_key || !PENDING_FLYER_KEY_RE.test(row.flyer_key)) return new Response(null, { status: 404 });
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.EVENT_FLYERS.get(row.flyer_key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(await object.arrayBuffer(), {
    headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
  });
}
