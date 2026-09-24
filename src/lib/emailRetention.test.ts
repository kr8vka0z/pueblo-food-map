/**
 * Unit tests for emailRetention.ts's once-a-day cron gate
 * (shouldRunEmailRetention) and the runScheduledTasks orchestration. The
 * actual D1 statements are proven for real against SQLite in
 * emailRetention.sql.test.ts — this file covers the pure time-based gate
 * and the scheduled()-wiring glue custom-worker.ts can never carry test
 * coverage for itself (that file imports `.open-next/worker.js`, build
 * output vitest cannot resolve).
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types/experimental";
import { shouldRunEmailRetention, runScheduledTasks } from "@/lib/emailRetention";

describe("shouldRunEmailRetention", () => {
  test("true at the 09:00 UTC slot", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 9, 0))).toBe(true);
  });

  test("false 5 minutes later — the next cron tick that same hour", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 9, 5))).toBe(false);
  });

  test("false one hour earlier", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 8, 0))).toBe(false);
  });

  test("false one hour later", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 10, 0))).toBe(false);
  });

  test("true regardless of the date — one slot every day", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 0, 1, 9, 0))).toBe(true);
    expect(shouldRunEmailRetention(Date.UTC(2027, 11, 31, 9, 0))).toBe(true);
  });
});

// The exact bug this suite guards against: an early `return` (or any other
// shared-guard shape) that makes the ping and the retention call depend on
// each other. This PR's own self-review caught one such coupling once
// already (custom-worker.ts's original `if (!env.HC_PING_URL) return`
// would have also skipped retention) — the Claude CI reviewer flagged that
// the fix itself had no test, which is what this suite is.
describe("runScheduledTasks", () => {
  function fakeCtx() {
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p); } } as unknown as ExecutionContext;
    return { ctx, settle: () => Promise.allSettled(pending) };
  }

  /** Counts `.prepare()` calls — enough to prove runEmailRetentionCleanup ran or didn't, without re-proving its SQL (emailRetention.sql.test.ts already does that against real SQLite). */
  function fakeDb(opts: { throwOnPrepare?: boolean } = {}) {
    let calls = 0;
    const db = {
      prepare: () => {
        calls++;
        if (opts.throwOnPrepare) throw new Error("boom");
        return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
      },
    } as unknown as D1Database;
    return { db, calls: () => calls };
  }

  function fakeEvent(scheduledTime: number): ScheduledController {
    return { scheduledTime, cron: "*/5 * * * *", noRetry: () => {} };
  }

  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test("pings HC.io and runs cleanup when HC_PING_URL is set and the slot matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db, calls } = fakeDb();
    const env = { HC_PING_URL: "https://hc.example/ping", ADMIN_DB: db } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(Date.UTC(2026, 8, 24, 9, 0)), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
    expect(calls()).toBeGreaterThan(0);
  });

  test("skips the ping when HC_PING_URL is unset, but still runs cleanup in-slot — the exact coupling this file guards against", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db, calls } = fakeDb();
    const env = { ADMIN_DB: db } as unknown as CloudflareEnv; // no HC_PING_URL — matches staging

    runScheduledTasks(fakeEvent(Date.UTC(2026, 8, 24, 9, 0)), env, ctx);
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls()).toBeGreaterThan(0);
  });

  test("skips cleanup outside the daily slot, but still pings when HC_PING_URL is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db, calls } = fakeDb();
    const env = { HC_PING_URL: "https://hc.example/ping", ADMIN_DB: db } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(Date.UTC(2026, 8, 24, 9, 5)), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalled();
    expect(calls()).toBe(0);
  });

  test("a cleanup failure never affects the ping — independent ctx.waitUntil calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db } = fakeDb({ throwOnPrepare: true });
    const env = { HC_PING_URL: "https://hc.example/ping", ADMIN_DB: db } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(Date.UTC(2026, 8, 24, 9, 0)), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
  });
});
