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
 * Guard order: rate limit (only when a clientToken is present — same
 * optional-visitor-cap posture the photo upload route already established,
 * see that route's own header) -> load the photo AS APPROVED ONLY -> flip.
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
    // a bodyless POST is fine — clientToken is optional, see this file's header
  }
  const clientToken = (body as { clientToken?: unknown })?.clientToken;
  const clientTokenStr = typeof clientToken === "string" ? clientToken.slice(0, 200) : null;

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  if (clientTokenStr) {
    const checkinRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
    if (!checkinRateLimitSecret) {
      throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
    }
    const underCap = await checkAndIncrement(
      db,
      checkinRateLimitSecret,
      { scope: "photo-flag-visitor", id: clientTokenStr },
      MAX_FLAGS_PER_VISITOR_PER_HOUR,
    );
    if (!underCap) {
      return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
    }
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
