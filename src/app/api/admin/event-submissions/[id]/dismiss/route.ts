/**
 * POST /api/admin/event-submissions/[id]/dismiss — "Dismiss" a public event
 * submission (#883). A status change (pending -> dismissed) plus its audit
 * row in one batch; nothing is ever deleted, and the pending flyer stays
 * where it is (unreachable by URL). 404 when the row is no longer pending.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeAdminWrite, type AdminDbAccess } from "@/lib/adminDb";
import { dismissSubmission, loadPendingEventSubmission, parseSubmissionPayload } from "@/lib/eventSubmissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeAdminWrite(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { id } = await params;
  const sub = await loadPendingEventSubmission(access.db, id);
  const done = sub ? await dismissSubmission(access.db, access.identity, sub, parseSubmissionPayload(sub.payload)?.name ?? "") : false;
  if (!done) return NextResponse.json({ ok: false, error: "not_found", message: "This event was already handled." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
