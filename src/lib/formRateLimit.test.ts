// @vitest-environment node
/**
 * Tests for src/lib/formRateLimit.ts (#587). Uses a real counting fake
 * D1Database (same shape as checkinRateLimit.test.ts's makeFakeDb) so these
 * tests exercise the REAL checkAndIncrement counting logic underneath
 * checkFormRateLimit, not a mock of it — proves the per-IP and site-wide
 * caps actually share (or don't share) buckets correctly.
 */

import { describe, test, expect } from "vitest";
import { checkFormRateLimit, MAX_PER_IP_PER_HOUR, MAX_SITE_WIDE_PER_HOUR } from "@/lib/formRateLimit";

const SECRET = "test-rate-limit-secret";

/** Real counting behavior, keyed by the exact bound HMAC key — same convention as checkinRateLimit.test.ts's makeFakeDb. */
function makeFakeDb() {
  const counts = new Map<string, number>();
  const seenKeys: string[] = [];
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async <T,>() => {
        if (!sql.includes("box_checkin_rate_limit") || !sql.includes("RETURNING")) {
          throw new Error("unexpected prepare in fake db: " + sql);
        }
        const key = args[0] as string;
        seenKeys.push(key);
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return { count: next } as unknown as T;
      },
      run: async () => ({ success: true }),
    }),
  });
  return { db: { prepare } as unknown as D1Database, seenKeys };
}

describe("checkFormRateLimit", () => {
  test("allows submissions under both caps", async () => {
    const { db } = makeFakeDb();
    const allowed = await checkFormRateLimit(db, SECRET, "report", "1.2.3.4");
    expect(allowed).toBe(true);
  });

  test(`blocks the ${MAX_PER_IP_PER_HOUR + 1}th submission from the same IP in the window (per-IP cap)`, async () => {
    const { db } = makeFakeDb();
    const results: boolean[] = [];
    for (let i = 0; i < MAX_PER_IP_PER_HOUR + 1; i++) {
      results.push(await checkFormRateLimit(db, SECRET, "report", "5.6.7.8"));
    }
    expect(results.slice(0, MAX_PER_IP_PER_HOUR)).toEqual(Array(MAX_PER_IP_PER_HOUR).fill(true));
    expect(results[MAX_PER_IP_PER_HOUR]).toBe(false);
  });

  test(`blocks the ${MAX_SITE_WIDE_PER_HOUR + 1}th submission across DISTINCT IPs in the window (site-wide cap)`, async () => {
    const { db } = makeFakeDb();
    const results: boolean[] = [];
    for (let i = 0; i < MAX_SITE_WIDE_PER_HOUR + 1; i++) {
      // A distinct IP per request — each is well under its own per-IP cap,
      // so only the site-wide cap can be responsible for the final 429.
      results.push(await checkFormRateLimit(db, SECRET, "suggest", `10.0.${i}.1`));
    }
    expect(results.slice(0, MAX_SITE_WIDE_PER_HOUR)).toEqual(Array(MAX_SITE_WIDE_PER_HOUR).fill(true));
    expect(results[MAX_SITE_WIDE_PER_HOUR]).toBe(false);
  });

  test("different forms don't share a bucket — report's per-IP cap doesn't affect suggest from the same IP", async () => {
    const { db } = makeFakeDb();
    for (let i = 0; i < MAX_PER_IP_PER_HOUR; i++) {
      await checkFormRateLimit(db, SECRET, "report", "9.9.9.9");
    }
    expect(await checkFormRateLimit(db, SECRET, "report", "9.9.9.9")).toBe(false);
    expect(await checkFormRateLimit(db, SECRET, "suggest", "9.9.9.9")).toBe(true);
  });

  test("the stored key never contains the raw IP — HMAC only (no raw IP stored)", async () => {
    const { db, seenKeys } = makeFakeDb();
    await checkFormRateLimit(db, SECRET, "feedback", "203.0.113.42");

    expect(seenKeys.length).toBeGreaterThan(0);
    for (const key of seenKeys) {
      expect(key).not.toContain("203.0.113.42");
      expect(key).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex digest
    }
  });

  test("an over-limit IP is rejected before the site-wide counter is touched (per-IP checked first)", async () => {
    const { db, seenKeys } = makeFakeDb();
    for (let i = 0; i < MAX_PER_IP_PER_HOUR; i++) {
      await checkFormRateLimit(db, SECRET, "report", "4.4.4.4");
    }
    const keysBeforeOverLimitAttempt = seenKeys.length;

    const allowed = await checkFormRateLimit(db, SECRET, "report", "4.4.4.4");

    expect(allowed).toBe(false);
    // Only the per-IP scope was checked on the rejected attempt — the
    // site-wide scope's checkAndIncrement call never ran.
    expect(seenKeys.length).toBe(keysBeforeOverLimitAttempt + 1);
  });
});
