/**
 * POST /api/admin/box-photos/[id]/reject — moderation decision: reject a
 * pending or flagged photo, with an optional reviewer-entered reason
 * (Blessing Boxes slice 5).
 *
 * Same auth pair, same atomic-batch + audit_log shape as the approve route
 * (this file's sibling) — see that route's own header for the shared
 * reasoning (action='update', entity='box_photo', no schema change).
 *
 * ORDER MATTERS: the D1 write (status flip + audit_log) commits FIRST, and
 * the R2 object delete happens AFTER, best-effort. If the R2 delete were
 * attempted first and then D1 failed, a 'pending' row would end up pointing
 * at nothing — invisible to the review queue (queue only lists pending/
 * flagged, so it would still show up, but Approve/Reject on it would then
 * try to serve/delete an already-gone object) with no record anything went
 * wrong. Doing D1 first means the WORST case on an R2 failure is a harmless
 * orphaned object in the bucket — never served (the public/admin serve
 * routes both require a D1 row in the right status pointing at it), costing
 * nothing but a few KB of storage until a manual cleanup.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { loadBoxPhotoById, type BoxPhotoRow } from "@/lib/boxPhotos";
import { bustEdgeCache } from "@/lib/edgeCache";
import { logFormFailure } from "@/lib/logger";

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

/** Reviewer-entered reason, capped generously — this is an internal admin note, not public-facing copy, so no i18n and no tight limit. */
const MAX_REVIEW_REASON_LENGTH = 500;

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

  // Defensive body parse — same "a bodyless POST must not throw" convention
  // ArchiveVenueButton's own route already established, since a reject can
  // reasonably be a plain button click with no reason typed.
  let reviewReason: string | null = null;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body?.reason === "string" && body.reason.trim() !== "") {
      reviewReason = body.reason.trim().slice(0, MAX_REVIEW_REASON_LENGTH);
    }
  } catch {
    // no body / not JSON — reason stays null, this is not an error
  }

  const existing = await loadBoxPhotoById(db, photoId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const timestamp = new Date().toISOString();
  const afterRow: BoxPhotoRow = {
    ...existing,
    status: "rejected",
    reviewed_by: identity.email,
    reviewed_at: timestamp,
    review_reason: reviewReason,
  };

  const updatePhoto = db
    .prepare(
      "UPDATE box_photos SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_reason = ? WHERE id = ?",
    )
    .bind(identity.email, timestamp, reviewReason, photoId);
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

  // Best-effort, AFTER the D1 write commits — see this file's own header
  // for why the ordering is load-bearing.
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.BOX_PHOTOS.delete(existing.r2_key);
  } catch (err) {
    logFormFailure("checkin_photo", "db_write_failed", {
      message: err instanceof Error ? err.message : "R2 delete failed on reject",
    });
  }

  return NextResponse.json({ ok: true, id: photoId, status: "rejected" });
}
