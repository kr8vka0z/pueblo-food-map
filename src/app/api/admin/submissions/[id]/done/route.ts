/**
 * POST /api/admin/submissions/[id]/done — resolve a pending closure/problem
 * report (#675, "fold the Review queue into Places"): the admin has already
 * fixed the reported venue's fields (AddVenueForm's own PATCH, a separate
 * request) or removed it (ArchiveVenueButton's existing `?submission=`
 * archive-and-resolve batch, unchanged by this route) and is telling this
 * report "handled" without either of those.
 *
 * No route resolved a submission without archiving it before this one
 * existed — checked first (POST /api/admin/venues, POST
 * /api/admin/venues/[id]/archive, POST .../submissions/[id]/reject all
 * inspected). `status='approved'` (not a new enum value) is the "resolved"
 * value the create/archive routes already use for a submission that got a
 * matching venue write — migrations/0002_public_submissions.sql's CHECK
 * constraint has no 'done' state, and adding one is a migration, out of
 * scope for this slice. A future column distinguishing "resolved via
 * archive/create" from "marked done by hand" is the upgrade path if that
 * distinction ever matters; today's Places/edit-page UI only needs "no
 * longer pending" either way.
 *
 * Same two-check auth pattern as the sibling reject route
 * (POST /api/admin/submissions/[id]/reject/route.ts) — getAdminDb() then
 * requireAdminOrigin(), both throwing AccessDeniedError into one 403 shape.
 *
 * Only applies to a `kind = 'closure'` row: a `new_venue` submission is
 * resolved by approving it through /admin/venues/new?submission=<id> (POST
 * /api/admin/venues's existing submissionId batch), never this route — see
 * SubmissionCard.tsx's own header for why that card renders a "Review as
 * new place" link instead of a Mark done button.
 *
 * WHY an audit_log row here but not on reject: rejecting is fully
 * self-describing from `public_submissions.status`/`reviewed_by`/
 * `reviewed_at` alone (see the reject route's own header) — nothing else in
 * the app changed. Marking a report done means an admin judged the
 * reported venue already correct (via a save or an archive elsewhere), a
 * judgment call worth a durable audit trail the same way every other venue-
 * adjacent admin decision gets one. `action = 'update'` reuses an existing
 * CHECK value (no venues row is touched by THIS statement, but the
 * decision is about that venue) rather than adding a new action enum,
 * mirroring how change-proposal approvals already reuse
 * create/update/archive for the same reason (migrations/0001's own
 * audit_log comment).
 *
 * `WHERE EXISTS` on the audit insert (SELECT-form, same shape the archive
 * route's own AUDIT_INSERT_SQL uses) gates it on THIS request's own UPDATE
 * having actually applied — checked by re-reading `status = 'approved'` for
 * this id inside the same `db.batch()`, so a concurrent/stale double-click
 * (0 rows updated) never writes a misleading audit entry either.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/adminOrigin";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";

async function authorizeDoneRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

interface PendingClosureRow {
  target_venue_id: string | null;
}

const DONE_SUBMISSION_SQL =
  "UPDATE public_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending' AND kind = 'closure'";

// SELECT-form so the guard can skip the insert entirely when the UPDATE
// above didn't actually apply — same shape as the archive route's own
// AUDIT_INSERT_SQL.
const AUDIT_INSERT_SQL = `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id)
  SELECT ?, 'venue', ?, 'update', NULL, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM public_submissions WHERE id = ? AND status = 'approved')`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeDoneRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  // Read target_venue_id first — needed for the audit row's entity_id, and
  // this SELECT also confirms the row is still a pending closure BEFORE the
  // batch runs, so an already-resolved or new_venue id 404s cleanly rather
  // than reporting success on a batch that quietly did nothing.
  const pending = await db
    .prepare("SELECT target_venue_id FROM public_submissions WHERE id = ? AND status = 'pending' AND kind = 'closure'")
    .bind(id)
    .first<PendingClosureRow>();
  if (!pending || !pending.target_venue_id) {
    return NextResponse.json({ ok: false, error: "Not found or already reviewed" }, { status: 404 });
  }

  const timestamp = new Date().toISOString();
  const markDone = db.prepare(DONE_SUBMISSION_SQL).bind(identity.email, timestamp, id);
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(identity.email, pending.target_venue_id, JSON.stringify({ event: "public_submission_marked_done", submissionId: id }), timestamp, identity.sessionId ?? null, id);

  // Atomic: same "no dependent write without its trigger having actually
  // applied" reasoning as every other admin mutation batch in this app.
  const results = await db.batch([markDone, insertAudit]);

  if (results[0].meta.changes === 0) {
    // A true concurrent race between the SELECT above and this batch —
    // same residual-race tolerance this app's other submissionId/proposalId
    // flows already accept (single-admin internal tool).
    return NextResponse.json({ ok: false, error: "Not found or already reviewed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
