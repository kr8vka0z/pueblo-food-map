/**
 * "Last data refresh" shows the Pueblo (America/Denver) date, not the
 * server's UTC date (#894 item 10). Workers run in UTC, so an evening
 * refresh used to read as the next day. New file because page.test.tsx is
 * write-guarded on fix/ branches; mocks mirror page.publishBotStatus.test.tsx.
 */

import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/adminDb", () => ({
  getAdminDb: vi.fn(async () => ({ db: fakeDb, identity: { email: "admin@example.com" } })),
}));
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { BETTER_AUTH_RP_ID: undefined } })),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/logger", () => ({ logAdminAuthFailure: vi.fn() }));

import DashboardPage from "@/app/(site)/admin/page";

// 7 pm on Nov 5 in Pueblo = 02:00 UTC on Nov 6.
const REFRESH_ROW = { run_id: "run-1", created_at: "2026-11-06T02:00:00.000Z", n: 3 };

const fakeDb = {
  prepare: (sql: string) => {
    const stmt = {
      bind: () => stmt,
      all: async () => ({ success: true, results: [], meta: {} }),
      first: async () => (sql.includes("ORDER BY created_at DESC LIMIT 1") ? REFRESH_ROW : { n: 0 }),
    };
    return stmt;
  },
};

// The Worker runs in UTC; pin the test process there so the old
// toLocaleDateString() (server zone) shows the bug on any machine.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

test("an evening refresh shows that day's Pueblo date", async () => {
  delete process.env.GITHUB_PUBLISH_TOKEN;
  render(await DashboardPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/Last data refresh/).textContent).toContain("11/5/2026");
});
