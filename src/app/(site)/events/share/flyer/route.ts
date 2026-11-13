/**
 * POST /events/share/flyer — the optional flyer on the public "Share an
 * event" form (#883). Multipart: `flyer` (the file) and `website` (honeypot).
 * Returns `{ ok: true, key, width, height }`; the form sends the key with
 * the submission.
 *
 * Byte rules and the private pending prefix: src/lib/eventFlyers.ts.
 *
 * WHY no Turnstile here: the form has one Turnstile token and siteverify
 * accepts it once; the submit route spends it. This route is bounded instead
 * by the honeypot, the pre-parse size gate, and its own D1 counters (per IP
 * and site-wide, separate scopes from the submit's so a re-picked flyer
 * doesn't eat the sender's submit budget).
 * ponytail: a flyer uploaded and never submitted stays in the bucket
 * (at most 100 x 200 KB an hour). Upgrade path: an R2
 * lifecycle rule expiring `pending.submissions/` after 30 days, or the
 * scheduled job deleting pending keys no event_submissions row names.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { checkFormRateLimit } from "@/lib/formRateLimit";
import { inspectFlyer, MAX_FLYER_BYTES, pendingFlyerKey } from "@/lib/eventFlyers";
import { logFormFailure } from "@/lib/logger";
import { requestIp } from "@/lib/publicRequest";

export const dynamic = "force-dynamic";

/** Room for the multipart framing on top of the file. */
const MAX_REQUEST_BYTES = MAX_FLYER_BYTES + 16 * 1024;

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) return fail(400, "Bad request");
  // Refuse an oversized or length-less body before buffering it (same gate as the box photo route).
  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) return fail(411, "content_length_required");
  if (length > MAX_REQUEST_BYTES) return fail(413, "flyer_too_large");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Bad request");
  }
  const honeypot = form.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") return NextResponse.json({ ok: true, key: null });

  const secret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  let db: D1Database;
  let bucket: R2Bucket;
  try {
    ({ env: { ADMIN_DB: db, EVENT_FLYERS: bucket } } = getCloudflareContext());
  } catch {
    return fail(503, "unavailable");
  }

  // A few re-picks per sender; site-wide twice the submit's cap, still a bounded bucket.
  if (!(await checkFormRateLimit(db, secret, "event-flyer", requestIp(req), { perIp: 10, siteWide: 100 }))) {
    return fail(429, "rate_limit");
  }

  const file = form.get("flyer");
  if (!(file instanceof Blob) || file.size === 0) return fail(422, "unsupported_image");
  if (file.size > MAX_FLYER_BYTES) return fail(413, "flyer_too_large");
  const inspected = inspectFlyer(await file.arrayBuffer());
  if (!inspected) return fail(422, "unsupported_image");

  const key = pendingFlyerKey();
  try {
    await bucket.put(key, inspected.bytes, { httpMetadata: { contentType: inspected.type } });
  } catch (err) {
    logFormFailure("event_flyer", "db_write_failed", { message: err instanceof Error ? err.message : "unknown error" });
    return fail(502, "upload_failed");
  }
  // Real size from the bytes, so the form's preview reserves the right shape.
  return NextResponse.json({ ok: true, key, width: inspected.width, height: inspected.height });
}
