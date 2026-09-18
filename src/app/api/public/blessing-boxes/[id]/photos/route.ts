/**
 * /api/public/blessing-boxes/[id]/photos — the public photo layer's write
 * (POST) and read (GET) paths (Blessing Boxes slice 5).
 *
 * POST — upload a photo, multipart/form-data (a `photo` File field plus the
 * usual anti-abuse fields — see CHECKIN_KINDS-style guard order below).
 * Same guard ORDER as every other public write in this app (report/submit,
 * suggest/submit, and this box's own checkins route): Content-Type check ->
 * pre-parse size gate (411 on a missing/non-finite/zero Content-Length, 413
 * once it parses but is over MAX_REQUEST_BYTES — see
 * parsePositiveContentLength()'s own header for why all three of those had
 * to become a hard rejection rather than silently coercing to 0/NaN) ->
 * parse body -> honeypot -> Turnstile -> rate limit -> field validation ->
 * box lookup -> write. Turnstile verification and
 * key selection is shared with the checkins route via src/lib/
 * boxTurnstile.ts (reuse, not a copy, per the task's own instruction) —
 * same dedicated invisible-mode key with a managed-mode fallback.
 *
 * Two rate-limit scopes, both via the SAME D1-shared-counter module the
 * checkins route uses (src/lib/checkinRateLimit.ts) — new scope names
 * ("photo-visitor-box"/"photo-box") so a photo upload's budget is entirely
 * separate from a check-in's; a burst of photo uploads must not eat into
 * (or be capped by) the check-in caps, and vice versa. Visitor cap checked
 * FIRST, same "don't let one over-tapping visitor burn the shared box-wide
 * budget on their own rejected attempts" reasoning the checkins route's own
 * header documents.
 *
 * File handling, in order: verify the JPEG magic bytes (never trust
 * Content-Type alone — spoofable), enforce MAX_PHOTO_BYTES (a second,
 * server-side check on top of the client's own canvas-shrink — never trust
 * the client alone), strip EXIF/APPn metadata server-side
 * (src/lib/jpegSegments.ts — the client's canvas re-encode already drops
 * EXIF incidentally, but this route can't assume that happened), read real
 * width/height from the stripped file's own SOF segment (never a
 * client-reported value), then write to R2 at
 * `box-photos/<venueId>/<uuid>.jpg` and insert the box_photos row
 * (status='pending' — the column default; nothing here can set any other
 * status, moderation is admin-only, see the approve/reject/flag routes).
 *
 * `checkinId`, when sent, must belong to THIS box — looked up and checked
 * (`venue_id = boxId`) before being trusted, so a photo can never be
 * attached to another box's check-in by a tampered/copy-pasted id.
 *
 * No cache-bust on upload: a pending photo changes nothing any public
 * cached response shows (only an approved photo does) — see the
 * approve/reject/flag routes for where bustEdgeCache() actually matters.
 *
 * Admin alert email mirrors the checkins route's own 'problem'-report
 * email (same Resend sending-key convention, same best-effort try/catch —
 * a Resend outage must never fail an otherwise-successful upload).
 *
 * GET — every APPROVED photo for this box, newest first, capped at
 * MAX_HISTORY_PHOTOS — feeds /box/<id>/history's "Photos" section. Same
 * public-route conventions as GET /api/public/blessing-boxes: no auth,
 * best-effort D1 read via respondWithEdgeCache() (a read failure degrades
 * to an empty list, never a 500, and is never itself cached — see that
 * helper's own header).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { insertPendingPhoto, loadApprovedPhotosForVenue, MAX_HISTORY_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/boxPhotos";
import { InvalidJpegError, readJpegDimensions, stripMetadataSegments, verifyJpegMagic } from "@/lib/jpegSegments";
import { logFormFailure } from "@/lib/logger";
import { respondWithEdgeCache, type BestEffortResult } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

/** A handful per box per hour from one visitor — same order-of-magnitude reasoning as the checkins route's own per-visitor cap, just tighter (a photo upload is a rarer, more deliberate action than a one-tap check-in). */
const MAX_PHOTO_UPLOADS_PER_VISITOR_PER_BOX_PER_HOUR = 3;
/** Catches an automated flood against one box; comfortably covers up to 10 distinct visitors each maxing their own per-visitor cap in one hour, well above real honest use. */
const MAX_PHOTO_UPLOADS_PER_BOX_PER_HOUR = 30;

/** Reject an oversized body before ever calling req.formData() — a bot sending a huge multipart body shouldn't get this route to buffer it just to be rate-limited (or size-rejected) afterward. Padded above MAX_PHOTO_BYTES for ordinary multipart framing overhead (boundary strings, field headers). */
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 64 * 1024;

/**
 * Parses the `Content-Length` header for the pre-parse size gate below.
 * Returns null for anything that isn't a genuine positive byte count — a
 * MISSING header (`Number(null ?? "0")` used to silently become 0), a junk
 * header (`Number("abc")` used to silently become NaN), or an explicit "0" —
 * every one of those used to sail past the old `> MAX_REQUEST_BYTES` check
 * (0 and NaN are never `>` anything) and let `req.formData()` buffer an
 * unbounded body before any size check ever fired (fix, 2026-09-18, PR #490
 * review). A real browser multipart upload always sends a genuine positive
 * Content-Length, so refusing anything else costs no honest caller.
 */
function parsePositiveContentLength(header: string | null): number | null {
  if (header === null) return null;
  const n = Number(header);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface BoxLookupRow {
  id: string;
}

interface CheckinLookupRow {
  id: number;
  venue_id: string;
}

async function sendNewPhotoEmail(boxId: string, boxName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "Pueblo Food Map <noreply@pueblofoodmap.com>",
      to: ["issues@pueblofoodmap.com"],
      subject: `[PFM Blessing Box] New photo to review — ${boxName}`,
      text: [
        `A new photo was uploaded for ${boxName} and is waiting for review.`,
        ``,
        `Box: ${boxName}`,
        `Box ID: ${boxId}`,
        ``,
        `Review it at https://pueblofoodmap.com/admin/box-photos`,
      ].join("\n"),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: boxId } = await params;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const contentLength = parsePositiveContentLength(req.headers.get("content-length"));
  if (contentLength === null) {
    return NextResponse.json({ ok: false, error: "content_length_required" }, { status: 411 });
  }
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "photo_too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const website = form.get("website");
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true }); // bots think it worked
  }

  const ip =
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const turnstileKey = resolveBoxTurnstileKey(form.get("turnstileKey"));
  const checkinRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!checkinRateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }
  const turnstileToken = form.get("turnstileToken");
  const turnstileValid = await verifyBoxTurnstile(
    typeof turnstileToken === "string" ? turnstileToken : undefined,
    turnstileKey,
    ip,
  );
  if (!turnstileValid) {
    logFormFailure("checkin_photo", "turnstile_failed");
    return NextResponse.json({ ok: false, error: "turnstile_failed" }, { status: 400 });
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const clientToken = form.get("clientToken");
  const clientTokenStr = typeof clientToken === "string" ? clientToken.slice(0, 200) : null;
  if (clientTokenStr) {
    const visitorCap = await checkAndIncrement(
      db,
      checkinRateLimitSecret,
      { scope: "photo-visitor-box", id: `${clientTokenStr}:${boxId}` },
      MAX_PHOTO_UPLOADS_PER_VISITOR_PER_BOX_PER_HOUR,
    );
    if (!visitorCap) {
      return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
    }
  }
  const boxCap = await checkAndIncrement(
    db,
    checkinRateLimitSecret,
    { scope: "photo-box", id: boxId },
    MAX_PHOTO_UPLOADS_PER_BOX_PER_HOUR,
  );
  if (!boxCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_box" }, { status: 429 });
  }

  const box = await db
    .prepare("SELECT id FROM venues WHERE id = ? AND category = 'blessing_box' AND status != 'archived'")
    .bind(boxId)
    .first<BoxLookupRow>();
  if (!box) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // A submitted checkin_id must belong to THIS box — never trusted from the
  // client alone (see this file's own header).
  let checkinId: number | null = null;
  const rawCheckinId = form.get("checkinId");
  if (typeof rawCheckinId === "string" && rawCheckinId.trim() !== "") {
    const parsed = Number(rawCheckinId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid checkinId" }, { status: 422 });
    }
    const checkin = await db
      .prepare("SELECT id, venue_id FROM box_checkins WHERE id = ?")
      .bind(parsed)
      .first<CheckinLookupRow>();
    if (!checkin || checkin.venue_id !== boxId) {
      return NextResponse.json({ ok: false, error: "Invalid checkinId" }, { status: 422 });
    }
    checkinId = checkin.id;
  }

  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) {
    return NextResponse.json({ ok: false, error: "No photo provided" }, { status: 422 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ ok: false, error: "photo_too_large" }, { status: 413 });
  }

  const originalBytes = await photo.arrayBuffer();
  if (!verifyJpegMagic(new Uint8Array(originalBytes))) {
    return NextResponse.json({ ok: false, error: "unsupported_image_type" }, { status: 422 });
  }

  let strippedBytes: ArrayBuffer;
  let dimensions: { width: number; height: number };
  try {
    strippedBytes = stripMetadataSegments(originalBytes);
    dimensions = readJpegDimensions(strippedBytes);
  } catch (err) {
    if (err instanceof InvalidJpegError) {
      return NextResponse.json({ ok: false, error: "unsupported_image" }, { status: 422 });
    }
    throw err;
  }

  const r2Key = `box-photos/${boxId}/${crypto.randomUUID()}.jpg`;
  try {
    await getCloudflareContext().env.BOX_PHOTOS.put(r2Key, strippedBytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
  } catch (err) {
    logFormFailure("checkin_photo", "db_write_failed", {
      message: err instanceof Error ? err.message : "R2 put failed",
    });
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 502 });
  }

  let photoId: number;
  try {
    photoId = await insertPendingPhoto(db, {
      venueId: boxId,
      checkinId,
      r2Key,
      width: dimensions.width,
      height: dimensions.height,
      bytes: strippedBytes.byteLength,
    });
  } catch (err) {
    logFormFailure("checkin_photo", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    // The R2 object is now orphaned (no D1 row points at it) — harmless
    // (never served: the serve route requires an approved D1 row to exist
    // at all), not worth a best-effort R2 delete-on-failure here.
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  try {
    const boxName =
      (await db.prepare("SELECT name FROM venues WHERE id = ?").bind(boxId).first<{ name: string }>())?.name ??
      boxId;
    await sendNewPhotoEmail(boxId, boxName);
  } catch (err) {
    // Same "already-durable write, best-effort alert on top" posture as the
    // checkins route's own problem-report email — a Resend outage must
    // never fail an otherwise-successful upload.
    logFormFailure("checkin_photo", "send_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
  }

  return NextResponse.json({ ok: true, photoId });
}

async function loadApprovedPhotosBestEffort(
  db: D1Database,
  boxId: string,
): Promise<BestEffortResult<{ photos: { id: number; createdAt: string }[] }>> {
  try {
    const photos = await loadApprovedPhotosForVenue(db, boxId, MAX_HISTORY_PHOTOS);
    return { data: { photos }, degraded: false };
  } catch (err) {
    logFormFailure("checkin_photo", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error (box_photos list read)",
    });
    return { data: { photos: [] }, degraded: true };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: boxId } = await params;
  return respondWithEdgeCache(req, async () => {
    try {
      const { env } = getCloudflareContext();
      return await loadApprovedPhotosBestEffort(env.ADMIN_DB, boxId);
    } catch {
      return { data: { photos: [] }, degraded: true };
    }
  });
}
