/**
 * adminEvents.ts — pieces the three admin events write routes share (#757):
 * POST /api/admin/events, PATCH /api/admin/events/[id] and
 * POST /api/admin/events/[id]/archive. Mirrors the venue routes' shape
 * (authorizeAdminWrite -> one db.batch() with an audit_log row -> updated_at
 * precondition) but keeps the repeated bits in one place.
 */

import { NextResponse } from "next/server";
import { bustEdgeCache } from "@/lib/edgeCache";
import { auditInsertIfExistsSql } from "@/lib/auditLog";
import type { EventRow } from "@/lib/events";
import type { ValidatedEventFields } from "@/lib/adminEventValidation";

/** The public feed's path — every events write purges this edge-cache entry. */
const PUBLIC_EVENTS_PATH = "/api/public/events";

/**
 * SELECT-form so `WHERE EXISTS` can skip the audit row when the event UPDATE
 * didn't apply (stale `updated_at`). The two trailing bind params (id, new
 * updated_at) are the guard — a rejected write must never leave an audit row
 * claiming it happened (same reasoning as the venue routes, #265).
 * audit_log.action is CHECK-limited to create/update/publish/archive
 * (migrations/0001), so a cancel is recorded as 'update' with the new
 * status in after_json.
 */
export const EVENT_AUDIT_INSERT_SQL = auditInsertIfExistsSql(
  "?, 'event', ?, ?, ?, ?, ?, ?",
  "SELECT 1 FROM events WHERE id = ? AND updated_at = ?",
);

/**
 * Every column an event INSERT writes, in the order eventInsertValues() binds
 * them. Shared by the create route and the "Share an event" convert
 * (eventSubmissions.ts), so a new column can't be added to one and missed in the other.
 * No flyer columns: a created event gets its flyer later through the flyer
 * route; the convert appends the three it copies.
 */
export const EVENT_INSERT_COLUMNS = `id, name, name_es, host, host_es, description, description_es, what_to_bring, what_to_bring_es,
    cancel_note, cancel_note_es, starts_at, ends_at, lat, lng, address, venue_id, venue_name, link_url, link_label,
    link_label_custom, link_label_custom_es, status, created_at, created_by, updated_at, updated_by, published_at`;
export const EVENT_INSERT_PLACEHOLDERS = EVENT_INSERT_COLUMNS.split(",").map(() => "?").join(", ");

export function eventInsertValues(r: EventRow): unknown[] {
  return [
    r.id, r.name, r.name_es, r.host, r.host_es, r.description, r.description_es, r.what_to_bring, r.what_to_bring_es,
    r.cancel_note, r.cancel_note_es, r.starts_at, r.ends_at, r.lat, r.lng, r.address, r.venue_id, r.venue_name ?? null,
    r.link_url, r.link_label ?? null, r.link_label_custom ?? null, r.link_label_custom_es ?? null, r.status, r.created_at, r.created_by, r.updated_at, r.updated_by, r.published_at,
  ];
}

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

/**
 * The validated form fields as events-row columns, for the create and edit
 * routes. The cancel note is passed in because each route decides it (a
 * create ignores it). Keys stay in table order: the create route's row is
 * JSON-encoded into audit_log as built.
 */
export function eventColumnsFrom(
  fields: ValidatedEventFields,
  cancelNote: string | null,
  cancelNoteEs: string | null,
) {
  return {
    name: fields.name,
    name_es: fields.nameEs,
    host: fields.host,
    host_es: fields.hostEs,
    description: fields.description,
    description_es: fields.descriptionEs,
    what_to_bring: fields.whatToBring,
    what_to_bring_es: fields.whatToBringEs,
    cancel_note: cancelNote,
    cancel_note_es: cancelNoteEs,
    starts_at: fields.startsAt,
    ends_at: fields.endsAt,
    lat: fields.lat,
    lng: fields.lng,
    address: fields.address,
    venue_id: fields.venueId,
    venue_name: fields.venueName,
    link_url: fields.linkUrl,
    link_label: fields.linkLabel,
    link_label_custom: fields.linkLabelCustom,
    link_label_custom_es: fields.linkLabelCustomEs,
  } satisfies Partial<EventRow>;
}
