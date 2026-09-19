import { describe, test, expect } from "vitest";
import { computeNeedsToken, timingSafeEqualHex } from "@/lib/boxNeedsToken";

describe("computeNeedsToken", () => {
  test("is deterministic for the same secret/checkinId/clientToken", async () => {
    const a = await computeNeedsToken("secret", 42, "client-abc");
    const b = await computeNeedsToken("secret", 42, "client-abc");
    expect(a).toBe(b);
  });

  test("differs when checkinId differs", async () => {
    const a = await computeNeedsToken("secret", 42, "client-abc");
    const b = await computeNeedsToken("secret", 43, "client-abc");
    expect(a).not.toBe(b);
  });

  test("differs when clientToken differs", async () => {
    const a = await computeNeedsToken("secret", 42, "client-abc");
    const b = await computeNeedsToken("secret", 42, "client-xyz");
    expect(a).not.toBe(b);
  });

  test("differs when secret differs (can't be forged without it)", async () => {
    const a = await computeNeedsToken("secret-1", 42, "client-abc");
    const b = await computeNeedsToken("secret-2", 42, "client-abc");
    expect(a).not.toBe(b);
  });

  test("a null clientToken normalizes to the same token as an empty string", async () => {
    const a = await computeNeedsToken("secret", 42, null);
    const b = await computeNeedsToken("secret", 42, "");
    expect(a).toBe(b);
  });

  test("returns a hex string", async () => {
    const token = await computeNeedsToken("secret", 42, "client-abc");
    expect(token).toMatch(/^[0-9a-f]+$/);
  });
});

describe("timingSafeEqualHex", () => {
  test("equal strings compare equal", () => {
    expect(timingSafeEqualHex("abc123", "abc123")).toBe(true);
  });

  test("different strings of the same length compare unequal", () => {
    expect(timingSafeEqualHex("abc123", "abc124")).toBe(false);
  });

  test("different-length strings compare unequal without throwing", () => {
    expect(timingSafeEqualHex("abc", "abcdef")).toBe(false);
  });

  test("empty strings compare equal", () => {
    expect(timingSafeEqualHex("", "")).toBe(true);
  });
});
