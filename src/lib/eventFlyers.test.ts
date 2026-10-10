// @vitest-environment node
/**
 * eventFlyers.test.ts — the flyer's byte-level gate: only a real JPEG, PNG or
 * WebP gets in (whatever the client called it), dimensions come from the file,
 * and storage keys are server-made and strictly shaped.
 */
import { describe, expect, test } from "vitest";
import { flyerKey, FLYER_FILE_RE, inspectFlyer, MAX_FLYER_BYTES } from "@/lib/eventFlyers";
import { htmlBytes, jpegBytes, pngBytes, svgBytes, webpBytes } from "@/lib/eventFlyers.testutil";

const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

describe("inspectFlyer", () => {
  test("reads type and size from the JPEG's own header", () => {
    expect(inspectFlyer(buf(jpegBytes(300, 420)))).toMatchObject({ type: "image/jpeg", ext: "jpg", width: 300, height: 420 });
  });

  test("PNG and WebP are refused: the server can only strip metadata from a JPEG", () => {
    expect(inspectFlyer(buf(pngBytes(640, 480)))).toBeNull();
    for (const kind of ["lossy", "lossless", "extended"] as const) {
      expect(inspectFlyer(buf(webpBytes(kind, 500, 700)))).toBeNull();
    }
  });

  test("a JPEG comes back with its EXIF stripped", () => {
    const out = inspectFlyer(buf(jpegBytes()));
    expect(new TextDecoder("latin1").decode(out!.bytes)).not.toContain("GPS_SECRET");
  });

  test("rejects an SVG, an HTML file, empty and truncated input", () => {
    expect(inspectFlyer(buf(svgBytes()))).toBeNull();
    expect(inspectFlyer(buf(htmlBytes()))).toBeNull();
    expect(inspectFlyer(new ArrayBuffer(0))).toBeNull();
    expect(inspectFlyer(buf(jpegBytes().slice(0, 6)))).toBeNull();
  });

  test("rejects an image with absurd dimensions (decompression bomb) or zero size", () => {
    expect(inspectFlyer(buf(jpegBytes(60000, 60000)))).toBeNull();
    expect(inspectFlyer(buf(jpegBytes(0, 10)))).toBeNull();
  });
});

describe("flyerKey", () => {
  test("is the event id plus a random file name, different every call", () => {
    const a = flyerKey("evt-1", "jpg");
    expect(a.startsWith("evt-1/")).toBe(true);
    expect(a.slice("evt-1/".length)).toMatch(FLYER_FILE_RE);
    expect(flyerKey("evt-1", "jpg")).not.toBe(a);
  });

  test("the file-name pattern refuses traversal and anything but our own shape", () => {
    for (const bad of ["../x.png", "a/b.png", "x.svg", "x.png", "x.webp", "x.png.html", "", "00000000-0000-4000-8000-000000000000.JPG", "..%2f.png"]) {
      expect(FLYER_FILE_RE.test(bad)).toBe(false);
    }
  });

  test("the size cap is about 200 KB", () => {
    expect(MAX_FLYER_BYTES).toBe(200 * 1024);
  });
});
