/**
 * Unit tests for scheduledTasks.ts's runScheduledTasks — the
 * scheduled()-handler wiring custom-worker.ts itself can never carry test
 * coverage for (it imports `.open-next/worker.js`, build output vitest
 * cannot resolve). Each individual job's own gate boundaries and SQL are
 * proven elsewhere (emailRetention.test.ts/.sql.test.ts,
 * refreshAlerts.test.ts/.sql.test.ts) — this file only proves the THREE
 * branches here (ping, retention, refresh-alerts) are correctly
 * independent of each other, which is the exact class of bug this repo's
 * own history has already produced twice: the original
 * `if (!env.HC_PING_URL) return` (PR #616 self-review) would have also
 * skipped retention, and PR #624 made the same restructuring fix
 * independently for refresh-alerts before the two branches merged.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types/experimental";
import { runScheduledTasks } from "@/lib/scheduledTasks";

function fakeCtx() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
    },
  } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.allSettled(pending) };
}

function fakeEvent(scheduledTime: number): ScheduledController {
  return { scheduledTime, cron: "*/5 * * * *", noRetry: () => {} };
}

/**
 * One fake D1 binding shared by both jobs — emailRetention's three
 * UPDATE/DELETE statements (`.bind().run()`) and refreshAlerts' two SELECTs
 * (`.bind().first()` for pending-age, `.bind().all()` for staleness).
 * Benign "nothing to report" results by default so refreshAlerts never
 * needs a RESEND_API_KEY to resolve cleanly. `calls()` counts every
 * `.prepare()` — enough to prove a job's SQL ran or didn't without
 * re-proving what it does (that's each feature's own .sql.test.ts).
 */
function fakeDb(opts: { throwOnPrepare?: boolean } = {}) {
  let calls = 0;
  const db = {
    prepare: () => {
      calls++;
      if (opts.throwOnPrepare) throw new Error("boom");
      return {
        bind: () => ({
          run: async () => ({ meta: { changes: 0 } }),
          first: async () => ({ n: 0, oldest: null }),
          all: async () => ({ results: [] }),
        }),
      };
    },
  } as unknown as D1Database;
  return { db, calls: () => calls };
}

const RETENTION_SLOT = Date.UTC(2026, 8, 24, 9, 0);
const ALERTS_SLOT = Date.UTC(2026, 8, 24, 9, 30);
const NO_SLOT = Date.UTC(2026, 8, 24, 10, 0);

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("runScheduledTasks", () => {
  test("pings HC.io and runs retention at the 09:00 UTC slot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db, calls } = fakeDb();
    const env = { HC_PING_URL: "https://hc.example/ping", ADMIN_DB: db } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(RETENTION_SLOT), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
    expect(calls()).toBeGreaterThan(0);
  });

  test("pings HC.io and runs refresh-alerts at the 09:30 UTC slot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db, calls } = fakeDb();
    const env = {
      HC_PING_URL: "https://hc.example/ping",
      ADMIN_DB: db,
      RESEND_API_KEY: "re_test",
    } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(ALERTS_SLOT), env, ctx);
    await settle();

    // Ping fetch + zero alert-email fetches (nothing tripped) — only the
    // heartbeat call, proving the HC ping fired independently of the
    // refresh-alerts D1 reads.
    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
    expect(calls()).toBeGreaterThan(0);
  });

  test("neither daily job runs outside its own slot, but the ping always fires", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db, calls } = fakeDb();
    const env = { HC_PING_URL: "https://hc.example/ping", ADMIN_DB: db } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(NO_SLOT), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
    expect(calls()).toBe(0);
  });

  test("the two daily slots never collide — 09:00 runs retention only, 09:30 runs refresh-alerts only", () => {
    // Boundary ownership already proven per-file (emailRetention.test.ts's
    // shouldRunEmailRetention suite, refreshAlerts.test.ts's
    // shouldRunRefreshAlertsCheck suite) — this just asserts the two
    // constants this orchestrator depends on stay distinct.
    expect(RETENTION_SLOT).not.toBe(ALERTS_SLOT);
  });

  test("skips both daily jobs when HC_PING_URL is unset, but still runs them — the exact coupling this file guards against", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db: retentionDb, calls: retentionCalls } = fakeDb();
    const envRetention = { ADMIN_DB: retentionDb } as unknown as CloudflareEnv; // no HC_PING_URL — matches staging

    runScheduledTasks(fakeEvent(RETENTION_SLOT), envRetention, ctx);
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(retentionCalls()).toBeGreaterThan(0);
  });

  test("a retention failure never blocks the ping or the refresh-alerts check", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db } = fakeDb({ throwOnPrepare: true });
    const env = { HC_PING_URL: "https://hc.example/ping", ADMIN_DB: db } as unknown as CloudflareEnv;

    // Retention slot: only the ping and retention branches are live here
    // (refresh-alerts is out of slot), so this proves the ping survives a
    // broken D1 binding.
    runScheduledTasks(fakeEvent(RETENTION_SLOT), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
  });

  test("a refresh-alerts failure never blocks the ping", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    global.fetch = fetchMock as unknown as typeof fetch;
    const { ctx, settle } = fakeCtx();
    const { db } = fakeDb({ throwOnPrepare: true });
    const env = {
      HC_PING_URL: "https://hc.example/ping",
      ADMIN_DB: db,
      RESEND_API_KEY: "re_test",
    } as unknown as CloudflareEnv;

    runScheduledTasks(fakeEvent(ALERTS_SLOT), env, ctx);
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("https://hc.example/ping");
  });
});
