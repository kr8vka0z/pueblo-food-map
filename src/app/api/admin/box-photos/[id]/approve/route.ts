/**
 * POST /api/admin/box-photos/[id]/approve — moderation decision: make a
 * pending or flagged photo public (Blessing Boxes slice 5).
 *
 * Same auth pair as every other admin mutation (see AGENTS.md "Admin
 * authentication" / the box-checkins visibility route this one mirrors):
 * getAdminDb() (Better Auth session) then requireAdminOrigin() (CSRF).
 *
 * Any status may be approved, including 'flagged' — approving a previously
 * flagged photo makes it public again, per the task's own spec.
 * `flag_count` is left untouched on approve: it's a historical tally of how
 * many times this photo was ever reported, not a "currently flagged" flag —
 * zeroing it on approve would erase that history for no operational gain.
 *
 * Atomic db.batch(): the status flip and its audit_log row land together or
 * not at all, same convention as the box-checkins visibility route
 * (action='update', entity='box_photo' — no schema change needed, same
 * reasoning that route's own header documents for reusing 'update' rather
 * than widening audit_log.action's CHECK constraint for one more value).
 *
 * Cache-busting: an approve can newly surface this photo in the box list's
 * `latestPhoto` field, the box's own photo-history list, AND make its own
 * serve route servable for the first time — bustEdgeCache() clears all
 * three paths (see edgeCache.ts's own header for why a photo moderation
 * decision needs three, not one).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { loadBoxPhotoById, type BoxPhotoRow } from "@/lib/boxPhotos";
import { bustEdgeCache } from "@/lib/edgeCache";

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

async function authorize(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorize(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;

  const { id: rawId } = await params;
  const photoId = Number(rawId);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const existing = await loadBoxPhotoById(db, photoId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const timestamp = new Date().toISOString();
  const afterRow: BoxPhotoRow = {
    ...existing,
    status: "approved",
    reviewed_by: identity.email,
    reviewed_at: timestamp,
  };

  const updatePhoto = db
    .prepare("UPDATE box_photos SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?")
    .bind(identity.email, timestamp, photoId);
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "box_photo",
      String(photoId),
      "update",
      JSON.stringify(existing),
      JSON.stringify(afterRow),
      timestamp,
    );

  await db.batch([updatePhoto, insertAudit]);

  await bustEdgeCache(req, [
    "/api/public/blessing-boxes",
    `/api/public/blessing-boxes/${existing.venue_id}/photos`,
    `/api/public/box-photos/${photoId}`,
  ]);

  return NextResponse.json({ ok: true, id: photoId, status: "approved" });
}
