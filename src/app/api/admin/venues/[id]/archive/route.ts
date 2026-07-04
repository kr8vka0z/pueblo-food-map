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
 * into one 403 shape. No request body: the UI gates this action behind a
 * confirm() dialog (src/components/ArchiveVenueButton.tsx) before ever
 * calling this endpoint, so by the time this route runs, confirmation has
 * already happened client-side.
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

  // Atomic: the status flip and its own audit trail either both land or neither does.
  await db.batch([archiveVenue, insertAudit]);

  return NextResponse.json({ ok: true, id, status: "archived" });
}
