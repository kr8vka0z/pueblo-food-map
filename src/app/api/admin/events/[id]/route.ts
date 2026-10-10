/**
 * PATCH /api/admin/events/[id] — edit an event and/or move it through its
 * life (#757). One `action` per request:
 *   save    — update fields, status unchanged
 *   publish — update fields; a draft becomes published (an already
 *             published event is just saved)
 *   cancel  — update fields; a published event becomes cancelled, and a
 *             cancel note is required (adminEventValidation.ts)
 * Archiving is its own route (./archive), like the venue routes.
 *
 * Transitions the lifecycle doesn't allow answer 409 `bad_state`: nothing is
 * revived from cancelled, and an archived event is final (same rule as
 * venues — archived rows are read-only).
 *
 * Auth: authorizeEventRequest (session, then CSRF). Concurrency: the body
 * must carry `expectedUpdatedAt`, bound into the UPDATE's
 * `WHERE id = ? AND updated_at = ?`; 0 rows changed => 409 `conflict`. The
 * audit_log row is `WHERE EXISTS`-gated on the new updated_at, so a rejected
 * write leaves no audit row (src/lib/adminEvents.ts). The write and its
 * audit row are one db.batch(); the public feed's cache entry is purged on
 * success.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeEventRequest, eventConflictResponse, EVENT_AUDIT_INSERT_SQL, nextTimestamp, purgeEventsFeed } from "@/lib/adminEvents";
import { validateEventPayload, type EventStatus } from "@/lib/adminEventValidation";
import type { AdminDbAccess } from "@/lib/adminDb";
import type { EventRow } from "@/lib/events";

const UPDATE_EVENT_SQL = `UPDATE events SET name = ?, name_es = ?, host = ?, host_es = ?, description = ?, description_es = ?,
    what_to_bring = ?, what_to_bring_es = ?, cancel_note = ?, cancel_note_es = ?, starts_at = ?, ends_at = ?,
    lat = ?, lng = ?, address = ?, venue_id = ?, link_url = ?, status = ?, published_at = ?, updated_by = ?, updated_at = ?
  WHERE id = ? AND updated_at = ?`;

type EditAction = "save" | "publish" | "cancel";

/** The status an action leads to, or null when the lifecycle doesn't allow it from `from`. */
function nextStatus(action: EditAction, from: EventStatus): EventStatus | null {
  if (action === "save") return from;
  if (action === "publish") return from === "draft" || from === "published" ? "published" : null;
  return from === "published" ? "cancelled" : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeEventRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const validation = validateEventPayload(body, ["save", "publish", "cancel"] as const);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 422 });
  }
  const { fields, action } = validation;

  // Unlike the venue route (which logs and falls back), the precondition is
  // mandatory here: a client that omits it would silently skip the 409 check.
  const expectedUpdatedAt = (body as { expectedUpdatedAt?: unknown }).expectedUpdatedAt;
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) {
    return NextResponse.json({ ok: false, errors: { _form: "expectedUpdatedAt is required." } }, { status: 422 });
  }

  const existing = await db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (existing.status === "archived") {
    return NextResponse.json(
      { ok: false, error: "archived", message: "This event is archived and can't be edited." },
      { status: 409 },
    );
  }
  const status = nextStatus(action, existing.status);
  if (status === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_state",
        message:
          action === "cancel"
            ? "Only a published event can be cancelled."
            : "This event can't be published from its current state.",
      },
      { status: 409 },
    );
  }

  const now = nextTimestamp(existing.updated_at);
  const after: EventRow = {
    ...existing,
    name: fields.name,
    name_es: fields.nameEs,
    host: fields.host,
    host_es: fields.hostEs,
    description: fields.description,
    description_es: fields.descriptionEs,
    what_to_bring: fields.whatToBring,
    what_to_bring_es: fields.whatToBringEs,
    // The note belongs to cancelling (or editing an already-cancelled event, whose form shows it);
    // every other save leaves it alone.
    cancel_note: action === "cancel" || existing.status === "cancelled" ? fields.cancelNote : existing.cancel_note,
    cancel_note_es: action === "cancel" || existing.status === "cancelled" ? fields.cancelNoteEs : existing.cancel_note_es,
    starts_at: fields.startsAt,
    ends_at: fields.endsAt,
    lat: fields.lat,
    lng: fields.lng,
    address: fields.address,
    venue_id: fields.venueId,
    link_url: fields.linkUrl,
    status,
    published_at: existing.status !== "published" && status === "published" ? now : existing.published_at,
    updated_by: identity.email,
    updated_at: now,
  };

  const updateEvent = db
    .prepare(UPDATE_EVENT_SQL)
    .bind(
      after.name, after.name_es, after.host, after.host_es, after.description, after.description_es,
      after.what_to_bring, after.what_to_bring_es, after.cancel_note, after.cancel_note_es, after.starts_at,
      after.ends_at, after.lat, after.lng, after.address, after.venue_id, after.link_url, after.status,
      after.published_at, after.updated_by, after.updated_at, id, expectedUpdatedAt,
    );
  const auditAction = existing.status === "draft" && status === "published" ? "publish" : "update";
  const insertAudit = db
    .prepare(EVENT_AUDIT_INSERT_SQL)
    .bind(
      identity.email, id, auditAction, JSON.stringify(existing), JSON.stringify(after), now,
      identity.sessionId ?? null, id, now,
    );

  // updateEvent MUST stay statement index 0 — the 409 check reads results[0].
  const results = await db.batch([updateEvent, insertAudit]).catch(() => null);
  if (results === null) {
    return NextResponse.json({ ok: false, error: "write_failed", message: "The event was not saved. Try again." }, { status: 500 });
  }
  if (results[0].meta.changes === 0) return eventConflictResponse();

  await purgeEventsFeed(req);
  return NextResponse.json({ ok: true, id, status, updated_at: now });
}
