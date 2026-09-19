import { describe, test, expect } from "vitest";
import { computeNeedsToken, timingSafeEqualHex } from "@/lib/boxNeedsToken";
import { hmacHex } from "@/lib/checkinRateLimit";

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

  // Reviewer fix pass (2026-09-19) — versioned, pipe-delimited message
  // shape (this file's own header explains why).
  test("the HMAC message is the versioned, pipe-delimited 'needs-v1|<checkinId>|<clientToken>' shape", async () => {
    const token = await computeNeedsToken("secret", 42, "client-abc");
    const expected = await hmacHex("secret", "needs-v1|42|client-abc");
    expect(token).toBe(expected);
  });

  test("can never collide with checkinRateLimit.ts's own '${scope}:${id}:${bucket}' key shape, even with the SAME secret — the message spaces are structurally disjoint (colon- vs pipe-delimited, versioned prefix)", async () => {
    const needsToken = await computeNeedsToken("shared-secret", 1, "23:abc");
    // The closest a rate-limit key could get to this input: same secret,
    // similar-looking digits/colons, but built through checkAndIncrement's
    // own colon-joined shape rather than boxNeedsToken's pipe-joined one.
    const rateLimitKey = await hmacHex("shared-secret", "needs-box:1:23");
    expect(needsToken).not.toBe(rateLimitKey);
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
