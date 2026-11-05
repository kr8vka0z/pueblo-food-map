// @vitest-environment node
/**
 * The public address check (#883 spec change): GET /events/share/geocode is
 * rate-limited per IP with the real D1 counter, and a refused lookup never
 * reaches the Census geocoder. Real SQLite; the Census call is a stub.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const PER_IP = 30; // the route's per-IP cap

const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { GET } from "@/app/(site)/events/share/geocode/route";

let census: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
  const sqlite = new Database(":memory:");
  sqlite.exec(readFileSync(join(process.cwd(), "migrations", "0007_box_checkins.sql"), "utf-8"));
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(sqlite) } });
  census = vi.fn(async () => ({
    ok: true,
    json: async () => ({ result: { addressMatches: [{ matchedAddress: "1 MAIN ST, PUEBLO, CO", coordinates: { x: -104.61, y: 38.27 } }] } }),
  }));
  vi.stubGlobal("fetch", census);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const lookup = () =>
  GET(new NextRequest("https://pueblofoodmap.com/events/share/geocode?q=1%20Main%20St", { headers: { "cf-connecting-ip": "203.0.113.9" } }));

test("one IP over the hourly cap gets 429, and that lookup never reaches the geocoder", async () => {
  for (let i = 0; i < PER_IP; i++) expect((await lookup()).status).toBe(200);
  const res = await lookup();
  expect(res.status).toBe(429);
  expect(await res.json()).toMatchObject({ error: "rate_limit" });
  expect(census).toHaveBeenCalledTimes(PER_IP);
});

test("Census capitals come back as a readable address", async () => {
  census.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ result: { addressMatches: [{ matchedAddress: "1001 E ABRIENDO AVE, PUEBLO, CO, 81004", coordinates: { x: -104.6, y: 38.25 } }] } }),
  });
  const body = await (await lookup()).json();
  expect(body.matches[0].matchedAddress).toBe("1001 E Abriendo Ave, Pueblo, CO 81004");
});
