/**
 * POST /suggest/submit
 *
 * Handles venue suggestion submissions from SuggestForm:
 *   1. Validate Content-Type + JSON shape.
 *   2. Cloudflare Turnstile token verification (rejects bots before further processing).
 *   3. Honeypot check (spam bots fill hidden fields; legit users don't).
 *   4. IP-based rate limit: max 5 submissions per IP per hour (in-process
 *      Map — resets on Worker restart; sufficient for v1 spam deterrence).
 *   5. Server-side field validation (mirrors client validation).
 *   6. Send email via Resend to suggestions@pueblofoodmap.com.
 *   7. Return JSON {ok: true} or {ok: false, error: string}.
 *
 * PII policy: IP addresses are used only for rate-limiting and are never
 * logged or persisted. The optional submitter email is forwarded to Resend as
 * part of the email body and is NOT logged by this handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { VENUE_CATEGORIES, type VenueCategoryKey } from "@/lib/suggestTypes";
import { verifyTurnstileToken } from "@/lib/turnstile";

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Simple in-process sliding window. Keyed by IP string.
// Resets when the Worker cold-starts. Good enough for v1.

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  entry.count += 1;
  return true; // allowed
}

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendSuggestionEmail(payload: {
  venueName: string;
  address: string;
  category: VenueCategoryKey;
  hours?: string;
  contact?: string;
  acceptsSnap: boolean;
  acceptsWic: boolean;
  notes?: string;
  submitterEmail?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const categoryLabel =
    VENUE_CATEGORIES[payload.category] ?? payload.category;

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

  if (payload.submitterEmail) {
    lines.push(``);
    lines.push(`Submitter contact: ${payload.submitterEmail}`);
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
      to: ["suggestions@pueblofoodmap.com"],
      subject: `[PFM Suggest] ${payload.venueName} — ${categoryLabel}`,
      text: emailBody,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SubmitPayload {
  venueName: string;
  address: string;
  category: string;
  hours?: string;
  contact?: string;
  acceptsSnap?: boolean;
  acceptsWic?: boolean;
  notes?: string;
  submitterEmail?: string;
  /** Honeypot — must be empty string or absent */
  website?: string;
  /** Cloudflare Turnstile response token from the client widget */
  turnstileToken?: string;
}

function validate(body: SubmitPayload): string | null {
  if (!body.venueName || typeof body.venueName !== "string" || !body.venueName.trim()) {
    return "Missing venue name";
  }
  if (!body.address || typeof body.address !== "string" || !body.address.trim()) {
    return "Missing address";
  }
  if (!body.category || !(body.category in VENUE_CATEGORIES)) {
    return "Invalid category";
  }
  if (body.submitterEmail && !EMAIL_RE.test(body.submitterEmail)) {
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
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY ?? "";
  const turnstileValid = await verifyTurnstileToken(
    body.turnstileToken,
    turnstileSecret,
    ip,
  );
  if (!turnstileValid) {
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

  // Send email — no PII logging; submitter email goes only to Resend
  try {
    await sendSuggestionEmail({
      venueName: body.venueName.trim(),
      address: body.address.trim(),
      category: body.category as VenueCategoryKey,
      hours: body.hours || undefined,
      contact: body.contact || undefined,
      acceptsSnap: Boolean(body.acceptsSnap),
      acceptsWic: Boolean(body.acceptsWic),
      notes: body.notes || undefined,
      submitterEmail: body.submitterEmail || undefined,
    });
  } catch (err) {
    // Log the error type/status only — not the body which may contain PII
    console.error(
      "[suggest/submit] Email send failed:",
      err instanceof Error ? err.message : "unknown error",
    );
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
