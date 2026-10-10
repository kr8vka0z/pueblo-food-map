/**
 * eventFlyers.testutil.ts — tiny hand-built image files for the flyer tests
 * (a real JPEG/PNG/WebP header is all the sniffer reads, so no encoder or
 * fixture binaries are needed). Test-only; never imported by production code.
 */

function segment(marker: number, payload: number[]): number[] {
  const length = 2 + payload.length;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** JPEG with a fake EXIF segment (must be stripped), an SOF of width x height, a tiny scan and EOI. */
export function jpegBytes(width = 10, height = 10, padding = 2): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    ...segment(0xe1, ascii("Exif\0\0GPS_SECRET")),
    ...segment(0xc0, [8, ...u16be(height), ...u16be(width), 1, 1, 0x11, 0]),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    ...Array(Math.max(padding, 2)).fill(0x11),
    0xff, 0xd9,
  ]);
}

/** PNG signature + IHDR (no image data; the sniffer only reads the header). */
export function pngBytes(width = 10, height = 10): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32be(13), ...ascii("IHDR"), ...u32be(width), ...u32be(height), 8, 6, 0, 0, 0,
    0, 0, 0, 0,
  ]);
}

/** WebP in one of its three layouts. */
export function webpBytes(kind: "lossy" | "lossless" | "extended" = "lossless", width = 10, height = 10): Uint8Array {
  let chunk: number[];
  if (kind === "lossy") {
    chunk = [...ascii("VP8 "), 10, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, width & 0xff, (width >> 8) & 0x3f, height & 0xff, (height >> 8) & 0x3f];
  } else if (kind === "lossless") {
    const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
    chunk = [...ascii("VP8L"), 5, 0, 0, 0, 0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff];
  } else {
    const w = width - 1;
    const h = height - 1;
    chunk = [...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff];
  }
  const size = 4 + chunk.length;
  return new Uint8Array([...ascii("RIFF"), size & 0xff, (size >> 8) & 0xff, 0, 0, ...ascii("WEBP"), ...chunk]);
}

export const svgBytes = (): Uint8Array =>
  new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
export const htmlBytes = (): Uint8Array => new TextEncoder().encode("<html><script>alert(1)</script></html>");
