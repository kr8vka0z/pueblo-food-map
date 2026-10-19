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
 * A closure report is no longer resolved through this route: the old
 * optional `{ submissionId }` body (archive-and-approve in one batch) was
 * removed once nothing linked to the edit page's closure context any more —
 * closure reports are now resolved by SubmissionCard's "Mark done"
 * (POST /api/admin/submissions/[id]/done).
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
 * fresh). The audit insert carries the same `WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND
 * updated_at = ?)` guard as the sibling edit route, for the same
 * dependent-write reasoning that route's own header explains in full —
 * RETURNING the actually-written row was considered and rejected here: a
 * value RETURNING hands back only after a statement runs can't be threaded
 * into a LATER statement's own bind params within the same db.batch() call
 * (every statement's binds are fixed before the batch is sent), so it
 * couldn't have built the SAME atomic audit insert this route needs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authorizeAdminWrite, type AdminDbAccess } from "@/lib/adminDb";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import type { AdminVenueRow } from "@/types/venue";
// #265: the edit route's SELECT-form insert. Its WHERE EXISTS guard skips the
// audit row when the archive UPDATE below didn't apply; the trailing two bind
// params (id, the new timestamp) are the guard.
import { AUDIT_INSERT_SQL } from "@/lib/adminVenueEditSql";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeAdminWrite(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id } = await params;

  const existing = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(id).first<AdminVenueRow>();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

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
  // #265: the dependent audit insert binds this pair (id, timestamp) as its
  // WHERE EXISTS guard.
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
      // #679: ties this action to the sign-in that made it (Activity log).
      identity.sessionId ?? null,
      ...dependentGuardArgs,
    );

  // Atomic: the status flip and its own audit trail either both land or
  // neither does. archiveVenue MUST stay statement index 0 — the 409 check
  // below reads results[0].
  const results = await db.batch([archiveVenue, insertAudit]);

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
