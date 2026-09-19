/**
 * /api/admin/blessing-boxes/[id]/host-alerts — admin-managed host alert
 * recipients for one box (Blessing Boxes slice 6). POST adds a host (already
 * confirmed — the admin vouches for the address, no double opt-in, per the
 * task's own spec); DELETE stops a host's alerts (sets unsubscribed_at AND
 * rotates unsubscribe_token — src/lib/boxAlerts.ts's
 * removeHostSubscriptionStatement's own header for why — does not
 * hard-delete the row).
 *
 * Same auth pair as every other admin mutation (getAdminDb() then
 * requireAdminOrigin()).
 *
 * 2026-09-18 security review, item 8: this route used to call
 * addHostSubscription/removeHostSubscription directly (each running its own
 * INSERT/UPDATE) with no audit_log row at all — every other status-flipping
 * admin mutation in this app (box-adopters approve/reject, box-photos
 * approve/reject) records one. Both POST and DELETE now batch their write
 * with an audit_log INSERT in the SAME db.batch(), same
 * action='update'/entity convention the box-adopters approve route uses —
 * before/after JSON carry `{venue_id, email}` (add) or
 * `{venue_id, email, unsubscribed_at}` (remove), the one detail worth
 * recording for a single-column host-list mutation.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { isValidEmail, normalizeEmail } from "@/lib/rateLimit";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { logFormFailure } from "@/lib/logger";
import {
  findHostSubscription,
  insertHostSubscriptionStatement,
  loadHostSubscriptions,
  removeHostSubscriptionStatement,
  sendHostWelcomeEmail,
} from "@/lib/boxAlerts";

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

async function authorize(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

/** Normalizes ONCE at this route's boundary (item 3) — every lookup/write below reuses this same value, so "Foo@X.com" and "foo@x.com" are always the same row. */
function parseEmail(raw: unknown): string | null {
  const email = typeof raw === "string" ? normalizeEmail(raw) : "";
  if (!email || email.length > FIELD_LIMITS.EMAIL || !isValidEmail(email)) return null;
  return email;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorize(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id: venueId } = await params;

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const email = parseEmail(body.email);
  if (!email) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 422 });
  }

  const existing = await findHostSubscription(db, venueId, email);
  if (existing) {
    const result = existing.unsubscribed_at ? "refused" : "already";
    if (result === "refused") {
      return NextResponse.json({ ok: false, error: "previously_unsubscribed" }, { status: 409 });
    }
    const hosts = await loadHostSubscriptions(db, venueId);
    return NextResponse.json({ ok: true, result, hosts });
  }

  const timestamp = new Date().toISOString();
  const insertStatement = insertHostSubscriptionStatement(db, { venueId, email }, new Date(timestamp));
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "box_host_alert",
      venueId,
      "update",
      null,
      JSON.stringify({ venue_id: venueId, email }),
      timestamp,
    );
  await db.batch([insertStatement, insertAudit]);

  try {
    const boxRow = await db.prepare("SELECT name FROM venues WHERE id = ?").bind(venueId).first<{ name: string }>();
    const subscription = await db
      .prepare("SELECT unsubscribe_token FROM alert_subscriptions WHERE role = 'host' AND venue_id = ? AND email = ?")
      .bind(venueId, email)
      .first<{ unsubscribe_token: string }>();
    if (subscription) {
      await sendHostWelcomeEmail({
        to: email,
        boxName: boxRow?.name ?? venueId,
        origin: resolveEmailOrigin(req),
        unsubscribeToken: subscription.unsubscribe_token,
      });
    }
  } catch (err) {
    logFormFailure("alerts", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
  }

  const hosts = await loadHostSubscriptions(db, venueId);
  return NextResponse.json({ ok: true, result: "added", hosts });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorize(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id: venueId } = await params;

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const email = parseEmail(body.email);
  if (!email) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 422 });
  }

  const timestamp = new Date().toISOString();
  const removeStatement = removeHostSubscriptionStatement(db, venueId, email, new Date(timestamp));
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "box_host_alert",
      venueId,
      "update",
      JSON.stringify({ venue_id: venueId, email, unsubscribed_at: null }),
      JSON.stringify({ venue_id: venueId, email, unsubscribed_at: timestamp }),
      timestamp,
    );
  await db.batch([removeStatement, insertAudit]);

  const hosts = await loadHostSubscriptions(db, venueId);
  return NextResponse.json({ ok: true, hosts });
}
