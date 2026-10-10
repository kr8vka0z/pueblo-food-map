/**
 * eventFlyers.ts — the byte-level rules for an event's flyer image (#760,
 * umbrella #156): which files are accepted, how the real type and size are
 * read from the bytes, and what a storage key looks like.
 *
 * WHY sniff the bytes: the client's Content-Type and file name are spoofable,
 * and an SVG or HTML file served from our own origin would run script. Only
 * a file that starts as a real JPEG, PNG or WebP is stored, and the stored
 * content type is the sniffed one, never the client's.
 *
 * Keys are `<eventId>/<uuid>.<ext>`, made here, never taken from a client.
 * A replaced flyer gets a NEW key, which is what lets the public URL be
 * cached for a year: the URL itself changes whenever the picture does.
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

export type FlyerType = "image/jpeg" | "image/png" | "image/webp";
export type FlyerExt = "jpg" | "png" | "webp";

export interface InspectedFlyer {
  type: FlyerType;
  ext: FlyerExt;
  width: number;
  height: number;
  /** What to store: the input, except a JPEG has its EXIF/APPn metadata stripped. */
  bytes: ArrayBuffer;
}

/** The only file-name shape a public flyer URL may carry: a UUID plus one of the three extensions. */
export const FLYER_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** Event ids come from crypto.randomUUID(); older seeded ids are plain slugs. Either way: no slashes, dots or percent signs. */
export const FLYER_EVENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const FLYER_CONTENT_TYPES: Record<FlyerExt, FlyerType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function flyerKey(eventId: string, ext: FlyerExt): string {
  return `${eventId}/${crypto.randomUUID()}.${ext}`;
}

/** The public URL path for a stored key, or null if the key is not in our shape. */
export function flyerPublicPath(key: string): string | null {
  const [eventId, file, ...rest] = key.split("/");
  if (rest.length > 0 || !eventId || !file || !FLYER_EVENT_ID_RE.test(eventId) || !FLYER_FILE_RE.test(file)) return null;
  return `/api/public/events/${eventId}/flyer/${file}`;
}

function ascii(b: Uint8Array, at: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

function pngSize(b: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => b[i] === v) || !ascii(b, 12, "IHDR")) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 25 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  if (ascii(b, 12, "VP8 ")) {
    if (b.length < 30) return null;
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (ascii(b, 12, "VP8L")) {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(b, 12, "VP8X")) {
    if (b.length < 30) return null;
    return {
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  }
  return null;
}

/** The file's real type, size and storable bytes, or null if it is not a sound JPEG, PNG or WebP of sane size. */
export function inspectFlyer(input: ArrayBuffer): InspectedFlyer | null {
  const b = new Uint8Array(input);
  let found: { type: FlyerType; ext: FlyerExt; size: { width: number; height: number }; bytes: ArrayBuffer } | null = null;
  try {
    if (verifyJpegMagic(b)) {
      const bytes = stripMetadataSegments(input);
      found = { type: "image/jpeg", ext: "jpg", size: readJpegDimensions(bytes), bytes };
    } else {
      const png = pngSize(b);
      const webp = png ? null : webpSize(b);
      if (png) found = { type: "image/png", ext: "png", size: png, bytes: input };
      else if (webp) found = { type: "image/webp", ext: "webp", size: webp, bytes: input };
    }
  } catch {
    return null; // a malformed JPEG (InvalidJpegError) is just "not an image we accept"
  }
  if (!found) return null;
  const { width, height } = found.size;
  if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return null;
  return { type: found.type, ext: found.ext, width, height, bytes: found.bytes };
}
