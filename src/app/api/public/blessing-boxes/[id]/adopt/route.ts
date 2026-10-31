/**
 * POST /api/public/blessing-boxes/[id]/adopt — apply to adopt a box
 * (Blessing Boxes slice 6). Writes a pending, unconfirmed application
 * immediately; nothing about it is public ("Cared for by ...") until BOTH
 * the applicant confirms their email (POST /api/public/alerts/confirm) AND
 * an admin approves it (/admin/boxes?show=review).
 *
 * Guard ORDER, same shared convention as every other public write on this
 * box surface (see the checkins route's own header): Content-Type ->
 * Turnstile (src/lib/boxTurnstile.ts, reused, not copied) -> honeypot ->
 * per-visitor/per-box rate limit -> field validation -> box lookup ->
 * email-flood rate limit -> write -> confirm email.
 *
 * 2026-09-18 security review, item 5: the two email-flood scopes
 * (alert-email-target/alert-email-global, checked by
 * checkAlertEmailFloodCaps in src/lib/boxAlerts.ts, which this route shares
 * with the giver alert route) used to run BEFORE field
 * validation and the box lookup, alongside the per-visitor/per-box caps —
 * so a burst of requests with an INVALID displayName/email/note, or an
 * unknown box id, still counted against the shared email-abuse budget even
 * though no email was ever going to be sent. Moved to run immediately
 * before the write/send below (the only place they still guard something
 * real) — the per-visitor/per-box scopes stay where they were, since those
 * exist to cap the WRITE attempt itself, not the email. The site-wide cap
 * was also raised 60 -> 300 in item 5; the reason sits next to the constant
 * in boxAlerts.ts.
 *
 * A confirm-email send failure is FATAL to the response here (unlike the
 * checkins route's best-effort problem-report email) — per the task's own
 * spec: "Resend failure -> row stays, respond error." The application row is
 * already durable at that point, but the applicant sees a real error rather
 * than a false "check your email."
 *
 * Single-language alert emails: `lang` is resolved strictly (resolveEmailLang,
 * src/lib/i18n.ts — anything but the literal "es" becomes "en") and stored
 * on the new box_adopters row; the confirm email above renders in ONLY that
 * language. AdoptBoxForm.tsx sends its own current locale.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { logFormFailure } from "@/lib/logger";
import { insertAdopterApplication, sendAdopterConfirmEmail } from "@/lib/boxAdopters";
import { checkAlertEmailFloodCaps } from "@/lib/boxAlerts";
import { sanitizeDisplayName } from "@/lib/displayNameHygiene";
import { resolveEmailLang } from "@/lib/i18n";
import { parsePublicPost } from "@/lib/publicRequest";
import { loadLiveBoxName } from "@/lib/blessingBoxes";

export const dynamic = "force-dynamic";

const MAX_ADOPT_APPLICATIONS_PER_VISITOR_PER_HOUR = 3;
const MAX_ADOPT_APPLICATIONS_PER_BOX_PER_HOUR = 10;

interface AdoptPayload {
  displayName?: string;
  email?: string;
  note?: string;
  /** The UI locale the page was in at submission — resolveEmailLang() below is strict, so anything but the literal "es" becomes "en". */
  lang?: string;
  /** Honeypot — must be empty string or absent, same convention as every other public form route. */
  website?: string;
  turnstileToken?: string;
  turnstileKey?: string;
  /** Opaque, non-identifying per-browser token from src/lib/checkinClientToken.ts — rate-limit key only, never persisted. */
  clientToken?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: boxId } = await params;

  // Content-Type, JSON, Turnstile (box key or its fallback), honeypot, D1 and
  // the rate-limit secret — shared with the form routes (src/lib/publicRequest.ts).
  const pre = await parsePublicPost<AdoptPayload>(req, "adopt", "box");
  if (pre instanceof NextResponse) return pre;
  const { body, db, rateLimitSecret } = pre;

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

  // Normalized ONCE here (item 3) — reused below for validation, the
  // email-flood rate-limit key, and storage, so "Foo@X.com" and
  // "foo@x.com" are always the same row (boxAdopters.ts's own lookups never
  // re-derive this).
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  const lang = resolveEmailLang(body.lang);

  const rawDisplayName = typeof body.displayName === "string" ? body.displayName : "";
  const displayName = sanitizeDisplayName(rawDisplayName);
  if (!displayName || displayName.length > FIELD_LIMITS.BOX_ADOPTER_DISPLAY_NAME) {
    return NextResponse.json({ ok: false, error: "Invalid display name" }, { status: 422 });
  }

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

  let boxName: string | null;
  try {
    boxName = await loadLiveBoxName(db, boxId);
  } catch (err) {
    logFormFailure("adopt", "db_unavailable", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 502 });
  }
  if (boxName === null) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Email-flood scopes moved here (item 5, see this file's own header) —
  // only a request that already passed field validation and found a live
  // box reaches these, since only such a request is ever actually going to
  // send an email.
  const floodCap = await checkAlertEmailFloodCaps(db, rateLimitSecret, email);
  if (floodCap) {
    return NextResponse.json({ ok: false, error: floodCap }, { status: 429 });
  }

  let confirmToken: string;
  try {
    ({ confirmToken } = await insertAdopterApplication(db, { venueId: boxId, displayName, email, note, lang }));
  } catch (err) {
    logFormFailure("adopt", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  try {
    await sendAdopterConfirmEmail({ to: email, boxName, origin: resolveEmailOrigin(req), confirmToken, lang });
  } catch (err) {
    // Fatal per the task's own spec — see this file's header. The row
    // stays (it's a real, reviewable application either way), but the
    // applicant sees a real error rather than a false "check your email."
    logFormFailure("adopt", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
