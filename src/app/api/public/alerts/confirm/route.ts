/**
 * POST /api/public/alerts/confirm — the shared double-opt-in confirm
 * endpoint for BOTH adopter applications (box_adopters.confirm_token) and
 * giver/host subscriptions (alert_subscriptions.confirm_token) — Blessing
 * Boxes slice 6. One token space is checked across two tables rather than
 * needing a per-role confirm route, since the /alerts/confirm PAGE has no
 * way to know in advance which table a given link's token belongs to.
 *
 * Deliberately a route handler, not part of the /alerts/confirm PAGE itself
 * — a GET on that page must never mutate (mail scanners prefetch links), so
 * the page renders a plain "Confirm" button that POSTs here.
 *
 * Neutral everywhere: an unknown token, an EXPIRED token (past the 7-day
 * window — src/lib/alertTokens.ts), and a token belonging to neither table
 * all return the identical `{ ok: false, error: "invalid_token" }` shape at
 * `200` (not a 404/410) — there is no way to distinguish "never existed"
 * from "existed but expired" from the outside. Confirming an
 * ALREADY-confirmed token is NOT an error (idempotent) — both
 * markAdopterEmailConfirmed/confirmSubscription simply no-op and this route
 * still returns success.
 *
 * 2026-09-18 security review, item 9: every D1 read/write below (both
 * tables' lookups and their confirm writes) is wrapped in ONE try/catch —
 * a D1 outage, or "no such table" if migration 0010 hasn't landed on this
 * environment yet, used to bubble up as an unhandled 500. The admin-notice
 * email send already has its own inner try/catch (best-effort, unrelated to
 * D1 health) and is unaffected by this outer one.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  isAdopterConfirmTokenValid,
  loadAdopterByConfirmToken,
  markAdopterEmailConfirmed,
  sendAdopterConfirmedAdminEmail,
} from "@/lib/boxAdopters";
import { confirmSubscription, findSubscriptionByConfirmToken, isSubscriptionConfirmTokenValid } from "@/lib/boxAlerts";
import { logFormFailure } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface ConfirmPayload {
  token?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: ConfirmPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const now = new Date();

  try {
    const adopter = await loadAdopterByConfirmToken(db, token);
    if (adopter) {
      if (!isAdopterConfirmTokenValid(adopter, now)) {
        return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
      }
      const firstConfirm = await markAdopterEmailConfirmed(db, adopter.id, now.toISOString());
      if (firstConfirm) {
        try {
          await sendAdopterConfirmedAdminEmail(db, adopter);
        } catch (err) {
          // Best-effort — the confirm itself already succeeded and is durable;
          // a missed admin notice just means the queue is discovered a little
          // later (the /admin/box-adopters list still shows it).
          logFormFailure("adopt", "send_failed", {
            message: err instanceof Error ? err.message : "unknown error",
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    const subscription = await findSubscriptionByConfirmToken(db, token);
    if (subscription) {
      if (!isSubscriptionConfirmTokenValid(subscription, now)) {
        return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
      }
      await confirmSubscription(db, subscription.id, now.toISOString());
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
  } catch (err) {
    logFormFailure("adopt", "db_unavailable", { message: err instanceof Error ? err.message : "unknown error" });
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 502 });
  }
}
