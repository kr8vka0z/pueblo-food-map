/**
 * /api/admin/events/[id]/flyer — an event's flyer image (#760, umbrella #156).
 *
 *   GET    — the stored image, for the admin form's preview. A draft's flyer
 *            has no public URL (the public route only serves published or
 *            cancelled events), so the editor needs its own read. Session
 *            only, like the box-photo preview; `no-store`.
 *   POST   — multipart: `flyer` (the file, optional), `alt`, `alt_es`,
 *            `expectedUpdatedAt`. With a file: store it and make it the
 *            event's flyer. Without one: change only the alt text of the
 *            flyer already there.
 *   DELETE — JSON `{ expectedUpdatedAt }`: remove the flyer.
 *
 * Writes are gated exactly like the other event writes (authorizeEventRequest:
 * admin session, then requireAdminOrigin) BEFORE any body is read or any
 * storage touched. The file is judged on its bytes (src/lib/eventFlyers.ts),
 * never on the client's Content-Type or name, and the storage key is made
 * here — the client never supplies one.
 *
 * Ordering is deliberate. The new object is put in R2 FIRST, then one
 * db.batch() updates the row and writes the audit row. If that batch fails
 * or loses the `updated_at` race (409), the object just uploaded is deleted,
 * so a rejected write leaves nothing behind. Only after the row points at
 * the new key is the OLD object deleted (best effort: a failed delete leaves
 * an unreferenced file, never a broken event). The audit row is the same
 * `WHERE EXISTS`-gated insert the other event writes use, action `update`
 * (audit_log.action is CHECK-limited, migrations/0001).
 *
 * FAIL SOFT: this code can reach production before migration 0019 (the new
 * flyer columns). The UPDATE then throws, and the answer is a clean 503
 * `flyer_unavailable`; nothing else about events is affected.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeEventRequest, eventConflictResponse, EVENT_AUDIT_INSERT_SQL, nextTimestamp, purgeEventsFeed } from "@/lib/adminEvents";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { publicFlyerOf, type EventRow } from "@/lib/events";
import { flyerKey, FLYER_CONTENT_TYPES, inspectFlyer, MAX_FLYER_BYTES, type FlyerExt } from "@/lib/eventFlyers";

export const dynamic = "force-dynamic";

const MAX_ALT_CHARS = 200;
/** Room for the multipart framing and the two alt fields on top of the file. */
const MAX_REQUEST_BYTES = MAX_FLYER_BYTES + 64 * 1024;

const UPDATE_FLYER_SQL = `UPDATE events SET flyer_key = ?, flyer_width = ?, flyer_height = ?, flyer_alt = ?, flyer_alt_es = ?,
    updated_by = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;

function fail(status: number, error: string, message: string, errors?: Record<string, string>): NextResponse {
  return NextResponse.json({ ok: false, error, message, ...(errors ? { errors } : {}) }, { status });
}

const flyerUnavailable = () =>
  fail(503, "flyer_unavailable", "Flyers aren't available yet in this environment. Try again after the next update.");

/** Trimmed text or null; anything over the cap is reported rather than silently cut. */
function altText(value: FormDataEntryValue | null, key: string, errors: Record<string, string>): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t.length > MAX_ALT_CHARS) errors[key] = `Must be ${MAX_ALT_CHARS} characters or fewer.`;
  return t || null;
}

/** Same bad_state/archived answer as PATCH: an archived event is final. */
const archivedResponse = () => fail(409, "archived", "This event is archived and can't be edited.");

async function bucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.EVENT_FLYERS;
}

async function deleteQuietly(r2: R2Bucket, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await r2.delete(key);
  } catch {
    // An unreferenced leftover is harmless; the event row is already correct.
  }
}

interface FlyerFields {
  flyer_key: string | null;
  flyer_width: number | null;
  flyer_height: number | null;
  flyer_alt: string | null;
  flyer_alt_es: string | null;
}

/**
 * Applies `next` to the event in one batch with its audit row and returns the
 * response to send. Deletes `uploaded` (an object this request just put) on
 * any failure, and the replaced object on success.
 */
async function commit(
  req: NextRequest,
  access: AdminDbAccess,
  r2: R2Bucket,
  existing: EventRow,
  next: FlyerFields,
  uploaded: string | null,
  expectedUpdatedAt: string,
): Promise<NextResponse> {
  const { db, identity } = access;
  const now = nextTimestamp(existing.updated_at);
  const after = { ...existing, ...next, updated_by: identity.email, updated_at: now };
  const update = db
    .prepare(UPDATE_FLYER_SQL)
    .bind(next.flyer_key, next.flyer_width, next.flyer_height, next.flyer_alt, next.flyer_alt_es, identity.email, now, existing.id, expectedUpdatedAt);
  const audit = db
    .prepare(EVENT_AUDIT_INSERT_SQL)
    .bind(identity.email, existing.id, "update", JSON.stringify(existing), JSON.stringify(after), now, identity.sessionId ?? null, existing.id, now);

  // update MUST stay statement index 0 — the 409 check reads results[0].
  const results = await db.batch([update, audit]).catch(() => null);
  if (results === null) {
    await deleteQuietly(r2, uploaded);
    return flyerUnavailable();
  }
  if (results[0].meta.changes === 0) {
    await deleteQuietly(r2, uploaded);
    return eventConflictResponse();
  }
  // The row now points at the new key (or none): the old object is garbage.
  if (existing.flyer_key && existing.flyer_key !== next.flyer_key) await deleteQuietly(r2, existing.flyer_key);
  await purgeEventsFeed(req, existing.id);
  return NextResponse.json({ ok: true, updated_at: now, flyer: publicFlyerOf(next) });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await getAdminDb(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { id } = await params;
  const row = await access.db.prepare("SELECT flyer_key FROM events WHERE id = ?").bind(id).first<{ flyer_key: string | null }>();
  if (!row?.flyer_key) return new Response(null, { status: 404 });
  const object = await (await bucket()).get(row.flyer_key);
  if (!object) return new Response(null, { status: 404 });
  const type = FLYER_CONTENT_TYPES[row.flyer_key.split(".").pop() as FlyerExt];
  if (!type) return new Response(null, { status: 404 });
  return new Response(await object.arrayBuffer(), {
    headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeEventRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { id } = await params;

  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return fail(400, "bad_request", "Bad request");
  }
  // Refuse an oversized or length-less body before buffering it (same gate as the public photo route).
  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return fail(411, "content_length_required", "Bad request");
  if (length > MAX_REQUEST_BYTES) {
    return fail(413, "flyer_too_large", "That image is too large.", { flyer: "That image is too large. Choose a smaller one." });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "bad_request", "Bad request");
  }

  const expectedUpdatedAt = form.get("expectedUpdatedAt");
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) {
    return fail(422, "invalid", "expectedUpdatedAt is required.", { _form: "expectedUpdatedAt is required." });
  }
  const errors: Record<string, string> = {};
  const alt = altText(form.get("alt"), "flyer_alt", errors);
  const altEs = altText(form.get("alt_es"), "flyer_alt_es", errors);
  if (Object.keys(errors).length > 0) return fail(422, "invalid", "Check the alt text.", errors);

  const existing = await access.db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
  if (!existing) return fail(404, "not_found", "Not found");
  if (existing.status === "archived") return archivedResponse();

  const file = form.get("flyer");
  const r2 = await bucket();

  // Alt text only — keep the stored file.
  if (!(file instanceof Blob) || file.size === 0) {
    if (!existing.flyer_key) {
      return fail(422, "invalid", "Choose an image.", { flyer: "Choose an image." });
    }
    return commit(
      req, access, r2, existing,
      { flyer_key: existing.flyer_key, flyer_width: existing.flyer_width ?? null, flyer_height: existing.flyer_height ?? null, flyer_alt: alt, flyer_alt_es: altEs },
      null, expectedUpdatedAt,
    );
  }

  if (file.size > MAX_FLYER_BYTES) {
    return fail(413, "flyer_too_large", "That image is too large.", { flyer: "That image is too large. Choose a smaller one." });
  }
  const inspected = inspectFlyer(await file.arrayBuffer());
  if (!inspected) {
    return fail(422, "unsupported_image", "That file isn't a supported image.", { flyer: "That file isn't a JPEG, PNG or WebP image." });
  }

  const key = flyerKey(existing.id, inspected.ext);
  try {
    await r2.put(key, inspected.bytes, { httpMetadata: { contentType: inspected.type } });
  } catch {
    return fail(502, "upload_failed", "The image could not be saved. Try again.", { flyer: "The upload failed. Try again." });
  }
  return commit(
    req, access, r2, existing,
    { flyer_key: key, flyer_width: inspected.width, flyer_height: inspected.height, flyer_alt: alt, flyer_alt_es: altEs },
    key, expectedUpdatedAt,
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeEventRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Bad request");
  }
  const expectedUpdatedAt = (body as { expectedUpdatedAt?: unknown } | null)?.expectedUpdatedAt;
  if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) {
    return fail(422, "invalid", "expectedUpdatedAt is required.", { _form: "expectedUpdatedAt is required." });
  }

  const existing = await access.db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
  if (!existing) return fail(404, "not_found", "Not found");
  if (existing.status === "archived") return archivedResponse();
  if (!existing.flyer_key) return fail(404, "no_flyer", "This event has no flyer.");

  return commit(
    req, access, await bucket(), existing,
    { flyer_key: null, flyer_width: null, flyer_height: null, flyer_alt: null, flyer_alt_es: null },
    null, expectedUpdatedAt,
  );
}
