/**
 * POST /api/admin/box-adopters/[id]/approve — moderation decision: an admin
 * approves a confirmed adoption application, making the applicant's name
 * public on the box's card ("Cared for by …") and enrolling them in host+
 * adopter-tier alert emails (Blessing Boxes slice 6).
 *
 * Same auth pair as every other admin mutation (getAdminDb() then
 * requireAdminOrigin() — see box-photos/[id]/approve/route.ts's own header
 * for the shared convention this mirrors) and the same atomic-batch +
 * audit_log shape (action='update', entity='box_adopter' — a plain TEXT
 * column, no schema change needed).
 *
 * Refuses (409) an UNCONFIRMED application — the applicant must have
 * clicked their own confirm-email link first (POST /api/public/alerts/confirm)
 * before an admin can approve it; this is the "BOTH confirm AND admin
 * approve" gate the task's own spec requires for anything to become public.
 *
 * The alert_subscriptions upsert (upsertApprovedAdopterSubscriptionStatement,
 * boxAlerts.ts) rides the SAME atomic batch as the status flip — an approved
 * adopter and their alert subscription always exist or don't exist together,
 * never one without the other.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/adminOrigin";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { loadAdopterById, type BoxAdopterRow } from "@/lib/boxAdopters";
import { sendAdopterApprovedEmail, upsertApprovedAdopterSubscriptionStatement } from "@/lib/boxAlerts";
import { resolveEmailOrigin } from "@/lib/alertOrigin";
import { bustEdgeCache } from "@/lib/edgeCache";
import { logFormFailure } from "@/lib/logger";

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

async function authorize(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
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

  const { id: rawId } = await params;
  const adopterId = Number(rawId);
  if (!Number.isInteger(adopterId) || adopterId <= 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const existing = await loadAdopterById(db, adopterId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!existing.email_confirmed_at) {
    return NextResponse.json({ ok: false, error: "unconfirmed" }, { status: 409 });
  }

  const timestamp = new Date().toISOString();
  const afterRow: BoxAdopterRow = {
    ...existing,
    status: "approved",
    reviewed_by: identity.email,
    reviewed_at: timestamp,
    review_reason: null,
  };

  const updateAdopter = db
    .prepare("UPDATE box_adopters SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_reason = NULL WHERE id = ?")
    .bind(identity.email, timestamp, adopterId);
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(identity.email, "box_adopter", String(adopterId), "update", JSON.stringify(existing), JSON.stringify(afterRow), timestamp);
  const upsertSubscription = upsertApprovedAdopterSubscriptionStatement(db, {
    venueId: existing.venue_id,
    email: existing.email,
    adopterId,
    timestamp,
    // Inherits the applicant's own signup-time locale (BoxAdopterRow.lang)
    // — see upsertApprovedAdopterSubscriptionStatement's own header.
    lang: existing.lang,
  });

  await db.batch([updateAdopter, insertAudit, upsertSubscription]);

  // The box's public card now shows this name — bust the list endpoint's
  // edge cache the same way every other box-affecting admin action does.
  await bustEdgeCache(req, ["/api/public/blessing-boxes"]);

  // Best-effort "you're approved" email — the approval itself already
  // committed above; a failed send here just means the adopter finds out
  // when they next look at the box's card, same posture every other
  // best-effort admin-triggered email in this app already takes.
  try {
    const subscription = await db
      .prepare("SELECT unsubscribe_token FROM alert_subscriptions WHERE role = 'adopter' AND venue_id = ? AND email = ?")
      .bind(existing.venue_id, existing.email)
      .first<{ unsubscribe_token: string }>();
    const boxName =
      (await db.prepare("SELECT name FROM venues WHERE id = ?").bind(existing.venue_id).first<{ name: string }>())
        ?.name ?? existing.venue_id;
    if (subscription) {
      await sendAdopterApprovedEmail({
        to: existing.email,
        boxName,
        displayName: existing.display_name,
        origin: resolveEmailOrigin(req),
        unsubscribeToken: subscription.unsubscribe_token,
        lang: existing.lang,
      });
    }
  } catch (err) {
    logFormFailure("adopt", "send_failed", { message: err instanceof Error ? err.message : "unknown error" });
  }

  return NextResponse.json({ ok: true, id: adopterId, status: "approved" });
}
