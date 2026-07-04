/**
 * POST /report/submit
 *
 * Handles venue issue reports from ReportForm:
 *   1. Validate Content-Type + JSON shape.
 *   2. Cloudflare Turnstile token verification (rejects bots before further processing).
 *   3. Honeypot check (spam bots fill hidden fields; legit users don't).
 *   4. IP-based rate limit: max 5 submissions per IP per hour (in-process
 *      Map — resets on Worker restart; sufficient for v1 spam deterrence).
 *   5. Server-side field validation (mirrors client validation).
 *   6. Insert a pending row into public_submissions (#258) — best-effort; a
 *      D1 failure here is logged (db_write_failed) and does NOT block the
 *      email or fail the submission (see insertPublicSubmission below).
 *   7. Send email via Resend to issues@pueblofoodmap.com.
 *   8. Return JSON {ok: true} or {ok: false, error: string}.
 *
 * PII policy: IP addresses are used only for rate-limiting and are never
 * logged or persisted. The optional contact email is forwarded to Resend as
 * part of the email body, and, since #258, also persisted in the
 * public_submissions D1 row (submitter_email column + inside payload, when
 * provided) for admin review — it is still never written to a log line by
 * this handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createRateLimiter, EMAIL_RE } from "@/lib/rateLimit";
import { venues } from "@/data/venues";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { logFormFailure } from "@/lib/logger";
import { insertPublicSubmission } from "@/lib/publicSubmissions";

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Private in-process sliding window for this route (own 5/hr-per-IP bucket).

export const checkRateLimit = createRateLimiter();

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendReportEmail(payload: {
  venueId: string;
  venueName: string;
  venueAddress: string;
  issueType: IssueTypeKey;
  description: string;
  contactEmail?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const issueLabel =
    ISSUE_TYPES[payload.issueType] ?? payload.issueType;

  const lines: string[] = [
    `Venue: ${payload.venueName}`,
    `Venue ID: ${payload.venueId}`,
    `Address: ${payload.venueAddress}`,
    `Issue type: ${issueLabel}`,
    ``,
    `Description:`,
    payload.description,
  ];

  if (payload.contactEmail) {
    lines.push(``);
    lines.push(`Reporter contact: ${payload.contactEmail}`);
  }

  const emailBody = lines.join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Pueblo Food Map <noreply@pueblofoodmap.com>",
      to: ["issues@pueblofoodmap.com"],
      subject: `[PFM Report] ${payload.venueName} — ${issueLabel}`,
      text: emailBody,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface SubmitPayload {
  venueId: string;
  // venueName intentionally absent: the server looks it up from venueId so the
  // client cannot inject arbitrary text into the email subject line (issue #160 1.3).
  issueType: string;
  description: string;
  contactEmail?: string;
  /** Honeypot — must be empty string or absent */
  website?: string;
  /** Cloudflare Turnstile response token from the client widget */
  turnstileToken?: string;
}

/** Strip CR and LF from a string to prevent header/subject line injection. */
function stripLineBreaks(s: string): string {
  return s.replace(/[\r\n]/g, " ");
}

function validate(body: SubmitPayload): string | null {
  if (!body.venueId || typeof body.venueId !== "string") {
    return "Missing venueId";
  }
  // Server-side venue lookup: reject unknown IDs so the client cannot supply
  // an arbitrary venue name that flows into the email subject line.
  const venue = venues.find((v) => v.id === body.venueId);
  if (!venue) {
    return "Unknown venueId";
  }
  if (!body.issueType || !(body.issueType in ISSUE_TYPES)) {
    return "Invalid issue type";
  }
  if (
    !body.description ||
    typeof body.description !== "string" ||
    body.description.trim().length < 10
  ) {
    return "Description must be at least 10 characters";
  }
  if (body.description.length > FIELD_LIMITS.REPORT_DESCRIPTION) {
    return `Description must be ${FIELD_LIMITS.REPORT_DESCRIPTION} characters or fewer`;
  }
  if (body.contactEmail && body.contactEmail.length > FIELD_LIMITS.EMAIL) {
    return "Email address too long";
  }
  if (body.contactEmail && !EMAIL_RE.test(body.contactEmail)) {
    return "Invalid email format";
  }
  return null; // valid
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Content-Type guard
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: SubmitPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // IP header — used for both Turnstile remoteip and rate-limit
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // Turnstile verification — must pass before any further processing
  // Throw instead of silently falling back to "": an empty secret makes
  // Cloudflare's siteverify accept the always-pass test sitekey from anyone.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    throw new Error("TURNSTILE_SECRET_KEY not configured");
  }
  const turnstileValid = await verifyTurnstileToken(
    body.turnstileToken,
    turnstileSecret,
    ip,
  );
  if (!turnstileValid) {
    logFormFailure("report", "turnstile_failed");
    return NextResponse.json(
      { ok: false, error: "turnstile_failed" },
      { status: 400 },
    );
  }

  // Honeypot check — bots fill hidden fields; humans don't
  if (body.website && body.website.trim() !== "") {
    // Return 200 to bots so they think it worked
    return NextResponse.json({ ok: true });
  }

  // IP-based rate limit
  if (!checkRateLimit(ip)) {
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

  // Resolve venue server-side (already validated above; re-find for the send call).
  // We do NOT use body.venueName — the client cannot supply the venue name that
  // flows into the email subject line (prevents header injection, issue #160 1.3).
  const venue = venues.find((v) => v.id === body.venueId)!;

  // Sanitized fields shared by the D1 queue row and the outgoing email —
  // computed once so the two can never drift apart.
  const sanitized = {
    venueId: body.venueId,
    venueName: stripLineBreaks(venue.name),
    venueAddress: stripLineBreaks(venue.address),
    issueType: body.issueType as IssueTypeKey,
    description: stripLineBreaks(body.description.trim()),
    contactEmail: body.contactEmail ? stripLineBreaks(body.contactEmail) : undefined,
  };

  // #258: best-effort durable queue row. A D1 outage must never block the
  // email or fail the user's submission — caught and logged here, then
  // execution continues to the (unchanged) email send below either way.
  try {
    const { env } = getCloudflareContext();
    await insertPublicSubmission(env.ADMIN_DB, {
      kind: "closure",
      payload: sanitized,
      targetVenueId: sanitized.venueId,
      submitterEmail: sanitized.contactEmail ?? null,
    });
  } catch (err) {
    logFormFailure("report", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
  }

  // Send email — no PII logging; contact email goes only to Resend
  try {
    await sendReportEmail(sanitized);
  } catch (err) {
    // Structured log: error type/message only — no PII (no body, IP, or email)
    logFormFailure("report", "send_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
