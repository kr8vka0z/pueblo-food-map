/**
 * eventSubmissions.ts — the admin side of events the public sends in with
 * "Share an event" (#883): the pending list, and turning one into a DRAFT
 * event ("Make it a draft event").
 *
 * Converting is one db.batch(), so the event and the "converted" mark land
 * together or not at all:
 *   0. INSERT the event, as SELECT ... WHERE EXISTS (the submission is still
 *      pending). convertToDraft() forces status 'draft' and published_at NULL
 *      on the row it binds, so no caller can publish through this path.
 *   1. the event's audit row (EVENT_AUDIT_INSERT_SQL, gated on the new row);
 *   2. UPDATE the submission to converted (AND status = 'pending');
 *   3. the submission's audit row, gated on step 2 having applied.
 * If two admins convert the same row, the second insert matches nothing
 * (results[0].meta.changes === 0) and the caller answers 409.
 *
 * Flyer: copied to the new event's own key (flyerKey) BEFORE the batch,
 * because R2 and D1 can't share a transaction. A failed or lost batch deletes
 * that copy; a successful one deletes the pending original (best effort; a
 * leftover is unreachable anyway, see PENDING_FLYER_PREFIX).
 */

import type { AdminIdentity } from "@/lib/adminOrigin";
import { auditInsertIfExistsSql } from "@/lib/auditLog";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { EVENT_AUDIT_INSERT_SQL, EVENT_INSERT_COLUMNS, EVENT_INSERT_PLACEHOLDERS, eventInsertValues } from "@/lib/adminEvents";
import type { EventSubmissionPayload } from "@/lib/adminEventValidation";
import type { EventRow } from "@/lib/events";
import { flyerKey, PENDING_FLYER_KEY_RE } from "@/lib/eventFlyers";

export interface EventSubmissionRow {
  id: string;
  payload: string;
  submitter_name: string;
  submitter_email: string;
  flyer_key: string | null;
  flyer_width: number | null;
  flyer_height: number | null;
  status: "pending" | "converted" | "dismissed";
  converted_event_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** One card in the admin's "Sent in by the public" list. */
export interface PendingEventSubmission {
  id: string;
  createdAt: string;
  submitterName: string;
  submitterEmail: string;
  /** null = the stored JSON could not be read (shown as such, never a crash). */
  payload: EventSubmissionPayload | null;
  hasFlyer: boolean;
}

export function parseSubmissionPayload(text: string): EventSubmissionPayload | null {
  try {
    const p = JSON.parse(text) as EventSubmissionPayload;
    return p && typeof p.name === "string" && typeof p.startsAt === "string" ? p : null;
  } catch {
    return null;
  }
}

// 200 is far beyond a backlog anyone would leave; a ceiling, not paging.
export async function loadPendingEventSubmissions(db: D1Database): Promise<PendingEventSubmission[]> {
  const { results } = await db
    .prepare("SELECT * FROM event_submissions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 200")
    .all<EventSubmissionRow>();
  return results.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    submitterName: r.submitter_name,
    submitterEmail: r.submitter_email,
    payload: parseSubmissionPayload(r.payload),
    hasFlyer: r.flyer_key !== null,
  }));
}

export async function loadPendingEventSubmission(db: D1Database, id: string): Promise<EventSubmissionRow | null> {
  return db.prepare("SELECT * FROM event_submissions WHERE id = ? AND status = 'pending'").bind(id).first<EventSubmissionRow>();
}

const INSERT_DRAFT_FROM_SUBMISSION_SQL = `INSERT INTO events (${EVENT_INSERT_COLUMNS}, flyer_key, flyer_width, flyer_height)
  SELECT ${EVENT_INSERT_PLACEHOLDERS}, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM event_submissions WHERE id = ? AND status = 'pending')`;

const MARK_CONVERTED_SQL = `UPDATE event_submissions SET status = 'converted', converted_event_id = ?, reviewed_at = ?, reviewed_by = ?
  WHERE id = ? AND status = 'pending'`;

const MARK_DISMISSED_SQL = `UPDATE event_submissions SET status = 'dismissed', reviewed_at = ?, reviewed_by = ?
  WHERE id = ? AND status = 'pending'`;

/** Bind order: actor, entity_id, before_json, after_json, timestamp, session_id, then the guard's id, status, reviewed_at. */
const SUBMISSION_AUDIT_SQL = auditInsertIfExistsSql(
  "?, 'event_submission', ?, 'update', ?, ?, ?, ?",
  "SELECT 1 FROM event_submissions WHERE id = ? AND status = ? AND reviewed_at = ?",
);

/** A draft events row from a submission plus a location (convertToDraft adds the flyer). */
export function draftFromPayload(
  eventId: string,
  p: EventSubmissionPayload,
  place: { lat: number; lng: number },
  actor: string,
  now: string,
): EventRow {
  return {
    id: eventId,
    name: p.name,
    name_es: null,
    host: p.host,
    host_es: null,
    description: p.description,
    description_es: null,
    what_to_bring: p.whatToBring,
    what_to_bring_es: null,
    cancel_note: null,
    cancel_note_es: null,
    starts_at: p.startsAt,
    ends_at: p.endsAt,
    lat: place.lat,
    lng: place.lng,
    address: p.address,
    venue_id: null,
    venue_name: p.venueName,
    link_url: p.linkUrl,
    link_label: p.linkLabel,
    link_label_custom: null,
    link_label_custom_es: null,
    flyer_key: null,
    flyer_width: null,
    flyer_height: null,
    flyer_alt: null,
    flyer_alt_es: null,
    status: "draft",
    created_at: now,
    created_by: actor,
    updated_at: now,
    updated_by: actor,
    published_at: null,
  };
}

interface CopiedFlyer {
  key: string;
  width: number;
  height: number;
}

/**
 * Copies the submission's pending flyer to a fresh key of the new event and
 * returns it, or null when there is none to copy (no flyer, a key outside the
 * pending shape, or the object is gone). Throws if R2 itself fails.
 */
async function copyPendingFlyer(r2: R2Bucket, sub: EventSubmissionRow, eventId: string): Promise<CopiedFlyer | null> {
  if (!sub.flyer_key || !PENDING_FLYER_KEY_RE.test(sub.flyer_key) || !sub.flyer_width || !sub.flyer_height) return null;
  const object = await r2.get(sub.flyer_key);
  if (!object) return null;
  const key = flyerKey(eventId);
  await r2.put(key, await object.arrayBuffer(), { httpMetadata: { contentType: "image/jpeg" } });
  return { key, width: sub.flyer_width, height: sub.flyer_height };
}

async function deleteQuietly(r2: R2Bucket, key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await r2.delete(key);
  } catch {
    // An unreferenced leftover is harmless; the rows are already right.
  }
}

/**
 * Runs the convert batch (see header) for `row` and cleans up R2 either way.
 * Returns "converted", or "gone" when the submission was no longer pending.
 * Rethrows a D1 failure after deleting the copied flyer.
 */
async function commitConversion(
  db: D1Database,
  r2: R2Bucket,
  identity: AdminIdentity,
  sub: EventSubmissionRow,
  row: EventRow,
): Promise<"converted" | "gone"> {
  const now = row.created_at;
  const insert = db
    .prepare(INSERT_DRAFT_FROM_SUBMISSION_SQL)
    .bind(...eventInsertValues(row), row.flyer_key, row.flyer_width ?? null, row.flyer_height ?? null, sub.id);
  const eventAudit = db
    .prepare(EVENT_AUDIT_INSERT_SQL)
    .bind(identity.email, row.id, "create", null, JSON.stringify(row), now, identity.sessionId ?? null, row.id, now);
  const mark = db.prepare(MARK_CONVERTED_SQL).bind(row.id, now, identity.email, sub.id);
  const subAudit = db
    .prepare(SUBMISSION_AUDIT_SQL)
    .bind(
      identity.email, sub.id,
      JSON.stringify({ id: sub.id, name: row.name, status: "pending" }),
      JSON.stringify({ id: sub.id, name: row.name, status: "converted", converted_event_id: row.id }),
      now, identity.sessionId ?? null,
      sub.id, "converted", now,
    );

  // insert MUST stay statement index 0 — the "gone" check reads results[0].
  let results: Awaited<ReturnType<typeof db.batch>>;
  try {
    results = await db.batch([insert, eventAudit, mark, subAudit]);
  } catch (err) {
    await deleteQuietly(r2, row.flyer_key);
    throw err;
  }
  if (results[0].meta.changes === 0) {
    await deleteQuietly(r2, row.flyer_key);
    return "gone";
  }
  await deleteQuietly(r2, row.flyer_key ? sub.flyer_key : null);
  return "converted";
}

/** 409 for a submission someone else already converted or dismissed. */
export function submissionGoneResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "conflict", message: "Someone already handled this event. Go back to the Events tab." },
    { status: 409 },
  );
}

/**
 * Turns pending `sub` into the draft `row`: copies the flyer onto it, then the
 * atomic batch. Returns the error response to send (502 flyer copy, 500 write,
 * 409 already handled), or null when the draft exists.
 */
export async function convertToDraft(
  db: D1Database,
  identity: AdminIdentity,
  sub: EventSubmissionRow,
  row: EventRow,
): Promise<NextResponse | null> {
  const { env } = await getCloudflareContext({ async: true });
  let flyer: CopiedFlyer | null;
  try {
    flyer = await copyPendingFlyer(env.EVENT_FLYERS, sub, row.id);
  } catch {
    return NextResponse.json({ ok: false, error: "upload_failed", message: "The flyer could not be copied. Try again." }, { status: 502 });
  }
  const draft: EventRow = {
    ...row,
    status: "draft",
    published_at: null,
    flyer_key: flyer?.key ?? null,
    flyer_width: flyer?.width ?? null,
    flyer_height: flyer?.height ?? null,
  };
  try {
    if ((await commitConversion(db, env.EVENT_FLYERS, identity, sub, draft)) === "gone") return submissionGoneResponse();
  } catch {
    return NextResponse.json({ ok: false, error: "write_failed", message: "The draft was not saved. Try again." }, { status: 500 });
  }
  return null;
}

/** Dismiss: a status change plus its audit row, one batch. Returns false when the row was not pending. */
export async function dismissSubmission(db: D1Database, identity: AdminIdentity, sub: EventSubmissionRow, name: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [result] = await db.batch([
    db.prepare(MARK_DISMISSED_SQL).bind(now, identity.email, sub.id),
    db
      .prepare(SUBMISSION_AUDIT_SQL)
      .bind(
        identity.email, sub.id,
        JSON.stringify({ id: sub.id, name, status: "pending" }),
        JSON.stringify({ id: sub.id, name, status: "dismissed" }),
        now, identity.sessionId ?? null,
        sub.id, "dismissed", now,
      ),
  ]);
  return result.meta.changes > 0;
}
