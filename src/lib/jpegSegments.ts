/**
 * jpegSegments.ts — a small, dependency-free JPEG segment parser for the
 * blessing-box photo upload path (Blessing Boxes slice 5).
 *
 * WHY hand-rolled rather than a library: the ONE thing this needs to do is
 * strip EXIF (and any other APPn metadata) before a photo ever reaches R2 —
 * client-side canvas re-encoding already does this incidentally (browsers
 * drop EXIF when they redraw to a canvas), but the task's own privacy rule
 * ("strip hidden location data from the file") must hold server-side too,
 * since the upload route can never fully trust the client. A JPEG file is a
 * flat sequence of marker segments (ITU-T T.81 Annex B) — walking that
 * structure to drop APP1-APP15 (EXIF lives in APP1; some cameras/apps also
 * write APP2-APP14 for thumbnails, ICC profiles, XMP, etc. — dropped too,
 * on the same "never trust a metadata segment" reasoning) is maybe 80 lines
 * of code, far less than pulling in an image-metadata dependency for one
 * narrow operation this app will only ever do server-side.
 *
 * WHAT IS NOT PARSED: the entropy-coded scan data itself (after SOS). JPEG
 * scan data stuffs literal 0xFF bytes as 0xFF 0x00 and can contain RSTn
 * marker bytes (0xD0-0xD7) at restart-interval boundaries — walking THAT
 * byte-for-byte to find "the next real marker" is a much bigger, genuinely
 * risky parser to get exactly right, and this module has no reason to: once
 * SOS is reached, everything from there to the end of the file is image
 * data, not metadata, so it is copied through verbatim rather than
 * re-parsed. This is the one deliberate scope boundary in this file.
 */

/** APPn range that can carry EXIF/XMP/ICC/etc. — APP0 (JFIF) is the one exception kept (it's just density/thumbnail info, never personal). */
const APP0_MARKER = 0xe0;
const APPN_FIRST = 0xe1; // APP1 — where EXIF (and often XMP) lives
const APPN_LAST = 0xef; // APP15
const SOS_MARKER = 0xda; // Start Of Scan — everything after this is image data, not metadata
const EOI_MARKER = 0xd9; // End Of Image — a standalone marker (no length field)

/** Markers with NO length field — the byte immediately after IS the next marker (or, for SOI, the very start of the file). TEM (0x01) and RST0-RST7 (0xD0-0xD7) never legitimately appear before SOS in a well-formed file, but are handled defensively rather than treated as a parse error. */
function isStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

/** Start-Of-Frame markers that carry image dimensions — the full SOF family (baseline/progressive/lossless variants) EXCLUDING 0xC4 (DHT, a Huffman table), 0xC8 (JPG, reserved, never emitted), and 0xCC (DAC, arithmetic coding) — none of which share SOF's payload shape. */
function isSofMarker(marker: number): boolean {
  return (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

export class InvalidJpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJpegError";
  }
}

/** True if `bytes` starts with a JPEG SOI marker followed by another marker's own 0xFF lead byte — the standard "this is really a JPEG" magic-byte check (content-type headers are trivially spoofable; this reads the file itself). */
export function verifyJpegMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

interface ParsedSegment {
  marker: number;
  /** Index of this segment's leading 0xFF byte. */
  start: number;
  /** Index one past this segment's own header+payload — i.e. where the NEXT segment (or, for SOS, the scan data) begins. */
  end: number;
}

interface ParsedJpeg {
  segments: ParsedSegment[];
  /** Byte offset where entropy-coded scan data begins, right after the SOS segment's own header. Null if the file has no SOS at all (never reached in a well-formed JPEG, but a truncated/corrupt upload can hit this). */
  scanStart: number | null;
}

/**
 * Walks every marker segment from right after SOI up to (and including) the
 * SOS segment's own header — never into the scan data itself (see this
 * file's header). Throws InvalidJpegError on anything that doesn't look
 * like a well-formed marker sequence, rather than guessing — an upload that
 * fails to parse is rejected by the route, never silently passed through
 * with its metadata intact.
 */
function parseJpeg(bytes: Uint8Array): ParsedJpeg {
  if (!verifyJpegMagic(bytes)) {
    throw new InvalidJpegError("Not a JPEG file");
  }

  const segments: ParsedSegment[] = [];
  let pos = 2; // past SOI

  while (pos < bytes.length) {
    // Fill bytes: a marker can be preceded by extra 0xFF padding bytes.
    while (pos < bytes.length && bytes[pos] === 0xff && bytes[pos + 1] === 0xff) pos++;

    if (pos + 1 >= bytes.length || bytes[pos] !== 0xff) {
      throw new InvalidJpegError("Malformed JPEG: expected a marker");
    }
    const markerStart = pos;
    const marker = bytes[pos + 1];
    pos += 2;

    if (marker === EOI_MARKER) {
      segments.push({ marker, start: markerStart, end: pos });
      return { segments, scanStart: null }; // EOI with no SOS at all — degenerate but not our job to fix
    }

    if (isStandaloneMarker(marker)) {
      segments.push({ marker, start: markerStart, end: pos });
      continue;
    }

    if (pos + 1 >= bytes.length) {
      throw new InvalidJpegError("Malformed JPEG: truncated segment length");
    }
    const length = (bytes[pos] << 8) | bytes[pos + 1]; // big-endian, includes these 2 length bytes
    if (length < 2 || pos + length > bytes.length) {
      throw new InvalidJpegError("Malformed JPEG: invalid segment length");
    }
    const segmentEnd = pos + length;
    segments.push({ marker, start: markerStart, end: segmentEnd });

    if (marker === SOS_MARKER) {
      return { segments, scanStart: segmentEnd };
    }
    pos = segmentEnd;
  }

  return { segments, scanStart: null }; // ran off the end without ever finding SOS
}

/**
 * Returns a new ArrayBuffer with every APP1-APP15 segment (EXIF, XMP, ICC
 * profiles, manufacturer notes — anything capable of carrying GPS
 * coordinates or other identifying metadata) removed. APP0 (JFIF — pixel
 * density/thumbnail only) and every other segment (DQT, SOF, DHT, SOS, the
 * scan data itself) pass through byte-for-byte unchanged, so the resulting
 * file decodes identically to the original, just without the metadata.
 * Throws InvalidJpegError on a file that doesn't parse as JPEG at all.
 */
export function stripMetadataSegments(input: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(input);
  const { segments, scanStart } = parseJpeg(bytes);

  const chunks: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  for (const seg of segments) {
    if (seg.marker >= APPN_FIRST && seg.marker <= APPN_LAST) continue; // drop — this is the whole point
    chunks.push(bytes.subarray(seg.start, seg.end));
  }
  // Everything from scanStart to EOF is entropy-coded image data (plus a
  // trailing EOI marker) — copied verbatim, never re-parsed (see file header).
  if (scanStart !== null) {
    chunks.push(bytes.subarray(scanStart));
  }

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out.buffer;
}

/** Pixel dimensions read from the file's own SOF segment — never trusted from the client (see migrations/0009's own header). Throws InvalidJpegError if the file doesn't parse, or has no SOF segment at all. */
export function readJpegDimensions(input: ArrayBuffer): { width: number; height: number } {
  const bytes = new Uint8Array(input);
  const { segments } = parseJpeg(bytes);

  const sof = segments.find((s) => isSofMarker(s.marker));
  if (!sof) throw new InvalidJpegError("No SOF segment found");

  // SOF payload: 2 length bytes (already consumed by the segment header),
  // 1 precision byte, then height (2 bytes BE), then width (2 bytes BE).
  const payloadStart = sof.start + 4; // marker(2) + length(2)
  if (payloadStart + 5 > bytes.length) throw new InvalidJpegError("Truncated SOF segment");
  const height = (bytes[payloadStart + 1] << 8) | bytes[payloadStart + 2];
  const width = (bytes[payloadStart + 3] << 8) | bytes[payloadStart + 4];
  return { width, height };
}
