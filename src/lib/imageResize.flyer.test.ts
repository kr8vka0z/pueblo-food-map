// @vitest-environment jsdom
/**
 * shrinkFlyerToJpeg (#760): the ladder walk against a stubbed canvas (jsdom
 * has no real one). Proves it stops at the first rung under the budget, never
 * crops (aspect ratio kept), flattens onto white, and returns the smallest try
 * when nothing fits.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FLYER_LADDER, shrinkFlyerToJpeg, UnsupportedImageError } from "@/lib/imageResize";

let sizes: number[];
let calls: { w: number; h: number; q: number }[];
let fillStyles: string[];

beforeEach(() => {
  calls = [];
  fillStyles = [];
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2000, height: 3000, close: vi.fn() }) as unknown as ImageBitmap));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return {
      set fillStyle(v: string) { fillStyles.push(v); },
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback, _t?: string, q?: number) {
    calls.push({ w: this.width, h: this.height, q: q as number });
    cb(new Blob([new Uint8Array(sizes[calls.length - 1] ?? 1)], { type: "image/jpeg" }));
  } as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shrinkFlyerToJpeg", () => {
  test("stops at the first rung that fits the budget and keeps the portrait aspect (no crop)", async () => {
    sizes = [400_000, 300_000, 140_000];
    const out = await shrinkFlyerToJpeg(new Blob(["x"]), 150_000);
    expect(out.size).toBe(140_000);
    expect(calls).toHaveLength(3);
    expect(calls[2]).toEqual({ w: Math.round(1400 * (2000 / 3000)), h: 1400, q: 0.65 });
  });

  test("flattens onto white before drawing", async () => {
    sizes = [1000];
    await shrinkFlyerToJpeg(new Blob(["x"]));
    expect(fillStyles).toContain("#fff");
  });

  test("when nothing fits it returns the smallest attempt, after trying every rung", async () => {
    sizes = FLYER_LADDER.map((_, i) => 900_000 - i * 10_000);
    const out = await shrinkFlyerToJpeg(new Blob(["x"]), 150_000);
    expect(calls).toHaveLength(FLYER_LADDER.length);
    expect(out.size).toBe(900_000 - (FLYER_LADDER.length - 1) * 10_000);
  });

  test("an undecodable file (e.g. HEIC) is an UnsupportedImageError", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("no decoder"); }));
    await expect(shrinkFlyerToJpeg(new Blob(["x"]))).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
