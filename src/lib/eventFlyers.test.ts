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
  test("reads type and size from the bytes of each allowed format", () => {
    expect(inspectFlyer(buf(jpegBytes(300, 420)))).toMatchObject({ type: "image/jpeg", ext: "jpg", width: 300, height: 420 });
    expect(inspectFlyer(buf(pngBytes(640, 480)))).toMatchObject({ type: "image/png", ext: "png", width: 640, height: 480 });
    expect(inspectFlyer(buf(webpBytes("lossy", 500, 700)))).toMatchObject({ type: "image/webp", width: 500, height: 700 });
    expect(inspectFlyer(buf(webpBytes("lossless", 500, 700)))).toMatchObject({ type: "image/webp", width: 500, height: 700 });
    expect(inspectFlyer(buf(webpBytes("extended", 500, 700)))).toMatchObject({ type: "image/webp", width: 500, height: 700 });
  });

  test("a JPEG comes back with its EXIF stripped", () => {
    const out = inspectFlyer(buf(jpegBytes()));
    expect(new TextDecoder("latin1").decode(out!.bytes)).not.toContain("GPS_SECRET");
  });

  test("rejects an SVG, an HTML file, empty and truncated input", () => {
    expect(inspectFlyer(buf(svgBytes()))).toBeNull();
    expect(inspectFlyer(buf(htmlBytes()))).toBeNull();
    expect(inspectFlyer(new ArrayBuffer(0))).toBeNull();
    expect(inspectFlyer(buf(pngBytes().slice(0, 12)))).toBeNull();
    expect(inspectFlyer(buf(jpegBytes().slice(0, 6)))).toBeNull();
  });

  test("rejects an image with absurd dimensions (decompression bomb) or zero size", () => {
    expect(inspectFlyer(buf(pngBytes(60000, 60000)))).toBeNull();
    expect(inspectFlyer(buf(pngBytes(0, 10)))).toBeNull();
  });
});

describe("flyerKey", () => {
  test("is the event id plus a random file name, different every call", () => {
    const a = flyerKey("evt-1", "png");
    expect(a.startsWith("evt-1/")).toBe(true);
    expect(a.slice("evt-1/".length)).toMatch(FLYER_FILE_RE);
    expect(flyerKey("evt-1", "png")).not.toBe(a);
  });

  test("the file-name pattern refuses traversal and anything but our own shape", () => {
    for (const bad of ["../x.png", "a/b.png", "x.svg", "x.png.html", "", "00000000-0000-4000-8000-000000000000.PNG", "..%2f.png"]) {
      expect(FLYER_FILE_RE.test(bad)).toBe(false);
    }
  });

  test("the size cap is about 200 KB", () => {
    expect(MAX_FLYER_BYTES).toBe(200 * 1024);
  });
});
