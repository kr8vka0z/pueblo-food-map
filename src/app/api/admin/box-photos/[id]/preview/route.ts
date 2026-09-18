/**
 * GET /api/admin/box-photos/[id]/preview — streams ANY photo's JPEG bytes
 * (pending/approved/rejected/flagged), for the admin review queue and the
 * admin edit-page photo panel (Blessing Boxes slice 5).
 *
 * The public serve route (GET /api/public/box-photos/[id]) exists
 * specifically to be approved-only — an admin needs the opposite: to see
 * exactly the photos that AREN'T approved yet, in order to decide. Two
 * separate routes, not one route with a query flag, so the public path's
 * "never even fetch the private thing" structural guarantee
 * (loadApprovedBoxPhotoById's own header) can never be weakened by a
 * future edit to this one.
 *
 * Auth: getAdminDb() only — a GET with no mutation, same "read-only admin
 * page needs no requireAdminOrigin() CSRF check" convention as
 * /api/admin/whoami and the admin venue-list read (AGENTS.md "Admin
 * authentication").
 *
 * No Cache-Control / Workers Cache API — this is an admin-only, low-volume
 * read; caching would risk an admin seeing a stale image after a re-upload,
 * and the public serve route already owns the one cache-worth-having path.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAdminDb } from "@/lib/adminDb";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { loadBoxPhotoById } from "@/lib/boxPhotos";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let db;
  try {
    ({ db } = await getAdminDb(req.headers));
  } catch (err) {
    return adminAuthErrorResponse(err);
  }

  const { id: rawId } = await params;
  const photoId = Number(rawId);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const row = await loadBoxPhotoById(db, photoId);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // getAdminDb() only hands back { db, identity } (ADMIN_DB) — the R2
  // binding lives on the same Cloudflare env object, fetched separately the
  // same way getAdminDb() itself does internally.
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.BOX_PHOTOS.get(row.r2_key);
  if (!object) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return new Response(await object.arrayBuffer(), {
    status: 200,
    headers: { "Content-Type": "image/jpeg" },
  });
}
