/**
 * POST /events/share/submit — the public "Share an event" form (#883).
 *
 * Same shape as /suggest/submit: parsePublicPost (Content-Type, Turnstile,
 * honeypot, D1) → checkFormRateLimit (5/hour per IP and 50/hour site-wide,
 * scope "event") → validateEventSubmission (the admin form's caps, link rule
 * and Pueblo-time conversion) → check the optional flyer → insert an
 * event_submissions row → email the suggestions inbox.
 *
 * Flyer: the form uploads it first (POST /events/share/flyer) and sends the
 * returned key as `flyer_key`. It must have the pending-key shape and exist
 * in EVENT_FLYERS; its width and height are read here from the stored bytes
 * (never client-reported) so the admin's convert can copy them as they are.
 *
 * WHY the D1 insert is required here (suggest's is best-effort): the row IS
 * the review queue. The admin's "Make it a draft event" copies from it, so an
 * email with no row behind it could not be turned into an event. A failed
 * insert fails the submission so the sender can retry; the email is the
 * best-effort part (a Resend outage still leaves the row in the admin list).
 *
 * Nothing sent here is ever on the map: the row waits for an admin. PII
 * rules for the sender's email: migrations/0027_event_submissions.sql.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkFormRateLimit } from "@/lib/formRateLimit";
import { logFormFailure } from "@/lib/logger";
import { parsePublicPost } from "@/lib/publicRequest";
import { sendResendEmail } from "@/lib/emailSend";
import { validateEventSubmission, type EventSubmissionPayload } from "@/lib/adminEventValidation";
import { formatEventWhen } from "@/lib/eventTime";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { inspectFlyer, PENDING_FLYER_KEY_RE, type InspectedFlyer } from "@/lib/eventFlyers";

interface SubmitBody {
  website?: string;
  turnstileToken?: string;
  [key: string]: unknown;
}

/** CR/LF out of anything that reaches the subject line. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

async function sendEventEmail(p: EventSubmissionPayload, submitterName: string, submitterEmail: string, hasFlyer: boolean): Promise<void> {
  const lines = [
    `Event: ${p.name}`,
    `Host: ${p.host}`,
    `Starts: ${formatEventWhen(p.startsAt)} (Pueblo time)`,
    `Ends: ${formatEventWhen(p.endsAt)} (Pueblo time)`,
    ...(p.venueName ? [`Place: ${p.venueName}`] : []),
    `Address: ${p.address}`,
    ...(p.linkUrl ? [`Link: ${p.linkUrl} (button: ${p.linkLabel})`] : []),
    `Flyer: ${hasFlyer ? "yes" : "no"}`,
    ``,
    `What is it?`,
    p.description,
    ...(p.whatToBring ? [``, `What to bring:`, p.whatToBring] : []),
    ``,
    `Sent by: ${submitterName} <${submitterEmail}>`,
    ``,
    `Review it on the Events tab: https://pueblofoodmap.com/admin/events`,
  ];
  await sendResendEmail({
    to: "suggestions@pueblofoodmap.com",
    subject: `[PFM Event] ${oneLine(p.name)}`,
    text: lines.join("\n"),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const pre = await parsePublicPost<SubmitBody>(req, "event", "managed");
  if (pre instanceof NextResponse) return pre;
  const { body, ip, db, rateLimitSecret } = pre;

  if (!(await checkFormRateLimit(db, rateLimitSecret, "event", ip))) {
    return NextResponse.json({ ok: false, error: "rate_limit" }, { status: 429 });
  }

  const v = validateEventSubmission(body);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: "invalid", errors: v.errors }, { status: 422 });
  }

  let flyer: { key: string; inspected: InspectedFlyer } | null = null;
  if (body.flyer_key) {
    const key = body.flyer_key;
    const object =
      typeof key === "string" && PENDING_FLYER_KEY_RE.test(key)
        ? await getCloudflareContext().env.EVENT_FLYERS.get(key)
        : null;
    const inspected = object ? inspectFlyer(await object.arrayBuffer()) : null;
    if (!inspected) {
      return NextResponse.json({ ok: false, error: "invalid", errors: { flyer: "Add the flyer again." } }, { status: 422 });
    }
    flyer = { key: key as string, inspected };
  }

  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO event_submissions (id, payload, submitter_name, submitter_email, flyer_key, flyer_width, flyer_height)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, JSON.stringify(v.payload), v.submitterName, v.submitterEmail,
        flyer?.key ?? null, flyer?.inspected.width ?? null, flyer?.inspected.height ?? null,
      )
      .run();
  } catch (err) {
    logFormFailure("event", "db_write_failed", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  try {
    await sendEventEmail(v.payload, v.submitterName, v.submitterEmail, flyer !== null);
  } catch (err) {
    // Best-effort: the row is already in the admin list (see header).
    logFormFailure("event", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
  }

  return NextResponse.json({ ok: true });
}
