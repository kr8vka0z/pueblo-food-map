// @vitest-environment node
/**
 * Tests for src/lib/checkinRateLimit.ts (Blessing Boxes slice 2).
 *
 * A fake D1Database implements the exact INSERT...ON CONFLICT...RETURNING
 * contract this file depends on (a real counter keyed by the bound `key`),
 * so these tests prove the counting/threshold/fail-closed logic without a
 * live D1 binding — same convention as blessingBoxes.test.ts's makeFakeDb.
 */

import { describe, test, expect } from "vitest";
import { checkAndIncrement } from "@/lib/checkinRateLimit";

const SECRET = "test-turnstile-secret";
const NOW = new Date("2026-09-17T12:00:00.000Z");

/** Real counting behavior: each distinct bound key gets its own incrementing count, exactly what the real ON CONFLICT DO UPDATE SET count = count + 1 does. */
function makeFakeDb() {
  const counts = new Map<string, number>();
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async <T,>() => {
        if (!sql.includes("box_checkin_rate_limit") || !sql.includes("RETURNING")) {
          throw new Error("unexpected prepare in rate-limit fake db: " + sql);
        }
        const key = args[0] as string;
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return { count: next } as unknown as T;
      },
      run: async () => ({ success: true }),
    }),
  });
  return { db: { prepare } as unknown as D1Database, counts };
}

describe("checkAndIncrement", () => {
  test("first check-in for a fresh key is allowed", async () => {
    const { db } = makeFakeDb();
    const allowed = await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 3, NOW);
    expect(allowed).toBe(true);
  });

  test("allows up to `max` check-ins, blocks the one after", async () => {
    const { db } = makeFakeDb();
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 3, NOW));
    }
    expect(results).toEqual([true, true, true, false]);
  });

  test("different `id`s within the same scope are counted independently", async () => {
    const { db } = makeFakeDb();
    await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 1, NOW);
    const secondBoxFirstHit = await checkAndIncrement(db, SECRET, { scope: "box", id: "box-b" }, 1, NOW);
    expect(secondBoxFirstHit).toBe(true);
  });

  test("different `scope`s for the same `id` are counted independently (per-box cap vs. per-visitor-per-box cap don't share a bucket)", async () => {
    const { db } = makeFakeDb();
    await checkAndIncrement(db, SECRET, { scope: "box", id: "same-id" }, 1, NOW);
    const otherScope = await checkAndIncrement(db, SECRET, { scope: "visitor-box", id: "same-id" }, 1, NOW);
    expect(otherScope).toBe(true);
  });

  test("a new hour bucket resets the count", async () => {
    const { db } = makeFakeDb();
    await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 1, NOW);
    const blockedSameHour = await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 1, NOW);
    expect(blockedSameHour).toBe(false);

    const nextHour = new Date(NOW.getTime() + 60 * 60 * 1000);
    const allowedNextHour = await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 1, nextHour);
    expect(allowedNextHour).toBe(true);
  });

  test("the stored key never contains the raw box id or client token — HMAC only", async () => {
    const seenKeys: string[] = [];
    const prepare = () => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          seenKeys.push(args[0] as string);
          return { count: 1 };
        },
        run: async () => ({ success: true }),
      }),
    });
    const db = { prepare } as unknown as D1Database;

    await checkAndIncrement(db, SECRET, { scope: "visitor-box", id: "super-secret-client-token:box-a" }, 5, NOW);

    expect(seenKeys).toHaveLength(1);
    expect(seenKeys[0]).not.toContain("super-secret-client-token");
    expect(seenKeys[0]).not.toContain("box-a");
    expect(seenKeys[0]).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex digest
  });

  test("a D1 failure fails CLOSED (returns false), never throws", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            throw new Error("D1 is down");
          },
        }),
      }),
    } as unknown as D1Database;

    const allowed = await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 5, NOW);
    expect(allowed).toBe(false);
  });

  test("a failed opportunistic sweep does not affect the returned result", async () => {
    const prepare = (sql: string) => {
      if (sql.includes("DELETE")) {
        return {
          bind: () => ({
            run: async () => {
              throw new Error("sweep failed");
            },
          }),
        };
      }
      return {
        bind: () => ({
          first: async () => ({ count: 1 }),
        }),
      };
    };
    const db = { prepare } as unknown as D1Database;

    const allowed = await checkAndIncrement(db, SECRET, { scope: "box", id: "box-a" }, 5, NOW);
    expect(allowed).toBe(true);
  });
});
