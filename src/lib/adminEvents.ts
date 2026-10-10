/**
 * adminEvents.ts — pieces the three admin events write routes share (#757):
 * POST /api/admin/events, PATCH /api/admin/events/[id] and
 * POST /api/admin/events/[id]/archive. Mirrors the venue routes' shape
 * (getAdminDb -> requireAdminOrigin -> one db.batch() with an audit_log row
 * -> updated_at precondition) but keeps the repeated bits in one place.
 */

import { NextResponse } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/adminOrigin";
import { bustEdgeCache } from "@/lib/edgeCache";

/** The public feed's path — every events write purges this edge-cache entry. */
export const PUBLIC_EVENTS_PATH = "/api/public/events";

/** getAdminDb() FIRST (session), THEN the CSRF/Origin check — same order as the venue routes. */
export async function authorizeEventRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

/**
 * SELECT-form so `WHERE EXISTS` can skip the audit row when the event UPDATE
 * didn't apply (stale `updated_at`). The two trailing bind params (id, new
 * updated_at) are the guard — a rejected write must never leave an audit row
 * claiming it happened (same reasoning as the venue routes, #265).
 * audit_log.action is CHECK-limited to create/update/publish/archive
 * (migrations/0001), so a cancel is recorded as 'update' with the new
 * status in after_json.
 */
export const EVENT_AUDIT_INSERT_SQL = `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id)
  SELECT ?, 'event', ?, ?, ?, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM events WHERE id = ? AND updated_at = ?)`;

export function eventConflictResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: "conflict",
      message: "Someone else changed this event since you opened it. Reload to see their changes.",
    },
    { status: 409 },
  );
}

/** Purges the public feed and this event's single-event read (#759, shared links) on this colo so a publish/cancel/edit shows without waiting out the 60s TTL. */
export function purgeEventsFeed(req: Request, eventId: string): Promise<void> {
  return bustEdgeCache(req, [PUBLIC_EVENTS_PATH, `${PUBLIC_EVENTS_PATH}/${encodeURIComponent(eventId)}`]);
}

/**
 * A write timestamp guaranteed to differ from the row's current `updated_at`.
 * The audit-row guard above is "updated_at = the new timestamp", so if a stale
 * write landed in the same millisecond as the row's last save, the guard would
 * pass on an UNCHANGED row and record an action that never happened. Bumping
 * by 1ms in that collision only closes that one gap (a stale write against the
 * row's own last save). Two admins writing in the same millisecond can still
 * leave one phantom audit row (the loser still gets its 409); the venue routes
 * have the same gap.
 */
export function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now > previous ? now : new Date(Date.parse(previous) + 1).toISOString();
}
