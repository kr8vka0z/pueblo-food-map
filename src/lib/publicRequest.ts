/**
 * publicRequest.ts — small request helpers shared by the public API routes
 * (the three form submit routes, /api/public/blessing-boxes/** and
 * /api/csp-report).
 *
 * requestIp() is byte-for-byte the expression these routes used inline. It
 * is deliberately separate from authEvents.ts's clientIp(), which reads only
 * cf-connecting-ip and caps it at 64 chars for storage in auth_events; the
 * value here is never stored (Turnstile `remoteip`, or an HMAC'd rate-limit
 * key in csp-report).
 *
 * parsePublicPost() is the anti-spam preamble the seven JSON form routes
 * share (feedback/report/suggest submit; box checkins/adopt/alerts/needs).
 * The photos route (multipart, honeypot before Turnstile) and the routes
 * without Turnstile (csp-report, alerts confirm/stop/resubscribe, photo
 * flag) keep their own.
 */

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";
import { logFormFailure, type FormName } from "@/lib/logger";

/** cf-connecting-ip, else the first x-forwarded-for entry (trimmed), else "unknown". */
export function requestIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

/** The anti-spam fields every form posts alongside its own. */
interface AntiSpamFields {
  /** Honeypot — must be empty or absent. */
  website?: string;
  turnstileToken?: string;
  /** Box forms only: which widget made the token ("fallback" = the managed key). */
  turnstileKey?: unknown;
}

export interface PublicPost<T> {
  body: T;
  ip: string;
  /** CHECKIN_RATE_LIMIT_SECRET — its own HMAC key, never a Turnstile secret (checkinRateLimit.ts header). */
  rateLimitSecret: string;
  db: D1Database;
}

/**
 * Runs the shared checks in the exact order each route always used, and
 * returns either the parsed request or the response to send back:
 *
 * 1. Content-Type must be JSON, and the body must parse → 400 "Bad request".
 * 2. Turnstile → 400 "turnstile_failed" (logged, no PII). A missing secret
 *    THROWS: an empty secret makes siteverify accept the always-pass test
 *    key from anyone.
 *    - `"managed"` (feedback/report/suggest): TURNSTILE_SECRET_KEY.
 *    - `"box"`: TURNSTILE_BOX_SECRET_KEY, or TURNSTILE_SECRET_KEY when the
 *      body says `turnstileKey: "fallback"` (boxTurnstile.ts). Anything else
 *      stays on the strict box key.
 * 3. Honeypot filled → 200 `{ok: true}`, so bots think it worked.
 * 4. D1 binding unreachable → 503 "unavailable" (fail closed). Skipped with
 *    `withDb = false` (the needs route validates fields before touching D1).
 *
 * CHECKIN_RATE_LIMIT_SECRET missing THROWS too. Where depends on the lane,
 * kept from before this helper existed (each route's tests pin it): box
 * routes check it before Turnstile, the managed routes after D1.
 */
export async function parsePublicPost<T extends AntiSpamFields>(
  req: Request,
  form: FormName,
  lane: "managed" | "box",
): Promise<PublicPost<T> | NextResponse>;
export async function parsePublicPost<T extends AntiSpamFields>(
  req: Request,
  form: FormName,
  lane: "managed" | "box",
  withDb: false,
): Promise<Omit<PublicPost<T>, "db"> | NextResponse>;
export async function parsePublicPost<T extends AntiSpamFields>(
  req: Request,
  form: FormName,
  lane: "managed" | "box",
  withDb = true,
): Promise<Omit<PublicPost<T>, "db"> | PublicPost<T> | NextResponse> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: T;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Used only for Turnstile's remoteip and the form routes' rate-limit key —
  // never logged or stored.
  const ip = requestIp(req);

  let turnstileValid: boolean;
  if (lane === "box") {
    const turnstileKey = resolveBoxTurnstileKey(body.turnstileKey);
    rateLimitSecretOrThrow();
    turnstileValid = await verifyBoxTurnstile(body.turnstileToken, turnstileKey, ip);
  } else {
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      throw new Error("TURNSTILE_SECRET_KEY not configured");
    }
    turnstileValid = await verifyTurnstileToken(body.turnstileToken, turnstileSecret, ip);
  }
  if (!turnstileValid) {
    logFormFailure(form, "turnstile_failed");
    return NextResponse.json({ ok: false, error: "turnstile_failed" }, { status: 400 });
  }

  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }); // bots think it worked
  }

  if (!withDb) return { body, ip, rateLimitSecret: rateLimitSecretOrThrow() };

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  return { body, ip, rateLimitSecret: rateLimitSecretOrThrow(), db };
}

function rateLimitSecretOrThrow(): string {
  const secret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!secret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }
  return secret;
}
