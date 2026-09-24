/**
 * refreshAlerts.test.ts — coverage for the daily refresh-pipeline alert
 * checks (#238 pending-age, #234 per-source staleness). Fake D1 (mocked
 * `.bind().first()` / `.all()`) and a stubbed `fetch` for the Resend call —
 * same conventions src/lib/adminNavCounts.test.ts and
 * src/lib/boxAdopters.test.ts already use. The two exported SQL strings
 * are proven for real against SQLite in refreshAlerts.sql.test.ts.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import {
  shouldRunRefreshAlertsCheck,
  checkPendingAge,
  checkSourceStaleness,
  runRefreshAlertsCheck,
  PENDING_AGE_ALERT_DAYS,
  STALENESS_ALERT_DAYS,
} from "@/lib/refreshAlerts";

const NOW = new Date("2026-09-24T12:00:00.000Z");

describe("shouldRunRefreshAlertsCheck", () => {
  test("true at the 09:30 UTC slot", () => {
    expect(shouldRunRefreshAlertsCheck(Date.UTC(2026, 8, 24, 9, 30))).toBe(true);
  });

  test("false 5 minutes later — the next cron tick that same hour", () => {
    expect(shouldRunRefreshAlertsCheck(Date.UTC(2026, 8, 24, 9, 35))).toBe(false);
  });

  test("false at #616's own 09:00 slot — two independent, non-colliding gates", () => {
    expect(shouldRunRefreshAlertsCheck(Date.UTC(2026, 8, 24, 9, 0))).toBe(false);
  });

  test("true regardless of the date — one slot every day", () => {
    expect(shouldRunRefreshAlertsCheck(Date.UTC(2026, 0, 1, 9, 30))).toBe(true);
    expect(shouldRunRefreshAlertsCheck(Date.UTC(2027, 11, 31, 9, 30))).toBe(true);
  });
});

// ─── checkPendingAge ────────────────────────────────────────────────────────

function fakeDbFirst(row: unknown): D1Database {
  return { prepare: () => ({ bind: () => ({ first: async () => row }) }) } as unknown as D1Database;
}

describe("checkPendingAge", () => {
  test("no pending row older than the cutoff -> no alert", async () => {
    const db = fakeDbFirst({ n: 0, oldest: null });
    const result = await checkPendingAge(db, NOW);
    expect(result).toEqual({ shouldAlert: false, count: 0, oldestCreatedAt: null, oldestAgeDays: null });
  });

  test("rows past the cutoff -> alerts, with the count and oldest age", async () => {
    const oldest = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const db = fakeDbFirst({ n: 3, oldest });
    const result = await checkPendingAge(db, NOW);
    expect(result.shouldAlert).toBe(true);
    expect(result.count).toBe(3);
    expect(result.oldestCreatedAt).toBe(oldest);
    expect(result.oldestAgeDays).toBe(20);
  });

  test(`PENDING_AGE_ALERT_DAYS is 14`, () => {
    expect(PENDING_AGE_ALERT_DAYS).toBe(14);
  });
});

// ─── checkSourceStaleness ───────────────────────────────────────────────────

function fakeDbAll(results: Array<{ source: string; last: string | null }>): D1Database {
  return { prepare: () => ({ all: async () => ({ success: true, results, meta: {} }) }) } as unknown as D1Database;
}

describe("checkSourceStaleness", () => {
  test("a source with no change_proposals row at all -> alerts (never run)", async () => {
    const db = fakeDbAll([{ source: "plentiful", last: "2026-09-01T00:00:00.000Z" }]); // osm missing entirely
    const results = await checkSourceStaleness(db, NOW);
    const osm = results.find((r) => r.source === "osm")!;
    expect(osm.shouldAlert).toBe(true);
    expect(osm.lastRunAt).toBeNull();
    expect(osm.daysSinceLastRun).toBeNull();
  });

  test("39 days since the last run -> inside the threshold, no alert", async () => {
    const last = new Date(NOW.getTime() - 39 * 24 * 60 * 60 * 1000).toISOString();
    const db = fakeDbAll([
      { source: "plentiful", last },
      { source: "osm", last },
    ]);
    const results = await checkSourceStaleness(db, NOW);
    expect(results.every((r) => r.shouldAlert === false)).toBe(true);
  });

  test("41 days since the last run -> past the threshold, alerts", async () => {
    const last = new Date(NOW.getTime() - 41 * 24 * 60 * 60 * 1000).toISOString();
    const db = fakeDbAll([
      { source: "plentiful", last },
      { source: "osm", last },
    ]);
    const results = await checkSourceStaleness(db, NOW);
    expect(results.every((r) => r.shouldAlert === true)).toBe(true);
    expect(results.find((r) => r.source === "plentiful")!.daysSinceLastRun).toBe(41);
  });

  test(`STALENESS_ALERT_DAYS is 40`, () => {
    expect(STALENESS_ALERT_DAYS).toBe(40);
  });
});

// ─── runRefreshAlertsCheck (email dispatch) ────────────────────────────────

function fakeDbCombined(opts: {
  pendingAge?: { n: number; oldest: string | null };
  staleness?: Array<{ source: string; last: string | null }>;
}): D1Database {
  const pendingAge = opts.pendingAge ?? { n: 0, oldest: null };
  const staleness = opts.staleness ?? [
    { source: "plentiful", last: NOW.toISOString() },
    { source: "osm", last: NOW.toISOString() },
  ];
  return {
    prepare: (sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return { bind: () => ({ first: async () => pendingAge }) };
      }
      return { all: async () => ({ success: true, results: staleness, meta: {} }) };
    },
  } as unknown as D1Database;
}

describe("runRefreshAlertsCheck", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("nothing tripped -> no email sent, no API key needed", async () => {
    const db = fakeDbCombined({});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runRefreshAlertsCheck(db, undefined, NOW);

    expect(result).toEqual({ pendingAgeAlertSent: false, staleSourcesAlerted: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("pending-age tripped, no API key -> throws rather than silently skipping", async () => {
    const db = fakeDbCombined({ pendingAge: { n: 2, oldest: new Date(NOW.getTime() - 20 * 86_400_000).toISOString() } });
    await expect(runRefreshAlertsCheck(db, undefined, NOW)).rejects.toThrow(/RESEND_API_KEY/);
  });

  test("pending-age tripped -> sends exactly one email to issues@pueblofoodmap.com", async () => {
    const db = fakeDbCombined({ pendingAge: { n: 2, oldest: new Date(NOW.getTime() - 20 * 86_400_000).toISOString() } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runRefreshAlertsCheck(db, "test-key", NOW);

    expect(result.pendingAgeAlertSent).toBe(true);
    expect(result.staleSourcesAlerted).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string) as { to: string[]; subject: string };
    expect(body.to).toEqual(["issues@pueblofoodmap.com"]);
    expect(body.subject).toContain("pending review");
  });

  test("both stale sources tripped -> sends one email per source", async () => {
    const last = new Date(NOW.getTime() - 41 * 86_400_000).toISOString();
    const db = fakeDbCombined({
      staleness: [
        { source: "plentiful", last },
        { source: "osm", last },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runRefreshAlertsCheck(db, "test-key", NOW);

    expect(result.staleSourcesAlerted.sort()).toEqual(["osm", "plentiful"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("a non-OK Resend response throws", async () => {
    const db = fakeDbCombined({ pendingAge: { n: 1, oldest: new Date(NOW.getTime() - 20 * 86_400_000).toISOString() } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 500 })));
    await expect(runRefreshAlertsCheck(db, "test-key", NOW)).rejects.toThrow(/Resend API error/);
  });
});
