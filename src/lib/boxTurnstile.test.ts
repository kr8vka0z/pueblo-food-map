// @vitest-environment node
/**
 * boxTurnstile.test.ts — direct coverage for resolveBoxTurnstileKey()/
 * verifyBoxTurnstile(), extracted from the checkins route's own tests (this
 * module is the shared logic both the checkins route and the slice 5 photo
 * upload route reuse — see this file's own header).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockVerifyTurnstileToken = vi.fn();
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstileToken(...args),
}));

import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";

describe("resolveBoxTurnstileKey", () => {
  test("'fallback' resolves to 'fallback'", () => {
    expect(resolveBoxTurnstileKey("fallback")).toBe("fallback");
  });

  test.each([undefined, null, "box", "tampered", 123, {}])("anything else (%p) resolves to 'box'", (raw) => {
    expect(resolveBoxTurnstileKey(raw)).toBe("box");
  });
});

describe("verifyBoxTurnstile", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockVerifyTurnstileToken.mockReset();
    mockVerifyTurnstileToken.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("'box' verifies against TURNSTILE_BOX_SECRET_KEY", async () => {
    process.env.TURNSTILE_BOX_SECRET_KEY = "box-secret";
    await verifyBoxTurnstile("t", "box", "1.2.3.4");
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("t", "box-secret", "1.2.3.4");
  });

  test("'fallback' verifies against TURNSTILE_SECRET_KEY", async () => {
    process.env.TURNSTILE_SECRET_KEY = "managed-secret";
    await verifyBoxTurnstile("t", "fallback", "1.2.3.4");
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("t", "managed-secret", "1.2.3.4");
  });

  test("'box' with TURNSTILE_BOX_SECRET_KEY missing -> throws, never verifies", async () => {
    delete process.env.TURNSTILE_BOX_SECRET_KEY;
    await expect(verifyBoxTurnstile("t", "box", "1.2.3.4")).rejects.toThrow("TURNSTILE_BOX_SECRET_KEY not configured");
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });

  test("'fallback' with TURNSTILE_SECRET_KEY missing -> throws, never verifies", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(verifyBoxTurnstile("t", "fallback", "1.2.3.4")).rejects.toThrow("TURNSTILE_SECRET_KEY not configured");
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });
});
