/**
 * POST /api/public/blessing-boxes/[id]/adopt — apply to adopt a box
 * (Blessing Boxes slice 6). Writes a pending, unconfirmed application
 * immediately; nothing about it is public ("Cared for by ...") until BOTH
 * the applicant confirms their email (POST /api/public/alerts/confirm) AND
 * an admin approves it (/admin/box-adopters).
 *
 * Same guard ORDER as every other public write on this box surface (see
 * the checkins route's own header): Content-Type -> Turnstile
 * (src/lib/boxTurnstile.ts, reused, not copied) -> honeypot -> rate limit ->
 * field validation -> box lookup -> write -> confirm email.
 *
 * Four rate-limit scopes, all via the shared D1-backed
 * src/lib/checkinRateLimit.ts module and the existing
 * CHECKIN_RATE_LIMIT_SECRET (no new secret needed): "adopt-visitor" (per
 * client token) and "adopt-box" (per box) bound THIS endpoint, mirroring the
 * checkins/photos routes' own per-visitor/per-box pair; "alert-email-target"
 * and "alert-email-global" are SHARED scope names with the giver alert
 * sign-up route (../alerts/route.ts) — the same person (or the same flood of
 * distinct addresses) hammering both endpoints hits one combined email-abuse
 * budget rather than two independently generous ones.
 *
 * A confirm-email send failure is FATAL to the response here (unlike the
 * checkins route's best-effort problem-report email) — per the task's own
 * spec: "Resend failure -> row stays, respond error." The application row is
 * already durable at that point, but the applicant sees a real error rather
 * than a false "check your email."
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { isValidEmail } from "@/lib/rateLimit";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { logFormFailure } from "@/lib/logger";
import { insertAdopterApplication, sendAdopterConfirmEmail } from "@/lib/boxAdopters";

export const dynamic = "force-dynamic";

const MAX_ADOPT_APPLICATIONS_PER_VISITOR_PER_HOUR = 3;
const MAX_ADOPT_APPLICATIONS_PER_BOX_PER_HOUR = 10;
/** Shared with the giver alert sign-up route — see this file's own header. */
const MAX_EMAIL_TARGET_PER_HOUR = 3;
const MAX_EMAIL_GLOBAL_PER_HOUR = 60;

interface AdoptPayload {
  displayName?: string;
  email?: string;
  note?: string;
  /** Honeypot — must be empty string or absent, same convention as every other public form route. */
  website?: string;
  turnstileToken?: string;
  turnstileKey?: string;
  /** Opaque, non-identifying per-browser token from src/lib/checkinClientToken.ts — rate-limit key only, never persisted. */
  clientToken?: string;
}

interface BoxLookupRow {
  id: string;
  name: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: boxId } = await params;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: AdoptPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const turnstileKey = resolveBoxTurnstileKey(body.turnstileKey);
  const rateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!rateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }
  const turnstileValid = await verifyBoxTurnstile(body.turnstileToken, turnstileKey, ip);
  if (!turnstileValid) {
    logFormFailure("adopt", "turnstile_failed");
    return NextResponse.json({ ok: false, error: "turnstile_failed" }, { status: 400 });
  }

  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }); // bots think it worked
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const clientToken = typeof body.clientToken === "string" ? body.clientToken.slice(0, 200) : null;
  if (clientToken) {
    const visitorCap = await checkAndIncrement(
      db,
      rateLimitSecret,
      { scope: "adopt-visitor", id: `${clientToken}:${boxId}` },
      MAX_ADOPT_APPLICATIONS_PER_VISITOR_PER_HOUR,
    );
    if (!visitorCap) {
      return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
    }
  }

  const boxCap = await checkAndIncrement(
    db,
    rateLimitSecret,
    { scope: "adopt-box", id: boxId },
    MAX_ADOPT_APPLICATIONS_PER_BOX_PER_HOUR,
  );
  if (!boxCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_box" }, { status: 429 });
  }

  // Keyed off the raw (lowercased) submitted email, BEFORE format
  // validation — an empty/garbage value just shares one harmless bucket, and
  // running this before validation matches the task's own literal guard
  // order (rate limits -> validation).
  const emailKey = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const emailTargetCap = await checkAndIncrement(
    db,
    rateLimitSecret,
    { scope: "alert-email-target", id: emailKey },
    MAX_EMAIL_TARGET_PER_HOUR,
  );
  if (!emailTargetCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_email" }, { status: 429 });
  }

  const globalCap = await checkAndIncrement(
    db,
    rateLimitSecret,
    { scope: "alert-email-global", id: "global" },
    MAX_EMAIL_GLOBAL_PER_HOUR,
  );
  if (!globalCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_global" }, { status: 429 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName || displayName.length > FIELD_LIMITS.BOX_ADOPTER_DISPLAY_NAME) {
    return NextResponse.json({ ok: false, error: "Invalid display name" }, { status: 422 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > FIELD_LIMITS.EMAIL || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 422 });
  }

  let note: string | null = null;
  if (typeof body.note === "string" && body.note.trim() !== "") {
    const trimmed = body.note.trim();
    if (trimmed.length > FIELD_LIMITS.BOX_ADOPTER_NOTE) {
      return NextResponse.json({ ok: false, error: "Note too long" }, { status: 422 });
    }
    note = trimmed;
  }

  const box = await db
    .prepare("SELECT id, name FROM venues WHERE id = ? AND category = 'blessing_box' AND status != 'archived'")
    .bind(boxId)
    .first<BoxLookupRow>();
  if (!box) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let confirmToken: string;
  try {
    ({ confirmToken } = await insertAdopterApplication(db, { venueId: boxId, displayName, email, note }));
  } catch (err) {
    logFormFailure("adopt", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  try {
    await sendAdopterConfirmEmail({ to: email, boxName: box.name, origin: resolveEmailOrigin(req), confirmToken });
  } catch (err) {
    // Fatal per the task's own spec — see this file's header. The row
    // stays (it's a real, reviewable application either way), but the
    // applicant sees a real error rather than a false "check your email."
    logFormFailure("adopt", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
