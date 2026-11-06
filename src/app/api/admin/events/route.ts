/**
 * POST /api/admin/events — create an event as a draft, or publish it on
 * creation (#757). "Save draft" and "Publish" are the only create actions.
 *
 * Auth: getAdminDb() then requireAdminOrigin() (authorizeAdminWrite), both
 * throwing AccessDeniedError into one 401/403 shape. Validation is the
 * authoritative pass (adminEventValidation.ts); times arrive as Pueblo wall
 * clock and are stored as UTC.
 *
 * The insert and its audit_log row are one atomic db.batch(). A published
 * event is live on the map within the feed's 60s cache, so the feed's edge
 * cache entry is purged after the write. Events never go through the venue
 * Publish snapshot.
 *
 * `submission_id` (#883): the form was opened from a public "Share an event"
 * submission whose address couldn't be located automatically. Then only
 * "save_draft" is accepted, the submission's flyer is copied onto the event,
 * and the insert plus "mark the submission converted" go through the same
 * atomic convertToDraft() as the convert route (409 if someone else
 * already handled the submission).
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminWriteAccess } from "@/lib/adminAuthErrors";
import { EVENT_AUDIT_INSERT_SQL, EVENT_INSERT_COLUMNS, EVENT_INSERT_PLACEHOLDERS, eventColumnsFrom, eventInsertValues, purgeEventsFeed } from "@/lib/adminEvents";
import { validateEventPayload } from "@/lib/adminEventValidation";
import type { EventRow } from "@/lib/events";
import { convertToDraft, loadPendingEventSubmission, submissionGoneResponse } from "@/lib/eventSubmissions";

const INSERT_EVENT_SQL = `INSERT INTO events (${EVENT_INSERT_COLUMNS}) VALUES (${EVENT_INSERT_PLACEHOLDERS})`;

export async function POST(req: NextRequest): Promise<Response> {
  const access = await adminWriteAccess(req);
  if (access instanceof Response) return access;
  const { db, identity } = access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const raw = (body as { submission_id?: unknown } | null)?.submission_id;
  const submissionId = typeof raw === "string" && raw ? raw : null;
  // From a public submission: a draft only, never published on creation.
  const validation = validateEventPayload(body, submissionId ? (["save_draft"] as const) : (["save_draft", "publish"] as const));
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
    // A brand-new event has nothing to cancel; ignore any cancel note sent.
    ...eventColumnsFrom(fields, null, null),
    flyer_key: null,
    status,
    created_at: now,
    created_by: identity.email,
    updated_at: now,
    updated_by: identity.email,
    published_at: publishedAt,
  };

  if (submissionId) {
    const sub = await loadPendingEventSubmission(db, submissionId);
    const failed = sub ? await convertToDraft(db, identity, sub, row) : submissionGoneResponse();
    if (failed) return failed;
    return NextResponse.json({ ok: true, id, updated_at: now, status }, { status: 201 });
  }

  const insertEvent = db
    .prepare(INSERT_EVENT_SQL)
    .bind(...eventInsertValues(row));
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
