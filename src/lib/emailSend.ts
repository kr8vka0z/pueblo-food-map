/**
 * emailSend.ts — shared Resend HTTP + single-language-email-composition
 * helpers for the adopt-a-box and email-alert flows (Blessing Boxes slice 6).
 *
 * WHY this exists: every other Resend send in this app (report/suggest/
 * feedback forms, check-in problem reports, photo moderation alerts) is a
 * one-off inline `fetch()` sending TEXT-ONLY mail to a single internal admin
 * address. This slice is the first to (a) send HTML mail to real site
 * visitors, (b) need the identical composition (in the recipient's OWN
 * language — see composeEmail's own header) across six different email
 * kinds (adopt confirm, adoption-approved, giver confirm, host welcome, and
 * the batched empty/low/problem alert), and (c) need Resend's BATCH endpoint
 * (up to 100 recipients per call) rather than one-at-a-time sends. One
 * shared module means those three things exist in exactly one place instead
 * of six near-identical copies.
 *
 * WHY single-language, not bilingual: every email here used to carry an
 * English block, then a Spanish block, in every message regardless of who
 * received it. Kyle's own call — a recipient should see the message in the
 * SAME language the page was in when they signed up (box_adopters.lang /
 * alert_subscriptions.lang, migrations/0011_alert_email_lang.sql), not a
 * doubled-length email half of which they can't read.
 */

import { t, type Locale } from "@/lib/i18n";
import { ALLOWED_HOSTS } from "@/lib/alertOrigin";

const FROM = "Pueblo Food Map <noreply@pueblofoodmap.com>";
/** Resend's own hard cap on a single POST /emails/batch call — sendResendBatch chunks anything larger. */
const RESEND_BATCH_MAX = 100;

const URL_RE = /(https?:\/\/[^\s<]+)/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** True when `urlText`'s origin is one this app actually generates outbound-email links for — the two real hostnames (ALLOWED_HOSTS, shared with alertOrigin.ts's resolveEmailOrigin) plus localhost for local dev. */
function isAllowedLinkOrigin(urlText: string): boolean {
  try {
    const url = new URL(urlText);
    return ALLOWED_HOSTS.includes(url.hostname) || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false; // not a parseable URL at all -> never a link
  }
}

/**
 * Escapes one already-interpolated line for HTML, then turns any embedded
 * URL whose origin is one of OUR OWN allowed hosts into a real anchor, so
 * the HTML part isn't just plain unclickable text.
 *
 * 2026-09-18 security review, item 12: this used to link EVERY https://
 * substring under the claim "never user input" — false. displayName (the
 * box-adoption applicant's own free-text name — sendAdopterApprovedEmail's
 * `vars`) is website-visitor-supplied, and this is a shared helper every
 * composeEmail caller in this file funnels through, present and
 * future — it can't assume every caller's vars are pre-vetted (item 11's
 * sanitizeDisplayName refusing an in-name URL at submission time closes
 * THAT one path, but doesn't make this function's own claim true in
 * general). Any URL-looking text whose origin isn't one of ours now stays
 * plain escaped text instead of becoming a clickable link.
 */
function htmlParagraph(line: string): string {
  const escaped = escapeHtml(line);
  return `<p>${escaped.replace(URL_RE, (match) => (isAllowedLinkOrigin(match) ? `<a href="${match}">${match}</a>` : match))}</p>`;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** RFC 8058 one-click unsubscribe headers — see unsubscribeHeaders() below. Every email this slice sends to a real subscriber carries these; the two internal admin-only notification emails (new adoption request, new photo/problem report) do not. */
  headers?: Record<string, string>;
}

/**
 * Builds a single-language subject/text/html triple from i18n.ts keys —
 * keeps every user-visible email string in the SAME dictionary (and parity
 * test) as the rest of the app's UI copy, rather than a seventh set of
 * hand-written strings living only in this file. `lang` picks ONE locale for
 * the whole message, subject included — the recipient's own
 * box_adopters.lang/alert_subscriptions.lang, captured at signup (this
 * file's own header). This REPLACES the old composeBilingualEmail, which
 * built an English block followed by a Spanish block in every message
 * regardless of the recipient — deleted rather than kept alongside this,
 * since nothing in this app sends bilingual mail anymore.
 */
export function composeEmail(opts: {
  lang: Locale;
  subjectKey: string;
  bodyLineKeys: string[];
  vars?: Record<string, string>;
}): { subject: string; text: string; html: string } {
  const vars = opts.vars ?? {};
  const subject = t(opts.subjectKey, opts.lang, vars);
  const lines = opts.bodyLineKeys.map((k) => t(k, opts.lang, vars));
  const text = lines.join("\n\n");
  const html = `<div>${lines.map(htmlParagraph).join("")}</div>`;
  return { subject, text, html };
}

/** RFC 8058 one-click unsubscribe headers pointing at the API stop route (never the human-facing /alerts/stop PAGE — a mail client's automated POST needs a route handler, not a Next.js page). */
export function unsubscribeHeaders(stopApiUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${stopApiUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Sends one email. Throws on a non-OK Resend response or a missing key — callers decide whether that's fatal (adopt/giver confirm, where the email IS the point of the request) or best-effort (welcome mail, admin notices). */
export async function sendResendEmail(email: OutboundEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/**
 * Sends a batch of emails via Resend's POST /emails/batch (each recipient
 * its own `to`, never several recipients combined into one `to` array —
 * the task's own requirement, so no recipient can see another's address).
 * Chunks into groups of RESEND_BATCH_MAX since Resend accepts at most 100
 * per call; boxAlerts.ts additionally caps total recipients per event at
 * 200 (two chunks), see that file's own header. Throws on the first failed
 * chunk — the caller (boxAlerts.ts's notifyBoxAlerts) wraps the whole send
 * in a try/catch, since an alert-email failure must never affect the
 * check-in that triggered it.
 */
export async function sendResendBatch(emails: OutboundEmail[]): Promise<void> {
  if (emails.length === 0) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  for (let i = 0; i < emails.length; i += RESEND_BATCH_MAX) {
    const chunk = emails.slice(i, i + RESEND_BATCH_MAX);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(
        chunk.map((e) => ({
          from: FROM,
          to: [e.to],
          subject: e.subject,
          text: e.text,
          html: e.html,
          headers: e.headers,
        })),
      ),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      throw new Error(`Resend batch API error ${res.status}: ${body}`);
    }
  }
}
