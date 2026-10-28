/**
 * POST /suggest/submit
 *
 * Handles venue suggestion submissions from SuggestForm:
 *   1. Validate Content-Type + JSON shape.
 *   2. Cloudflare Turnstile token verification (rejects bots before further processing).
 *   3. Honeypot check (spam bots fill hidden fields; legit users don't).
 *   4. D1-backed rate limit (#587): 5/hour per IP AND a site-wide cap per
 *      hour, both via src/lib/formRateLimit.ts's checkFormRateLimit — see
 *      that file's header for why (the old in-process Map was per-isolate
 *      and rarely actually applied on Workers).
 *   5. Server-side field validation (mirrors client validation).
 *   6. Insert a pending row into public_submissions (#258) — best-effort; a
 *      D1 failure here is logged (db_write_failed) and does NOT block the
 *      email or fail the submission (see insertPublicSubmission below).
 *   7. Send email via Resend to suggestions@pueblofoodmap.com.
 *   8. Return JSON {ok: true} or {ok: false, error: string}.
 *
 * PII policy: IP addresses are used only for rate-limiting and are never
 * logged or persisted. The required submitter email is forwarded to Resend
 * as part of the email body, and, since #258, also persisted in the
 * public_submissions D1 row (submitter_email column + inside payload) for
 * admin review — it is still never written to a log line by this handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { categoryLabels } from "@/lib/categories";
import type { VenueCategory } from "@/types/venue";
import { isValidEmail } from "@/lib/email";
import { checkFormRateLimit } from "@/lib/formRateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { logFormFailure } from "@/lib/logger";
import { parsePublicPost } from "@/lib/publicRequest";
import { sendResendEmail } from "@/lib/emailSend";
import { insertPublicSubmission } from "@/lib/publicSubmissions";

/** Strip CR and LF from a string to prevent header/subject line injection. */
function stripLineBreaks(s: string): string {
  return s.replace(/[\r\n]/g, " ");
}

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendSuggestionEmail(payload: {
  venueName: string;
  address: string;
  category: VenueCategory;
  hours?: string;
  contact?: string;
  acceptsSnap: boolean;
  acceptsWic: boolean;
  notes?: string;
  submitterEmail: string;
}): Promise<void> {
  const categoryLabel = categoryLabels[payload.category] ?? payload.category;

  const lines: string[] = [
    `Venue name: ${payload.venueName}`,
    `Address: ${payload.address}`,
    `Category: ${categoryLabel}`,
  ];

  if (payload.hours) {
    lines.push(`Hours: ${payload.hours}`);
  }

  if (payload.contact) {
    lines.push(`Contact: ${payload.contact}`);
  }

  lines.push(`Accepts SNAP: ${payload.acceptsSnap ? "Yes" : "No"}`);
  lines.push(`Accepts WIC: ${payload.acceptsWic ? "Yes" : "No"}`);

  if (payload.notes) {
    lines.push(``);
    lines.push(`Notes:`);
    lines.push(payload.notes);
  }

  lines.push(``);
  lines.push(`Submitter contact: ${payload.submitterEmail}`);

  const emailBody = lines.join("\n");

  await sendResendEmail({ to: "suggestions@pueblofoodmap.com", subject: `[PFM Suggest] ${payload.venueName} — ${categoryLabel}`, text: emailBody });
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface SubmitPayload {
  venueName: string;
  address: string;
  category: string;
  hours?: string;
  contact?: string;
  acceptsSnap?: boolean;
  acceptsWic?: boolean;
  notes?: string;
  submitterEmail: string;
  /** Honeypot — must be empty string or absent */
  website?: string;
  /** Cloudflare Turnstile response token from the client widget */
  turnstileToken?: string;
}

function validate(body: SubmitPayload): string | null {
  if (!body.venueName || typeof body.venueName !== "string" || !body.venueName.trim()) {
    return "Missing venue name";
  }
  if (body.venueName.length > FIELD_LIMITS.SUGGEST_VENUE_NAME) {
    return `Venue name must be ${FIELD_LIMITS.SUGGEST_VENUE_NAME} characters or fewer`;
  }
  if (!body.address || typeof body.address !== "string" || !body.address.trim()) {
    return "Missing address";
  }
  if (body.address.length > FIELD_LIMITS.SUGGEST_ADDRESS) {
    return `Address must be ${FIELD_LIMITS.SUGGEST_ADDRESS} characters or fewer`;
  }
  // Object.hasOwn, not `in`: `in` also matches Object.prototype keys, so
  // "constructor" or "toString" used to pass as a category.
  if (typeof body.category !== "string" || !Object.hasOwn(categoryLabels, body.category)) {
    return "Invalid category";
  }
  if (body.hours && body.hours.length > FIELD_LIMITS.SUGGEST_HOURS) {
    return `Hours must be ${FIELD_LIMITS.SUGGEST_HOURS} characters or fewer`;
  }
  if (body.contact && body.contact.length > FIELD_LIMITS.SUGGEST_CONTACT) {
    return `Contact must be ${FIELD_LIMITS.SUGGEST_CONTACT} characters or fewer`;
  }
  if (body.notes && body.notes.length > FIELD_LIMITS.SUGGEST_NOTES) {
    return `Notes must be ${FIELD_LIMITS.SUGGEST_NOTES} characters or fewer`;
  }
  // #232: submitterEmail is required (was optional) — never trust the client's
  // required-field enforcement, so this mirrors feedback/submit/route.ts's check.
  if (!body.submitterEmail || typeof body.submitterEmail !== "string" || !body.submitterEmail.trim()) {
    return "Missing email";
  }
  if (body.submitterEmail.length > FIELD_LIMITS.EMAIL) {
    return "Email address too long";
  }
  if (!isValidEmail(body.submitterEmail)) {
    return "Invalid email format";
  }
  return null; // valid
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Content-Type, JSON, Turnstile, honeypot, D1 and the rate-limit secret —
  // shared with the box routes (src/lib/publicRequest.ts).
  const pre = await parsePublicPost<SubmitPayload>(req, "suggest", "managed");
  if (pre instanceof NextResponse) return pre;
  const { body, ip, db, rateLimitSecret } = pre;

  if (!(await checkFormRateLimit(db, rateLimitSecret, "suggest", ip))) {
    return NextResponse.json(
      { ok: false, error: "rate_limit" },
      { status: 429 },
    );
  }

  // Server-side validation
  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json(
      { ok: false, error: validationError },
      { status: 422 },
    );
  }

  // Sanitized fields shared by the D1 queue row and the outgoing email —
  // computed once so the two can never drift apart.
  const sanitized = {
    venueName: stripLineBreaks(body.venueName.trim()),
    address: stripLineBreaks(body.address.trim()),
    category: body.category as VenueCategory,
    hours: body.hours ? stripLineBreaks(body.hours) : undefined,
    contact: body.contact ? stripLineBreaks(body.contact) : undefined,
    acceptsSnap: Boolean(body.acceptsSnap),
    acceptsWic: Boolean(body.acceptsWic),
    notes: body.notes ? stripLineBreaks(body.notes) : undefined,
    submitterEmail: stripLineBreaks(body.submitterEmail.trim()),
  };

  // #258: best-effort durable queue row. A D1 outage must never block the
  // email or fail the user's submission — caught and logged here, then
  // execution continues to the (unchanged) email send below either way.
  // Reuses the `db` binding already fetched above for the rate-limit check.
  try {
    await insertPublicSubmission(db, {
      kind: "new_venue",
      payload: sanitized,
      targetVenueId: null,
      submitterEmail: sanitized.submitterEmail,
    });
  } catch (err) {
    logFormFailure("suggest", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
  }

  // Send email — no PII logging; submitter email goes only to Resend
  try {
    await sendSuggestionEmail(sanitized);
  } catch (err) {
    // Structured log: error type/message only — no PII (no body, IP, or email)
    logFormFailure("suggest", "send_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
