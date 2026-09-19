/**
 * /api/admin/blessing-boxes/[id]/host-alerts — admin-managed host alert
 * recipients for one box (Blessing Boxes slice 6). POST adds a host (already
 * confirmed — the admin vouches for the address, no double opt-in, per the
 * task's own spec); DELETE stops a host's alerts (sets unsubscribed_at, does
 * not hard-delete the row — src/lib/boxAlerts.ts's removeHostSubscription).
 *
 * Same auth pair as every other admin mutation (getAdminDb() then
 * requireAdminOrigin()). Both routes are thin wrappers over boxAlerts.ts's
 * own addHostSubscription/removeHostSubscription — no db.batch() here (a
 * single-table write, not a status flip needing an audit_log row the way
 * venue/adopter/photo mutations get; host management has no equivalent
 * "before/after row" worth auditing beyond the subscriptions list itself,
 * which IS the durable record).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { isValidEmail } from "@/lib/rateLimit";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { logFormFailure } from "@/lib/logger";
import { addHostSubscription, loadHostSubscriptions, removeHostSubscription, sendHostWelcomeEmail } from "@/lib/boxAlerts";

async function authorize(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

function parseEmail(raw: unknown): string | null {
  const email = typeof raw === "string" ? raw.trim() : "";
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
  const { db } = access;
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

  const result = await addHostSubscription(db, { venueId, email });
  if (result === "refused") {
    return NextResponse.json({ ok: false, error: "previously_unsubscribed" }, { status: 409 });
  }

  if (result === "added") {
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
  }

  const hosts = await loadHostSubscriptions(db, venueId);
  return NextResponse.json({ ok: true, result, hosts });
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
  const { db } = access;
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

  await removeHostSubscription(db, venueId, email);
  const hosts = await loadHostSubscriptions(db, venueId);
  return NextResponse.json({ ok: true, hosts });
}
