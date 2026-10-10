/**
 * imageResize.ts — client-side photo shrink for the Blessing Boxes upload
 * flow (slice 5): resize to a longest side of ~1600px and re-encode to
 * JPEG via <canvas>, which drops EXIF (including GPS) as a side effect of
 * producing fresh encoded bytes. This is the "shrink for upload size" half
 * of the privacy story only — the server strips metadata again
 * independently and authoritatively (src/lib/jpegSegments.ts), since a
 * client can always be bypassed.
 *
 * WHY createImageBitmap + canvas, not an <img> element: createImageBitmap
 * decodes without inserting a real DOM image, and its
 * `imageOrientation: "from-image"` option applies any EXIF orientation tag
 * during decode — so the redrawn canvas is already upright, no separate
 * orientation-correction step needed.
 *
 * HEIC handling: a browser with no native HEIC decoder simply rejects the
 * createImageBitmap() call — caught here and re-thrown as
 * UnsupportedImageError so BoxCheckinPanel can show one friendly message
 * ("try a JPEG or PNG") instead of a raw DOMException.
 *
 * ponytail: fixed JPEG quality (0.8) and longest-side (1600px) rather than
 * a size-seeking loop that re-encodes at falling quality until under a byte
 * target — simpler, and the server's own MAX_PHOTO_BYTES (2MB,
 * src/lib/boxPhotos.ts) backstops anything unusual. Upgrade path: iterate
 * quality downward if a real photo ever trips that server-side guard often
 * enough to matter.
 */

export class UnsupportedImageError extends Error {
  constructor() {
    super("Unsupported image format");
    this.name = "UnsupportedImageError";
  }
}

const MAX_LONGEST_SIDE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Pure resize math, extracted so it's unit-testable without a real
 * canvas/image decode (jsdom has neither). Never upscales — a `maxSide`
 * ceiling only ever shrinks.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest === 0 || longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Decodes `file`, shrinks it to fitWithin(..., 1600), and re-encodes as a
 * JPEG Blob. Throws UnsupportedImageError on an undecodable format (e.g.
 * HEIC on a browser with no native decoder).
 */
export async function shrinkImageToJpeg(file: File | Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnsupportedImageError();
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_LONGEST_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob produced no blob"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Event flyers (#760): fit within a box and aim for a byte budget instead of
 * a fixed quality. A flyer is often a portrait page with small print, so it
 * is never cropped; instead the encoder walks down a ladder of (longest side,
 * JPEG quality) until the file is small enough. The first rung that fits wins,
 * so a simple graphic keeps its sharpness and a busy photo gets squeezed only
 * as far as it must. The server's hard cap (MAX_FLYER_BYTES, eventFlyers.ts)
 * backstops a file that never fits.
 */
export const FLYER_TARGET_BYTES = 150 * 1024;

/** [longest side px, quality], best first. Exported so the walk is testable without a canvas. */
export const FLYER_LADDER: ReadonlyArray<readonly [number, number]> = [
  [1400, 0.85], [1400, 0.75], [1400, 0.65],
  [1200, 0.7], [1200, 0.6],
  [1000, 0.6], [1000, 0.5],
  [800, 0.5], [800, 0.4],
];

/**
 * Decodes `file` once and returns the first JPEG at or under `targetBytes`
 * (else the smallest one tried). The canvas is filled white first: a
 * transparent PNG would otherwise turn black when flattened to JPEG.
 */
export async function shrinkFlyerToJpeg(file: File | Blob, targetBytes = FLYER_TARGET_BYTES): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnsupportedImageError();
  }
  try {
    let smallest: Blob | null = null;
    for (const [maxSide, quality] of FLYER_LADDER) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob produced no blob"))), "image/jpeg", quality);
      });
      if (blob.size <= targetBytes) return blob;
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
    return smallest as Blob;
  } finally {
    bitmap.close();
  }
}
