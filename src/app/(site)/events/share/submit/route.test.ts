// @vitest-environment node
/**
 * POST /events/share/submit (#883) — the spec's "Proof" list for the public
 * form: missing Turnstile, a filled honeypot, rate-limit overflow, end before
 * start and a bad link are all refused, and none of them stores a row.
 * Real SQLite (the real rate-limit counter table and event_submissions), so
 * the overflow is the real D1 counter, not a mocked limiter.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { makeSubmitRequest } from "@/__tests__/helpers/submitRouteTestHelpers";
import { MAX_PER_IP_PER_HOUR } from "@/lib/formRateLimit";

const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { POST } from "@/app/(site)/events/share/submit/route";

const validBody = {
  name: "Thanksgiving Turkey Giveaway",
  host: "Pueblo Food Project",
  date: "2026-11-22",
  start_time: "10:00",
  end_time: "13:00",
  description: "Free turkeys while supplies last.",
  address: "123 Main St, Pueblo, CO",
  link_url: "https://example.org/turkeys",
  link_label: "signup",
  submitter_name: "Pat",
  submitter_email: "pat@example.com",
  website: "",
  turnstileToken: "token",
};

let sqlite: Database.Database;
const rows = () => sqlite.prepare("SELECT * FROM event_submissions").all() as Record<string, unknown>[];
const post = (body: Record<string, unknown>, ip = "203.0.113.5") => POST(makeSubmitRequest("/events/share/submit", body, ip));

/** Turnstile passes, Resend accepts. */
function passTurnstile() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("turnstile")
        ? { ok: true, json: async () => ({ success: true }) }
        : { ok: true, json: async () => ({}), text: async () => "" },
    ),
  );
}

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test_key");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
  sqlite = new Database(":memory:");
  for (const f of ["0007_box_checkins.sql", "0027_event_submissions.sql"]) {
    sqlite.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  }
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(sqlite) } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /events/share/submit", () => {
  test("a valid event is stored as pending, with the times converted from Pueblo time and the email outside the payload", async () => {
    passTurnstile();
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const [row] = rows();
    expect(row.status).toBe("pending");
    expect(row.submitter_email).toBe("pat@example.com");
    const payload = JSON.parse(row.payload as string);
    expect(payload.startsAt).toBe("2026-11-22T17:00:00.000Z"); // 10:00 MST
    expect(row.payload).not.toContain("pat@example.com");
  });

  test("missing Turnstile token → 400, nothing stored", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await post({ ...validBody, turnstileToken: undefined });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "turnstile_failed" });
    expect(rows()).toHaveLength(0);
  });

  test("a filled honeypot looks like success to the bot, but nothing is stored", async () => {
    passTurnstile();
    const res = await post({ ...validBody, website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(rows()).toHaveLength(0);
  });

  test("one IP over the hourly cap → 429 rate_limit, and the extra one is not stored", async () => {
    passTurnstile();
    for (let i = 0; i < MAX_PER_IP_PER_HOUR; i++) expect((await post(validBody)).status).toBe(200);
    const res = await post(validBody);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limit" });
    expect(rows()).toHaveLength(MAX_PER_IP_PER_HOUR);
  });

  test("end before start → 422 on end_time, nothing stored", async () => {
    passTurnstile();
    const res = await post({ ...validBody, start_time: "13:00", end_time: "10:00" });
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("end_time");
    expect(rows()).toHaveLength(0);
  });

  test.each(["javascript:alert(1)", "example.org", "ftp://example.org/x"])("bad link %s → 422 on link_url, nothing stored", async (link_url) => {
    passTurnstile();
    const res = await post({ ...validBody, link_url });
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toHaveProperty("link_url");
    expect(rows()).toHaveLength(0);
  });
});
