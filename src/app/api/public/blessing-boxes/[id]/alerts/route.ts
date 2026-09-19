/**
 * POST /api/public/blessing-boxes/[id]/alerts — a giver subscribes to email
 * alerts for ONE specific box ("near me" v1 — no radius, no stored
 * location; see AGENTS.md's Blessing Boxes slice 6 section). Blessing Boxes
 * slice 6.
 *
 * Same guard ORDER as the adopt route (see that file's own header) and the
 * same shared "alert-email-target"/"alert-email-global" rate-limit scopes —
 * a flood of signups (this route) and adoption applications (../adopt) both
 * draw from one combined email-abuse budget.
 *
 * Upsert semantics (new / resend / noop / reactivate) live in
 * src/lib/boxAlerts.ts's upsertGiverSubscription — every branch returns the
 * SAME generic {ok:true} response here, per the task's own spec, so a
 * caller can never learn from the response alone whether an address was
 * already subscribed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { isValidEmail } from "@/lib/rateLimit";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { logFormFailure } from "@/lib/logger";
import { sendGiverConfirmEmail, upsertGiverSubscription } from "@/lib/boxAlerts";

export const dynamic = "force-dynamic";

const MAX_ALERT_SIGNUPS_PER_VISITOR_PER_HOUR = 5;
/** Shared with the adopt-a-box route — see this file's own header. */
const MAX_EMAIL_TARGET_PER_HOUR = 3;
const MAX_EMAIL_GLOBAL_PER_HOUR = 60;

interface AlertSignupPayload {
  email?: string;
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

  let body: AlertSignupPayload;
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
    logFormFailure("alerts", "turnstile_failed");
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
      { scope: "alert-visitor", id: `${clientToken}:${boxId}` },
      MAX_ALERT_SIGNUPS_PER_VISITOR_PER_HOUR,
    );
    if (!visitorCap) {
      return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
    }
  }

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

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > FIELD_LIMITS.EMAIL || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 422 });
  }

  const box = await db
    .prepare("SELECT id, name FROM venues WHERE id = ? AND category = 'blessing_box' AND status != 'archived'")
    .bind(boxId)
    .first<BoxLookupRow>();
  if (!box) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { action, confirmToken } = await upsertGiverSubscription(db, { venueId: boxId, email }, new Date());

  if (action !== "noop" && confirmToken) {
    try {
      await sendGiverConfirmEmail({ to: email, boxName: box.name, origin: resolveEmailOrigin(req), confirmToken });
    } catch (err) {
      logFormFailure("alerts", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }
  }

  // Same generic response on EVERY branch (new/resend/noop/reactivate) —
  // see this file's own header.
  return NextResponse.json({ ok: true });
}
