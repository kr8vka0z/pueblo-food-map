/**
 * eventFlyers.ts — the byte-level rules for an event's flyer image (#760,
 * umbrella #156): which files are accepted, how the real type and size are
 * read from the bytes, and what a storage key looks like.
 *
 * WHY JPEG only on the server: the admin form lets the admin PICK a JPEG, PNG
 * or WebP, but always re-encodes it to JPEG in the browser (imageResize.ts),
 * which drops EXIF/GPS/XMP. The server can strip a JPEG's metadata itself
 * (jpegSegments.ts) but has no PNG/WebP stripper, so accepting those would let
 * a direct POST publish location data. The one real client never sends them.
 *
 * WHY sniff the bytes: the client's Content-Type and file name are spoofable,
 * and an SVG or HTML file served from our own origin would run script. Only a
 * file that starts as a real JPEG is stored, and the stored content type is
 * ours, never the client's.
 *
 * Keys are `<eventId>/<uuid>.jpg`, made here, never taken from a client. A
 * replaced flyer gets a NEW key, which is what lets the public URL be cached
 * for a year: the URL itself changes whenever the picture does.
 */

import { readJpegDimensions, stripMetadataSegments, verifyJpegMagic } from "@/lib/jpegSegments";

/**
 * Hard server-side cap. The browser shrinks to about 150 KB before upload
 * (src/lib/imageResize.ts); this is the ceiling for a client that is
 * bypassed, with a little slack so an honest file just over target still lands.
 */
export const MAX_FLYER_BYTES = 200 * 1024;

/** No side may exceed this: a tiny file can still declare a huge canvas that is costly to decode. */
const MAX_SIDE = 4096;

export type FlyerType = "image/jpeg";
export type FlyerExt = "jpg";

export interface InspectedFlyer {
  type: FlyerType;
  ext: FlyerExt;
  width: number;
  height: number;
  /** What to store: the input with its EXIF/APPn metadata stripped. */
  bytes: ArrayBuffer;
}

/** The only file-name shape a public flyer URL may carry: a UUID plus `.jpg`. */
export const FLYER_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

/** Event ids come from crypto.randomUUID(); older seeded ids are plain slugs. Either way: no slashes, dots or percent signs. */
export const FLYER_EVENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const FLYER_CONTENT_TYPES: Record<FlyerExt, FlyerType> = {
  jpg: "image/jpeg",
};

export function flyerKey(eventId: string, ext: FlyerExt = "jpg"): string {
  return `${eventId}/${crypto.randomUUID()}.${ext}`;
}

/** The public URL path for a stored key, or null if the key is not in our shape. */
export function flyerPublicPath(key: string): string | null {
  const [eventId, file, ...rest] = key.split("/");
  if (rest.length > 0 || !eventId || !file || !FLYER_EVENT_ID_RE.test(eventId) || !FLYER_FILE_RE.test(file)) return null;
  return `/api/public/events/${eventId}/flyer/${file}`;
}

/** The file's real size and storable (metadata-stripped) bytes, or null if it is not a sound JPEG of sane size. */
export function inspectFlyer(input: ArrayBuffer): InspectedFlyer | null {
  if (!verifyJpegMagic(new Uint8Array(input))) return null;
  try {
    const bytes = stripMetadataSegments(input);
    const { width, height } = readJpegDimensions(bytes);
    if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return null;
    return { type: "image/jpeg", ext: "jpg", width, height, bytes };
  } catch {
    return null; // a malformed JPEG (InvalidJpegError) is just "not an image we accept"
  }
}
