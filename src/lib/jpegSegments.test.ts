/**
 * jpegSegments.test.ts — builds a small synthetic-but-structurally-valid
 * JPEG byte sequence (SOI, APP0/JFIF, APP1/EXIF-with-GPS, SOF0, SOS, fake
 * scan data, EOI) rather than shipping a binary fixture file, so the exact
 * bytes under test are visible in the diff and nothing here depends on a
 * real photo ever being committed to this public repo.
 */

import { describe, expect, test } from "vitest";
import { InvalidJpegError, readJpegDimensions, stripMetadataSegments, verifyJpegMagic } from "@/lib/jpegSegments";

/** Builds one marker segment's bytes: 0xFF, marker, 2-byte big-endian length (2 + payload.length), then the payload. */
function segment(marker: number, payload: number[]): number[] {
  const length = 2 + payload.length;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

const GPS_MARKER_TEXT = "GPS_LAT_LONG_SECRET_LOCATION";
function textBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

/** A structurally valid JPEG: SOI, APP0 (JFIF), APP1 (fake EXIF carrying a GPS-looking marker string), SOF0 (200x100, 1 component), SOS, some fake scan bytes (including a stuffed 0xFF 0x00), EOI. */
function buildFakeJpeg(): Uint8Array {
  const bytes = [
    0xff,
    0xd8, // SOI
    ...segment(0xe0, [...textBytes("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]), // APP0
    ...segment(0xe1, textBytes(`Exif\0\0${GPS_MARKER_TEXT}`)), // APP1 — EXIF, must be stripped
    ...segment(0xc0, [8, 0, 100, 0, 200, 1, 1, 0x11, 0]), // SOF0: precision=8, height=100, width=200, 1 component
    ...segment(0xda, [1, 1, 0, 0, 63, 0]), // SOS: 1 component
    0x12,
    0x34,
    0xff,
    0x00,
    0x56, // fake entropy-coded scan data (includes a stuffed 0xFF 0x00)
    0xff,
    0xd9, // EOI
  ];
  return new Uint8Array(bytes);
}

describe("verifyJpegMagic", () => {
  test("a real JPEG's leading bytes pass", () => {
    expect(verifyJpegMagic(buildFakeJpeg())).toBe(true);
  });

  test("random bytes fail", () => {
    expect(verifyJpegMagic(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe(false);
  });

  test("a PNG's magic bytes fail", () => {
    expect(verifyJpegMagic(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  test("too short to check fails, not throws", () => {
    expect(verifyJpegMagic(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});

describe("readJpegDimensions", () => {
  test("reads width/height from the SOF0 segment", () => {
    expect(readJpegDimensions(buildFakeJpeg().buffer as ArrayBuffer)).toEqual({ width: 200, height: 100 });
  });

  test("throws InvalidJpegError on a non-JPEG buffer", () => {
    expect(() => readJpegDimensions(new Uint8Array([0, 1, 2, 3]).buffer as ArrayBuffer)).toThrow(InvalidJpegError);
  });

  test("throws InvalidJpegError when no SOF segment exists", () => {
    const noSof = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // SOI + EOI only
    expect(() => readJpegDimensions(noSof.buffer as ArrayBuffer)).toThrow(InvalidJpegError);
  });
});

describe("stripMetadataSegments", () => {
  test("removes the EXIF (APP1) segment entirely — the GPS marker text is gone", () => {
    const stripped = stripMetadataSegments(buildFakeJpeg().buffer as ArrayBuffer);
    const text = new TextDecoder("latin1").decode(stripped);
    expect(text).not.toContain(GPS_MARKER_TEXT);
    expect(text).not.toContain("Exif");
  });

  test("keeps APP0 (JFIF) — not metadata capable of identifying a person or place", () => {
    const stripped = new Uint8Array(stripMetadataSegments(buildFakeJpeg().buffer as ArrayBuffer));
    const text = new TextDecoder("latin1").decode(stripped);
    expect(text).toContain("JFIF");
  });

  test("keeps SOF, SOS, and the scan data byte-for-byte, including a stuffed 0xFF 0x00", () => {
    const stripped = new Uint8Array(stripMetadataSegments(buildFakeJpeg().buffer as ArrayBuffer));
    // The scan bytes (0x12 0x34 0xFF 0x00 0x56) plus the trailing EOI must
    // survive completely unchanged — this module never parses scan data.
    const tail = Array.from(stripped.slice(-7));
    expect(tail).toEqual([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]);
  });

  test("dimensions are unchanged after stripping — SOF is untouched", () => {
    const stripped = stripMetadataSegments(buildFakeJpeg().buffer as ArrayBuffer);
    expect(readJpegDimensions(stripped)).toEqual({ width: 200, height: 100 });
  });

  test("throws InvalidJpegError on a non-JPEG buffer, never silently passes it through", () => {
    expect(() => stripMetadataSegments(new Uint8Array([0, 1, 2, 3]).buffer as ArrayBuffer)).toThrow(
      InvalidJpegError,
    );
  });

  test("a JPEG with no APP1 at all round-trips unchanged in content", () => {
    const noExif = new Uint8Array([
      0xff,
      0xd8,
      ...segment(0xc0, [8, 0, 10, 0, 10, 1, 1, 0x11, 0]),
      ...segment(0xda, [1, 1, 0, 0, 63, 0]),
      0x01,
      0x02,
      0xff,
      0xd9,
    ]);
    const stripped = new Uint8Array(stripMetadataSegments(noExif.buffer as ArrayBuffer));
    expect(Array.from(stripped)).toEqual(Array.from(noExif));
  });
});
