/**
 * POST /api/public/blessing-boxes/[id]/alerts — a giver subscribes to email
 * alerts for ONE specific box ("near me" v1 — no radius, no stored
 * location; see AGENTS.md's Blessing Boxes slice 6 section). Blessing Boxes
 * slice 6.
 *
 * Guard ORDER, same shared convention as the adopt route (see that file's
 * own header): Content-Type -> Turnstile -> honeypot -> per-visitor rate
 * limit -> field validation -> box lookup -> email-flood rate limit ->
 * write -> confirm email. The email-flood scopes
 * (alert-email-target/alert-email-global) are SHARED with the adopt route —
 * a flood of signups (this route) and adoption applications (../adopt) both
 * draw from one combined email-abuse budget. 2026-09-18 security review,
 * item 5: those two scopes moved to run just before the write/send (after
 * validation finds a real email and the box lookup finds a real box),
 * exactly like the adopt route's own item-5 fix — see that file's header
 * for the full reasoning, which applies identically here.
 *
 * Upsert semantics (new / resend / noop / reactivate) live in
 * src/lib/boxAlerts.ts's upsertGiverSubscription — every branch returns the
 * SAME generic {ok:true} response here, per the task's own spec, so a
 * caller can never learn from the response alone whether an address was
 * already subscribed.
 *
 * 2026-09-18 security review, item 4: the confirm-email send used to be
 * awaited inline, with a Resend failure turning into a 502 the caller could
 * see — a TIMING ORACLE, since "new"/"resend"/"reactivate" all had to wait
 * on a real Resend round-trip while "noop" (address already confirmed and
 * active) returned instantly, letting a caller distinguish "already
 * subscribed" from "not yet" purely by response latency despite the
 * response BODY being identical on every branch. Fixed by dispatching the
 * send via ctx.waitUntil() (same pattern boxAlerts.ts's notifyBoxAlerts
 * already uses from the checkins route, mirrored here) so every branch
 * returns at the same speed with the same generic body — a failed send is
 * now caught and logged (recipient count only — see logFormFailure below),
 * never surfaced to the caller. The adopt route deliberately KEEPS its
 * synchronous, fatal send (a single, non-enumerable applicant email, and
 * the task's own spec requires a real error there) — this route's signup
 * is the one an anonymous caller could probe repeatedly against many
 * addresses, which is what makes the timing side-channel real here and not
 * there.
 *
 * Single-language alert emails: `lang` is resolved strictly (resolveEmailLang,
 * src/lib/i18n.ts — anything but the literal "es" becomes "en"). On a
 * resend/reactivate this OVERWRITES the row's stored lang with whatever was
 * just submitted (upsertForExistingGiverRow's own header) — the confirm
 * email above renders in ONLY that language. BoxAlertSignupForm.tsx sends
 * its own current locale.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { logFormFailure } from "@/lib/logger";
import { sendGiverConfirmEmail, upsertGiverSubscription } from "@/lib/boxAlerts";
import { resolveEmailLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const MAX_ALERT_SIGNUPS_PER_VISITOR_PER_HOUR = 5;
/** Shared with the adopt-a-box route — see this file's own header. */
const MAX_EMAIL_TARGET_PER_HOUR = 3;
const MAX_EMAIL_GLOBAL_PER_HOUR = 300;

interface AlertSignupPayload {
  email?: string;
  /** The UI locale the page was in at submission — resolveEmailLang() below is strict, so anything but the literal "es" becomes "en". */
  lang?: string;
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

  // Normalized ONCE here (item 3) — reused below for validation, the
  // email-flood rate-limit key, and storage.
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!email || email.length > FIELD_LIMITS.EMAIL || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 422 });
  }
  const lang = resolveEmailLang(body.lang);

  let box: BoxLookupRow | null;
  try {
    box = await db
      .prepare("SELECT id, name FROM venues WHERE id = ? AND category = 'blessing_box' AND status != 'archived'")
      .bind(boxId)
      .first<BoxLookupRow>();
  } catch (err) {
    logFormFailure("alerts", "db_unavailable", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 502 });
  }
  if (!box) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Email-flood scopes moved here (item 5, see this file's own header).
  const emailTargetCap = await checkAndIncrement(
    db,
    rateLimitSecret,
    { scope: "alert-email-target", id: email },
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

  let action: Awaited<ReturnType<typeof upsertGiverSubscription>>["action"];
  let confirmToken: string | null;
  try {
    ({ action, confirmToken } = await upsertGiverSubscription(db, { venueId: boxId, email, lang }, new Date()));
  } catch (err) {
    logFormFailure("alerts", "db_unavailable", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 502 });
  }

  // Dispatched via ctx.waitUntil(), never awaited — see this file's own
  // header, item 4: awaiting here would make the "noop" branch (no email
  // sent) answer faster than every other branch, a timing oracle revealing
  // whether an address was already subscribed despite the identical
  // response body below.
  if (action !== "noop" && confirmToken) {
    const emailPromise = sendGiverConfirmEmail({
      to: email,
      boxName: box.name,
      origin: resolveEmailOrigin(req),
      confirmToken,
      lang,
    }).catch((err) => {
      logFormFailure("alerts", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
    });
    try {
      getCloudflareContext().ctx.waitUntil(emailPromise);
    } catch {
      // No live ExecutionContext (local dev / a test harness) — the promise
      // above still runs on its own and is already caught; nothing further
      // to do here.
    }
  }

  // Same generic response on EVERY branch (new/resend/noop/reactivate),
  // and now at the same SPEED too (item 4) — see this file's own header.
  return NextResponse.json({ ok: true });
}
