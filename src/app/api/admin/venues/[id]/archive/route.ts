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
 * (sent by ArchiveVenueButton — src/components/ArchiveVenueButton.tsx —
 * when it's rendered from /admin/venues/[id]/edit's `?submission=<id>`
 * closure-report context, #270) appends a THIRD statement to the same
 * atomic `db.batch()` below, flipping that submission to `status='approved'`
 * — same technique and same reasoning as POST /api/admin/venues's own
 * (#259) submissionId extension. Parsing the body is defensive (empty/
 * missing/non-JSON body never throws) specifically so ArchiveVenueButton's
 * plain, no-submission call (the common case) keeps working unchanged.
 * (Before #270, this body was sent one level up, directly from
 * SubmissionsReviewView's own one-click closure-approve button — that
 * action now opens the edit page first instead; this route's own logic is
 * unchanged either way, since it never cared who calls it.)
 *
 * #265: the audit row's after_json used to spread the pre-fetched `existing`
 * row, so if PATCH /api/admin/venues/[id] raced this route (changed some
 * OTHER field between this route's own SELECT and its UPDATE), the audit
 * snapshot could show stale non-status values even though the persisted
 * `venues` row itself stayed correct (each route only ever touches its own
 * columns). Fix: `UPDATE venues SET status = 'archived', ... WHERE id = ?
 * AND updated_at = ?` bound to `existing.updated_at` — a route-internal
 * optimistic-concurrency check with no client involvement needed, since
 * `existing` was read moments earlier in this SAME request. If it matches,
 * `existing` is PROVABLY still fresh (nothing could have changed it without
 * also changing updated_at, which the WHERE clause would then have
 * rejected) — so `afterRow`'s spread of `existing` is correct by
 * construction, no re-read needed. If it doesn't match (a true concurrent
 * write landed in the tiny window between this route's SELECT and its own
 * batch), `results[0].meta.changes === 0` and the route returns 409 rather
 * than writing a stale audit snapshot — ArchiveVenueButton's existing
 * generic non-200 handling covers this (a plain "try again" retry re-reads
 * fresh). The audit insert and (#259) submission-approve statements carry
 * the same `WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND
 * updated_at = ?)` guard as the sibling edit route, for the same
 * dependent-write reasoning that route's own header explains in full —
 * RETURNING the actually-written row was considered and rejected here: a
 * value RETURNING hands back only after a statement runs can't be threaded
 * into a LATER statement's own bind params within the same db.batch() call
 * (every statement's binds are fixed before the batch is sent), so it
 * couldn't have built the SAME atomic audit insert this route needs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/adminOrigin";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import type { AdminVenueRow } from "@/types/venue";

async function authorizeArchiveRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

// #265: SELECT-form (not VALUES) so the WHERE EXISTS guard can skip the
// insert entirely when the archive UPDATE below didn't actually apply —
// same shape and reasoning as the sibling edit route's own AUDIT_INSERT_SQL.
// Trailing two bind params (id, the new timestamp) are the guard.
const AUDIT_INSERT_SQL = `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp)
  SELECT ?, ?, ?, ?, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)`;

// The `AND kind = 'closure' AND target_venue_id = ?` guard (mirrors the
// create route's own `kind = 'new_venue'` guard) closes a cross-kind/
// cross-target approval gap: a closure approval must target the very venue
// being archived, so a submissionId pointing at a 'new_venue' row, or at a
// closure report for a DIFFERENT venue, now affects 0 rows here — the
// archive still succeeds, but the wrong submission is never silently
// marked approved. #265 adds `AND EXISTS (...)` (trailing two bind params)
// so a STALE archive (its own precondition failed) can't mark the
// submission approved for a removal that was never actually written.
const APPROVE_SUBMISSION_SQL = `UPDATE public_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = ?
  WHERE id = ? AND status = 'pending' AND kind = 'closure' AND target_venue_id = ?
  AND EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)`;

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
    return adminAuthErrorResponse(err);
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

  // #265: `AND updated_at = ?` bound to existing.updated_at (read moments
  // ago, above) is the route-internal optimistic-concurrency precondition —
  // see this file's own header for why that makes afterRow's spread of
  // `existing` correct by construction rather than a race.
  const archiveVenue = db
    .prepare("UPDATE venues SET status = 'archived', updated_by = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
    .bind(identity.email, timestamp, id, existing.updated_at);
  // #265: every dependent statement below binds this SAME pair
  // (id, timestamp) as its own WHERE EXISTS guard.
  const dependentGuardArgs = [id, timestamp] as const;
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "venue",
      id,
      "archive",
      JSON.stringify(existing),
      JSON.stringify(afterRow),
      timestamp,
      ...dependentGuardArgs,
    );

  // ponytail: same `AND status = 'pending'` idempotency ceiling as POST
  // /api/admin/venues's (#259) approveSubmission — a double-approve or a
  // stale card silently no-ops on the submission row (0 rows affected)
  // rather than erroring, while the archive itself still succeeds either
  // way. Acceptable for this single-admin internal tool; surfacing
  // D1Result.meta.changes to flag a stale card is the upgrade path.
  const approveSubmission =
    submissionId !== null
      ? db.prepare(APPROVE_SUBMISSION_SQL).bind(identity.email, timestamp, submissionId, id, ...dependentGuardArgs)
      : null;

  // Atomic: the status flip, its own audit trail, and (#259) the
  // originating submission's approval either all land together or none
  // does. archiveVenue MUST stay statement index 0 — the 409 check below
  // reads results[0].
  const results = await db.batch([archiveVenue, insertAudit, ...(approveSubmission !== null ? [approveSubmission] : [])]);

  // #265: 0 rows matched means a concurrent write (most likely a PATCH edit)
  // landed between this route's own SELECT and this UPDATE — see this
  // file's own header. Strict === 0, same reasoning as the sibling edit
  // route's own check.
  if (results[0].meta.changes === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "conflict",
        message: "Someone else changed this place since you opened it. Reload to see their changes.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, id, status: "archived" });
}
