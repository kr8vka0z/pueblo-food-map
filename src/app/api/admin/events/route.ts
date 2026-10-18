/**
 * POST /api/admin/events — create an event as a draft, or publish it on
 * creation (#757). "Save draft" and "Publish" are the only create actions.
 *
 * Auth: getAdminDb() then requireAdminOrigin() (authorizeEventRequest), both
 * throwing AccessDeniedError into one 401/403 shape. Validation is the
 * authoritative pass (adminEventValidation.ts); times arrive as Pueblo wall
 * clock and are stored as UTC.
 *
 * The insert and its audit_log row are one atomic db.batch(). A published
 * event is live on the map within the feed's 60s cache, so the feed's edge
 * cache entry is purged after the write. Events never go through the venue
 * Publish snapshot.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeEventRequest, EVENT_AUDIT_INSERT_SQL, purgeEventsFeed } from "@/lib/adminEvents";
import { validateEventPayload } from "@/lib/adminEventValidation";
import type { AdminDbAccess } from "@/lib/adminDb";
import type { EventRow } from "@/lib/events";

const INSERT_EVENT_SQL = `INSERT INTO events (id, name, name_es, host, host_es, description, description_es,
    what_to_bring, what_to_bring_es, cancel_note, cancel_note_es, starts_at, ends_at, lat, lng, address,
    venue_id, link_url, status, created_at, created_by, updated_at, updated_by, published_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function POST(req: NextRequest): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeEventRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const validation = validateEventPayload(body, ["save_draft", "publish"] as const);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 422 });
  }
  const { fields, action } = validation;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = action === "publish" ? "published" : "draft";
  const publishedAt = action === "publish" ? now : null;

  const row: EventRow = {
    id,
    name: fields.name,
    name_es: fields.nameEs,
    host: fields.host,
    host_es: fields.hostEs,
    description: fields.description,
    description_es: fields.descriptionEs,
    what_to_bring: fields.whatToBring,
    what_to_bring_es: fields.whatToBringEs,
    // A brand-new event has nothing to cancel; ignore any cancel note sent.
    cancel_note: null,
    cancel_note_es: null,
    starts_at: fields.startsAt,
    ends_at: fields.endsAt,
    lat: fields.lat,
    lng: fields.lng,
    address: fields.address,
    venue_id: fields.venueId,
    link_url: fields.linkUrl,
    flyer_key: null,
    status,
    created_at: now,
    created_by: identity.email,
    updated_at: now,
    updated_by: identity.email,
    published_at: publishedAt,
  };

  const insertEvent = db
    .prepare(INSERT_EVENT_SQL)
    .bind(
      row.id, row.name, row.name_es, row.host, row.host_es, row.description, row.description_es,
      row.what_to_bring, row.what_to_bring_es, row.cancel_note, row.cancel_note_es, row.starts_at, row.ends_at,
      row.lat, row.lng, row.address, row.venue_id, row.link_url, row.status, row.created_at, row.created_by,
      row.updated_at, row.updated_by, row.published_at,
    );
  const insertAudit = db
    .prepare(EVENT_AUDIT_INSERT_SQL)
    .bind(identity.email, id, "create", null, JSON.stringify(row), now, identity.sessionId ?? null, id, now);

  try {
    await db.batch([insertEvent, insertAudit]);
  } catch {
    // e.g. the events migration hasn't been applied to this environment yet.
    return NextResponse.json({ ok: false, error: "write_failed", message: "The event was not saved. Try again." }, { status: 500 });
  }

  await purgeEventsFeed(req, id);
  return NextResponse.json({ ok: true, id, updated_at: now, status }, { status: 201 });
}
