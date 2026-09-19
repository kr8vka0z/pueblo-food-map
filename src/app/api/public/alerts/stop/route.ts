/**
 * POST /api/public/alerts/stop — the mutation half of /alerts/stop
 * (Blessing Boxes slice 6). The page itself (src/app/alerts/stop/page.tsx)
 * never mutates on its own GET — a mail scanner prefetching the page's HTML
 * must not silently unsubscribe someone. Two real callers reach this route
 * instead, both of which this handler must serve identically:
 *
 *   1. A mail client's RFC 8058 one-click unsubscribe: POSTs the
 *      List-Unsubscribe header URL directly, `Content-Type:
 *      application/x-www-form-urlencoded`, body `List-Unsubscribe=One-Click`,
 *      and the token ONLY in the URL's query string (`?t=<token>`) — see
 *      unsubscribeHeaders()/buildAlertEmail() in src/lib/emailSend.ts +
 *      boxAlerts.ts, which already build the List-Unsubscribe URL this way.
 *   2. The human-facing /alerts/stop page's client component
 *      (AlertsStopContent.tsx), which auto-POSTs once on mount with a JSON
 *      body `{ token }` — and its <noscript> fallback form, a plain HTML
 *      POST with the token in the query string too (no JS needed to build a
 *      JSON body).
 *
 * 2026-09-18 security-review fix: this route used to 400 on anything but
 * `Content-Type: application/json`, which broke case 1 outright (a real
 * mail client's one-click unsubscribe never got past that check). Token
 * lookup order is now query string FIRST (covers both real callers above
 * without ever needing to parse a body), then a JSON or form body as a
 * fallback — and every Content-Type is accepted.
 *
 * Response shape also branches on `Accept`: a `text/html`-accepting caller
 * (the <noscript> form's top-level browser navigation) gets back a tiny
 * static HTML page instead of JSON, since that request has no JS to read a
 * JSON body with. RFC 8058 doesn't require the one-click POST's response
 * body/type to be anything in particular, so this is safe for case 1 too.
 *
 * Thin wrapper over src/lib/boxAlerts.ts's stopSubscriptionByToken(), which
 * already owns the rate limit (scope "alert-token", via the existing
 * CHECKIN_RATE_LIMIT_SECRET — no new secret) and the actual
 * unsubscribed_at write. "not_found"/"rate_limited"/an unknown token all
 * collapse to the same neutral response, for the same reason: there is no
 * safe way to distinguish "never existed" from "already used" from the
 * outside, and a brute-force attempt against the token space must learn
 * nothing either way (see stopSubscriptionByToken's own header).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { stopSubscriptionByToken } from "@/lib/boxAlerts";
import { escapeHtml } from "@/lib/emailSend";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Query string first (RFC 8058 one-click + the noscript form both use it), then a JSON or form body — see this file's own header. Never throws: a malformed/absent body just means no token was found there either. */
async function extractToken(req: NextRequest): Promise<string> {
  const fromQuery = new URL(req.url).searchParams.get("t")?.trim();
  if (fromQuery) return fromQuery;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { token?: unknown };
      return typeof body.token === "string" ? body.token.trim() : "";
    }
    // Covers application/x-www-form-urlencoded and multipart/form-data —
    // RFC 8058's own body (`List-Unsubscribe=One-Click`) has no `token`
    // field, since that caller always supplies the token via the query
    // string above; this branch only ever matters for a body that DOES
    // carry one (e.g. a future form field named "token").
    const form = await req.formData();
    const raw = form.get("token");
    return typeof raw === "string" ? raw.trim() : "";
  } catch {
    return "";
  }
}

/** A tiny bilingual static HTML page for the <noscript> fallback form's top-level navigation — see this file's own header for why this branch exists at all (no JS, so no JSON body to read). */
function stopResultHtml(ok: boolean): string {
  const bodyKey = ok ? "alerts.stop.body" : "alerts.stop.invalid";
  const heading = escapeHtml(t("alerts.stop.heading", "en"));
  const headingEs = escapeHtml(t("alerts.stop.heading", "es"));
  const body = escapeHtml(t(bodyKey, "en"));
  const bodyEs = escapeHtml(t(bodyKey, "es"));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${heading}</title></head><body><h1>${heading}</h1><p>${body}</p><hr/><h1 lang="es">${headingEs}</h1><p lang="es">${bodyEs}</p></body></html>`;
}

function respond(wantsHtml: boolean, ok: boolean, error: string | undefined, status: number): NextResponse {
  if (wantsHtml) {
    return new NextResponse(stopResultHtml(ok), { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json(error ? { ok, error } : { ok }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  const token = await extractToken(req);
  if (!token) {
    return respond(wantsHtml, false, "invalid_token", 200);
  }

  const rateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!rateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return respond(wantsHtml, false, "unavailable", 503);
  }

  const result = await stopSubscriptionByToken(db, token, rateLimitSecret);
  // "rate_limited" folds into the same neutral outcome as "not_found" —
  // stopSubscriptionByToken's own header: a brute-force attempt against the
  // token space learns nothing either way from the response.
  if (result === "not_found" || result === "rate_limited") {
    return respond(wantsHtml, false, "invalid_token", 200);
  }
  return respond(wantsHtml, true, undefined, 200);
}
