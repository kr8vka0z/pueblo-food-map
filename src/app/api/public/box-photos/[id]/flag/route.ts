/**
 * POST /api/public/box-photos/[id]/flag — "Report this photo" (Blessing
 * Boxes slice 5). One tap, no Turnstile (see this file's own reasoning
 * below), immediately hides the photo pending re-review.
 *
 * WHY no Turnstile, unlike every other public write in this app: a report
 * is a single low-stakes tap with no free-text field for a bot to abuse
 * (nothing to spam INTO — the worst outcome of an abused flag is a real
 * photo going back into the review queue, which a human then clears with
 * one Approve click). Turnstile's UX cost (a challenge widget on every tap)
 * isn't worth it for that risk; the per-visitor rate limit below is the
 * actual anti-abuse control, same posture the task's own spec calls for.
 *
 * Guard order (fix, 2026-09-18, PR #490 review): a missing/malformed
 * `clientToken` is now a hard 400 — earlier this field was OPTIONAL (same
 * posture the photo upload route still has), but that let a script POST a
 * bodyless request per photo id and hide every photo in the review queue
 * with no rate limit ever touched (checkAndIncrement was skipped entirely
 * when clientTokenStr was falsy) while also emailing issues@ once per
 * photo. A real client always has one (getCheckinClientToken() mints it on
 * first localStorage read), so requiring it here costs nothing for a real
 * visitor and closes the free-for-all. Order: id -> clientToken presence
 * (400) -> live D1 context (503) -> per-visitor cap (429) -> a NEW
 * site-wide cap across ALL photos (429, ~30/hour — closes the "rotate
 * clientToken to bypass the per-visitor cap" gap the per-visitor check
 * alone can't) -> load the photo AS APPROVED ONLY -> flip.
 *
 * Only an APPROVED photo can be flagged — loadApprovedBoxPhotoById(), the
 * exact same "never even fetch the private thing" query the public serve
 * route uses (boxPhotos.ts's own header). A pending/rejected/already-
 * flagged photo has no public existence to report, and a 404 here can never
 * leak that distinction to a caller probing ids.
 *
 * Sets status='flagged' (hides it — the serve route and every list query
 * require status='approved') and increments flag_count (a historical tally,
 * never reset by re-approval — see the approve route's own header). No
 * audit_log row: this is a PUBLIC action with no admin identity attached,
 * unlike every admin moderation decision in this app.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { loadApprovedBoxPhotoById } from "@/lib/boxPhotos";
import { bustEdgeCache } from "@/lib/edgeCache";
import { logFormFailure } from "@/lib/logger";

/** A handful per visitor per hour — the task's own suggested figure; this is a low-stakes one-tap action, not worth a tighter cap. */
const MAX_FLAGS_PER_VISITOR_PER_HOUR = 5;

/** Site-wide, across every photo and every clientToken (fix, 2026-09-18, PR #490 review) — the per-visitor cap alone does nothing against a script that mints a fresh clientToken per request, so this is a second, coarser ceiling keyed to one fixed id instead of the caller's token. ~30/hour per the review finding — enough for a real flood of reports on a genuinely bad photo, far below what it'd take to empty the review queue. */
const MAX_FLAGS_SITE_WIDE_PER_HOUR = 30;
const GLOBAL_FLAG_RATE_LIMIT_ID = "all-photos";

async function sendFlagEmail(photoId: number, boxName: string): Promise<void> {
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
      subject: `[PFM Blessing Box] Photo reported — ${boxName}`,
      text: [
        `A photo for ${boxName} was reported and has been hidden pending review.`,
        ``,
        `Photo ID: ${photoId}`,
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
): Promise<Response> {
  const { id: rawId } = await params;
  const photoId = Number(rawId);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // fall through to the clientToken check below — a bodyless POST fails it the same as a body missing the field
  }
  const clientToken = (body as { clientToken?: unknown })?.clientToken;
  const clientTokenStr = typeof clientToken === "string" && clientToken.length > 0 ? clientToken.slice(0, 200) : null;
  if (!clientTokenStr) {
    return NextResponse.json({ ok: false, error: "missing_client_token" }, { status: 400 });
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const checkinRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!checkinRateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }
  const underVisitorCap = await checkAndIncrement(
    db,
    checkinRateLimitSecret,
    { scope: "photo-flag-visitor", id: clientTokenStr },
    MAX_FLAGS_PER_VISITOR_PER_HOUR,
  );
  if (!underVisitorCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
  }
  const underGlobalCap = await checkAndIncrement(
    db,
    checkinRateLimitSecret,
    { scope: "photo-flag-global", id: GLOBAL_FLAG_RATE_LIMIT_ID },
    MAX_FLAGS_SITE_WIDE_PER_HOUR,
  );
  if (!underGlobalCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_global" }, { status: 429 });
  }

  const existing = await loadApprovedBoxPhotoById(db, photoId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await db
    .prepare("UPDATE box_photos SET status = 'flagged', flag_count = flag_count + 1 WHERE id = ? AND status = 'approved'")
    .bind(photoId)
    .run();

  await bustEdgeCache(req, [
    "/api/public/blessing-boxes",
    `/api/public/blessing-boxes/${existing.venue_id}/photos`,
    `/api/public/box-photos/${photoId}`,
  ]);

  try {
    const boxName =
      (await db.prepare("SELECT name FROM venues WHERE id = ?").bind(existing.venue_id).first<{ name: string }>())
        ?.name ?? existing.venue_id;
    await sendFlagEmail(photoId, boxName);
  } catch (err) {
    logFormFailure("checkin_photo", "send_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
  }

  return NextResponse.json({ ok: true, id: photoId });
}
