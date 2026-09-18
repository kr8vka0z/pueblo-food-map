// @vitest-environment jsdom
/**
 * imageResize.test.ts — fitWithin is tested directly (pure math).
 * shrinkImageToJpeg is tested against a STUBBED createImageBitmap/canvas
 * (jsdom implements neither for real) — proves the wiring (decode -> size
 * -> draw -> encode, and the HEIC-style rejection path), not real image
 * decoding, per this file's own header on why the resize math was
 * extracted as a separate pure function in the first place.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fitWithin, shrinkImageToJpeg, UnsupportedImageError } from "@/lib/imageResize";

describe("fitWithin", () => {
  test("leaves an already-small image untouched", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  test("shrinks a landscape image so the longest side hits the cap", () => {
    expect(fitWithin(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  test("shrinks a portrait image the same way, on the height", () => {
    expect(fitWithin(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  test("exactly at the cap is left untouched (no off-by-one shrink)", () => {
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  test("never upscales a smaller-than-cap image", () => {
    expect(fitWithin(400, 300, 1600)).toEqual({ width: 400, height: 300 });
  });

  test("a zero dimension is left alone rather than dividing by zero", () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("shrinkImageToJpeg", () => {
  let toBlobResult: Blob | null;

  beforeEach(() => {
    toBlobResult = new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 3200, height: 2400, close: vi.fn() }) as unknown as ImageBitmap),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(toBlobResult);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("decodes, shrinks to the canvas dimensions, and resolves the encoded blob", async () => {
    const input = new File(["fake-source-bytes"], "photo.jpg", { type: "image/jpeg" });
    const result = await shrinkImageToJpeg(input);
    expect(result).toBe(toBlobResult);
  });

  test("createImageBitmap rejecting (e.g. HEIC) surfaces as UnsupportedImageError", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("no HEIC decoder");
      }),
    );
    const input = new File(["heic-bytes"], "photo.heic", { type: "image/heic" });
    await expect(shrinkImageToJpeg(input)).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  test("canvas.toBlob producing no blob rejects with a real error, not a silent hang", async () => {
    toBlobResult = null;
    const input = new File(["fake-source-bytes"], "photo.jpg", { type: "image/jpeg" });
    await expect(shrinkImageToJpeg(input)).rejects.toThrow("canvas.toBlob produced no blob");
  });
});
