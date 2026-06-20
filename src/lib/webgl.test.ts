/**
 * Tests for isWebGLAvailable() — canvas-based WebGL probe.
 *
 * jsdom's HTMLCanvasElement.getContext() returns null by default (no real GPU),
 * which we leverage directly for the "unavailable" case. We mock a non-null
 * return for the "available" case. The SSR guard (typeof window === "undefined")
 * is tested by temporarily removing the window global.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { isWebGLAvailable } from "@/lib/webgl";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isWebGLAvailable", () => {
  test("returns true when getContext returns a WebGL context", () => {
    // Simulate a device that supports WebGL2: getContext("webgl2") returns
    // a non-null object.
    const fakeCtx = {} as WebGL2RenderingContext;
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((contextId: string) => {
        if (contextId === "webgl2") return fakeCtx;
        return null;
      });

    expect(isWebGLAvailable()).toBe(true);
    getContextSpy.mockRestore();
  });

  test("falls through to webgl when webgl2 unavailable", () => {
    const fakeCtx = {} as WebGLRenderingContext;
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((contextId: string) => {
        if (contextId === "webgl") return fakeCtx;
        return null;
      });

    expect(isWebGLAvailable()).toBe(true);
    getContextSpy.mockRestore();
  });

  test("falls through to experimental-webgl when webgl/webgl2 unavailable", () => {
    const fakeCtx = {} as WebGLRenderingContext;
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((contextId: string) => {
        if (contextId === "experimental-webgl") return fakeCtx;
        return null;
      });

    expect(isWebGLAvailable()).toBe(true);
    getContextSpy.mockRestore();
  });

  test("returns false when all getContext calls return null (jsdom default)", () => {
    // jsdom returns null for all canvas contexts by default — no mock needed.
    // This is the exact condition on a device without WebGL.
    expect(isWebGLAvailable()).toBe(false);
  });

  test("returns false when getContext throws (privacy-hardened browser)", () => {
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => {
        throw new Error("SecurityError: WebGL is disabled");
      });

    expect(isWebGLAvailable()).toBe(false);
    getContextSpy.mockRestore();
  });

  test("returns true in SSR environment (window is undefined)", () => {
    // WHY: the server has no WebGL; returning true prevents the fallback from
    // being server-rendered, which would cause a hydration mismatch.
    const originalWindow = global.window;
    // @ts-expect-error — deliberately removing window to simulate SSR
    delete global.window;

    try {
      expect(isWebGLAvailable()).toBe(true);
    } finally {
      global.window = originalWindow;
    }
  });
});
