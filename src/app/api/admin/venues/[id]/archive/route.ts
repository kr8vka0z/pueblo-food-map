/**
 * POST /api/admin/venues/[id]/archive — "Remove from map" (#255 "[Admin P2]
 * Edit or remove a venue", AC2).
 *
 * A dedicated action endpoint — mirrors POST /api/admin/publish's own
 * "verb-shaped action route" convention — rather than overloading PATCH
 * /api/admin/venues/[id] with a status field. Keeping archive as its own
 * route means the sibling edit route (../route.ts) never has to reason
 * about status transitions at all (see that file's header for the AC3
 * connection).
 *
 * Sets status='archived' and RETAINS the row — never `DELETE FROM venues`.
 * An archived row simply stops being selected by
 * src/lib/publishVenues.ts's fetchPublishSnapshot() (`WHERE status IN
 * ('draft','published')`), so it silently drops off the public map on the
 * next Publish without the row itself ever being destroyed — the D1 record,
 * and its full audit history, stay intact. Writes one audit_log row
 * (action='archive') atomically alongside the status update, same
 * before/after_json shape as the edit route's action='update' row.
 *
 * Auth: identical two-check pattern to every other admin mutation —
 * getAdminDb() then requireAdminOrigin(), both throwing AccessDeniedError
 * into one 403 shape. No request body from ArchiveVenueButton's own call
 * (src/components/ArchiveVenueButton.tsx) — it gates this action behind a
 * confirm() dialog client-side, then POSTs with no body at all, so by the
 * time this route runs, confirmation has already happened.
 *
 * #259 review-queue extension: an OPTIONAL JSON body `{ submissionId }`
 * (sent only by SubmissionsReviewView's "Approve — remove from map" action
 * for a closure-report submission) appends a THIRD statement to the same
 * atomic `db.batch()` below, flipping that submission to `status='approved'`
 * — same technique and same reasoning as POST /api/admin/venues's own
 * (#259) submissionId extension. Parsing the body is defensive (empty/
 * missing/non-JSON body never throws) specifically so ArchiveVenueButton's
 * existing bodyless call keeps working unchanged.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { AccessDeniedError, requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";
import type { AdminVenueRow } from "@/types/venue";

async function authorizeArchiveRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

// The `AND kind = 'closure' AND target_venue_id = ?` guard (mirrors the
// create route's own `kind = 'new_venue'` guard) closes a cross-kind/
// cross-target approval gap: a closure approval must target the very venue
// being archived, so a submissionId pointing at a 'new_venue' row, or at a
// closure report for a DIFFERENT venue, now affects 0 rows here — the
// archive still succeeds, but the wrong submission is never silently
// marked approved.
const APPROVE_SUBMISSION_SQL =
  "UPDATE public_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending' AND kind = 'closure' AND target_venue_id = ?";

/**
 * Reads an optional `{ submissionId }` from the request body without ever
 * throwing — ArchiveVenueButton's real call sends no body at all (see this
 * file's header), so a missing/empty/non-JSON body must degrade to "no
 * submission to approve," not a crash. Mirrors POST /api/admin/venues's own
 * (#259) `readOptionalSubmissionId`, but that route always has a real JSON
 * body (validateCreateVenuePayload already required one); this one doesn't,
 * hence the try/catch here instead of a plain field read there.
 */
async function readOptionalSubmissionId(req: NextRequest): Promise<number | null> {
  try {
    const body: unknown = await req.json();
    const rawSid = (body as { submissionId?: unknown })?.submissionId;
    return typeof rawSid === "number" && Number.isInteger(rawSid) && rawSid > 0 ? rawSid : null;
  } catch {
    return null; // no/empty/non-JSON body — the established bodyless call shape
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeArchiveRequest(req.headers);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      return new Response("Forbidden", { status: 403 });
    }
    throw err;
  }
  const { db, identity } = access;
  const { id } = await params;

  const existing = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(id).first<AdminVenueRow>();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const submissionId = await readOptionalSubmissionId(req);

  const timestamp = new Date().toISOString();
  const afterRow: AdminVenueRow = {
    ...existing,
    status: "archived",
    updated_by: identity.email,
    updated_at: timestamp,
  };

  const archiveVenue = db
    .prepare("UPDATE venues SET status = 'archived', updated_by = ?, updated_at = ? WHERE id = ?")
    .bind(identity.email, timestamp, id);
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(identity.email, "venue", id, "archive", JSON.stringify(existing), JSON.stringify(afterRow), timestamp);

  // ponytail: same `AND status = 'pending'` idempotency ceiling as POST
  // /api/admin/venues's (#259) approveSubmission — a double-approve or a
  // stale card silently no-ops on the submission row (0 rows affected)
  // rather than erroring, while the archive itself still succeeds either
  // way. Acceptable for this single-admin internal tool; surfacing
  // D1Result.meta.changes to flag a stale card is the upgrade path.
  const approveSubmission =
    submissionId !== null
      ? db.prepare(APPROVE_SUBMISSION_SQL).bind(identity.email, timestamp, submissionId, id)
      : null;

  // Atomic: the status flip, its own audit trail, and (#259) the
  // originating submission's approval either all land together or none does.
  await db.batch([archiveVenue, insertAudit, ...(approveSubmission !== null ? [approveSubmission] : [])]);

  return NextResponse.json({ ok: true, id, status: "archived" });
}
