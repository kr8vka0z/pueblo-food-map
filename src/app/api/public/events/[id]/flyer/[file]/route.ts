/**
 * GET /api/public/events/[id]/flyer/[file] — streams an event's flyer image
 * from the EVENT_FLYERS bucket (#760, umbrella #156).
 *
 * What it will serve, and nothing else: an object whose key is exactly
 * `<id>/<file>` AND is the key currently stored on a `published` or
 * `cancelled` event with that id. So:
 *   - `[id]` and `[file]` must match strict patterns (src/lib/eventFlyers.ts)
 *     before anything is read: no slashes, dots or encodings, so a request can
 *     never name a path of its own or reach another bucket's object (the route
 *     only ever holds the EVENT_FLYERS binding anyway);
 *   - a draft's or archived event's flyer answers 404, exactly like an unknown
 *     one, even for someone holding the URL;
 *   - the flyer of a replaced or removed picture 404s at once (its key no
 *     longer matches the row), even if the delete failed.
 *
 * Caching: `public, max-age=31536000, immutable`. That is safe because the
 * key is a fresh random name on every upload, so a changed picture is a new
 * URL and an old URL never changes meaning. The one trade-off: someone who
 * already loaded a flyer keeps it in their own browser after the event is
 * archived; it was public while published. A 404 is never cached.
 * ponytail: no Workers Cache API layer (the blessing-box photo route has one)
 * because an archived event's flyer would then linger at the edge too; every
 * first view costs one primary-key D1 read + one R2 read. Upgrade path:
 * caches.default with a short TTL if flyer traffic ever warrants it.
 *
 * `Content-Type` comes from the file extension in the validated name, which
 * the upload route set from the sniffed bytes; with
 * `X-Content-Type-Options: nosniff` the browser never reinterprets it.
 */

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { FLYER_CONTENT_TYPES, FLYER_EVENT_ID_RE, FLYER_FILE_RE, type FlyerExt } from "@/lib/eventFlyers";

export const dynamic = "force-dynamic";

const notFound = () => new Response(null, { status: 404 });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; file: string }> },
): Promise<Response> {
  const { id, file } = await params;
  if (!FLYER_EVENT_ID_RE.test(id) || !FLYER_FILE_RE.test(file)) return notFound();

  let db: D1Database;
  let bucket: R2Bucket;
  try {
    ({ env: { ADMIN_DB: db, EVENT_FLYERS: bucket } } = getCloudflareContext());
  } catch {
    return notFound(); // no live Worker context: degrade like "not found", never a 500 for an image
  }

  const key = `${id}/${file}`;
  let row: { flyer_key: string | null; status: string } | null;
  try {
    row = await db.prepare("SELECT flyer_key, status FROM events WHERE id = ?").bind(id).first();
  } catch {
    return notFound(); // e.g. the events table is not there yet
  }
  if (!row || row.flyer_key !== key || (row.status !== "published" && row.status !== "cancelled")) return notFound();

  const object = await bucket.get(key);
  if (!object) return notFound(); // row points at a missing object: a clean card without it, never a crash

  return new Response(await object.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": FLYER_CONTENT_TYPES[file.slice(file.lastIndexOf(".") + 1) as FlyerExt],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
