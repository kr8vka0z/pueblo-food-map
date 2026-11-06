/**
 * POST /api/admin/box-adopters/[id]/reject — moderation decision: reject a
 * pending application, or remove a previously-approved adopter (the same
 * action either way — "Reject" and "Remove" are one button per the task's
 * own spec), with an optional reviewer-entered reason (Blessing Boxes
 * slice 6).
 *
 * Same auth pair, same atomic-batch + audit_log shape as the approve route
 * (this file's sibling) — see that route's own header for the shared
 * reasoning. Unlike approve, reject has no confirmed-email precondition — an
 * admin can reject a still-unconfirmed application too (there's nothing to
 * wait for; rejecting just closes it out).
 *
 * unsubscribeAdopterSubscriptionStatement (boxAlerts.ts) rides the SAME
 * batch — removing a previously-approved adopter also stops their alert
 * emails in the same atomic step; it's a no-op (0 rows) when the
 * application was still pending and never had a subscription.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminWriteAccess } from "@/lib/adminAuthErrors";
import { positiveInt } from "@/lib/positiveInt";
import { readOptionalReason } from "@/lib/adminRequest";
import { loadAdopterById, type BoxAdopterRow } from "@/lib/boxAdopters";
import { unsubscribeAdopterSubscriptionStatement } from "@/lib/boxAlerts";
import { bustEdgeCache } from "@/lib/edgeCache";
import { AUDIT_INSERT_VALUES_SQL } from "@/lib/auditLog";

/** Reviewer-entered reason, capped generously — internal admin note, not public-facing copy. Same convention/limit as box-photos' own reject route. */
const MAX_REVIEW_REASON_LENGTH = 500;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const access = await adminWriteAccess(req);
  if (access instanceof Response) return access;
  const { db, identity } = access;

  const { id: rawId } = await params;
  const adopterId = positiveInt(Number(rawId));
  if (adopterId === null) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Defensive body parse — a bodyless POST (plain "Remove" button, no reason
  // typed) must not throw, same convention box-photos' own reject route uses.
  const reviewReason = await readOptionalReason(req, MAX_REVIEW_REASON_LENGTH);

  const existing = await loadAdopterById(db, adopterId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const timestamp = new Date().toISOString();
  const afterRow: BoxAdopterRow = {
    ...existing,
    status: "rejected",
    reviewed_by: identity.email,
    reviewed_at: timestamp,
    review_reason: reviewReason,
  };

  const updateAdopter = db
    .prepare("UPDATE box_adopters SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_reason = ? WHERE id = ?")
    .bind(identity.email, timestamp, reviewReason, adopterId);
  const insertAudit = db
    .prepare(AUDIT_INSERT_VALUES_SQL)
    .bind(identity.email, "box_adopter", String(adopterId), "update", JSON.stringify(existing), JSON.stringify(afterRow), timestamp, identity.sessionId ?? null);
  const unsubscribeStatement = unsubscribeAdopterSubscriptionStatement(db, adopterId, timestamp);

  await db.batch([updateAdopter, insertAudit, unsubscribeStatement]);

  await bustEdgeCache(req, ["/api/public/blessing-boxes"]);

  return NextResponse.json({ ok: true, id: adopterId, status: "rejected" });
}
