/**
 * POST /api/admin/events/[id]/archive — remove an event from everywhere but
 * the admin history (#757). Sets status='archived' and keeps the row; there
 * is no DELETE. Same two-step auth, one-batch-with-audit and `updated_at`
 * precondition as PATCH ../ (see that file's header); the optional JSON body
 * `{ expectedUpdatedAt }` is the admin's view of the row, falling back to the
 * value just read so a bodyless call still can't write over a concurrent save.
 * Purges the public feed so a published event leaves the map at once.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeEventRequest, eventConflictResponse, EVENT_AUDIT_INSERT_SQL, nextTimestamp, purgeEventsFeed } from "@/lib/adminEvents";
import type { AdminDbAccess } from "@/lib/adminDb";
import type { EventRow } from "@/lib/events";

async function readExpectedUpdatedAt(req: NextRequest): Promise<string | null> {
  try {
    const raw = ((await req.json()) as { expectedUpdatedAt?: unknown })?.expectedUpdatedAt;
    return typeof raw === "string" && raw ? raw : null;
  } catch {
    return null; // no body / not JSON: the bodyless call shape
  }
}

export async function POST(
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

  const existing = await db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (existing.status === "archived") {
    return NextResponse.json({ ok: false, error: "archived", message: "This event is already archived." }, { status: 409 });
  }

  const expectedUpdatedAt = (await readExpectedUpdatedAt(req)) ?? existing.updated_at;
  const now = nextTimestamp(existing.updated_at);
  const after: EventRow = { ...existing, status: "archived", updated_by: identity.email, updated_at: now };

  const archiveEvent = db
    .prepare("UPDATE events SET status = 'archived', updated_by = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
    .bind(identity.email, now, id, expectedUpdatedAt);
  const insertAudit = db
    .prepare(EVENT_AUDIT_INSERT_SQL)
    .bind(identity.email, id, "archive", JSON.stringify(existing), JSON.stringify(after), now, identity.sessionId ?? null, id, now);

  let results: D1Result[];
  try {
    results = await db.batch([archiveEvent, insertAudit]);
  } catch {
    return NextResponse.json({ ok: false, error: "write_failed", message: "The event was not archived. Try again." }, { status: 500 });
  }
  if (results[0].meta.changes === 0) return eventConflictResponse();

  await purgeEventsFeed(req);
  return NextResponse.json({ ok: true, id, status: "archived", updated_at: now });
}
