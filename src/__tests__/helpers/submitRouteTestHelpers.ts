/**
 * Shared fakes for the public form-submit route tests (report / suggest /
 * feedback submit). Test-only.
 *
 * The vi.mock() blocks for @/lib/formRateLimit and @opennextjs/cloudflare are
 * NOT here: vitest hoists vi.mock() to the top of the file that calls it, so
 * each test file keeps its own.
 */

import { vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * A fake D1Database whose prepare/bind/run calls are spies, so tests can
 * assert on the exact bound values without a real DB. `failRun: true` makes
 * every .run() reject, simulating a D1 outage.
 */
export function makeFakeD1(opts: { failRun?: boolean } = {}) {
  const runMock = vi.fn(async () => {
    if (opts.failRun) throw new Error("D1 write failed (simulated)");
    return { success: true, results: [], meta: {} };
  });
  const bindMock = vi.fn<(...args: unknown[]) => { run: typeof runMock }>(() => ({ run: runMock }));
  const prepareMock = vi.fn<(...args: unknown[]) => { bind: typeof bindMock }>(() => ({ bind: bindMock }));
  const db = { prepare: prepareMock } as unknown as D1Database;
  return { db, prepareMock, bindMock, runMock };
}

/** A JSON POST to `path` (e.g. "/report/submit") from the given client IP. */
export function makeSubmitRequest(path: string, body: Record<string, unknown>, ip = "127.0.0.1") {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

/** A fetch stub whose next call is a passing Turnstile siteverify response. */
export function mockTurnstileSuccess() {
  return vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
}
