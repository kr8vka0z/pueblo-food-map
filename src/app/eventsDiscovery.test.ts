// @vitest-environment node
/**
 * How crawlers find event pages (#762): the sitemap lists published upcoming
 * and live events only, in both languages with hreflang, and keeps serving
 * everything else when the events table is missing; robots.txt lets a crawler
 * fetch the flyer image that the page's structured data points at.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { SITE_URL } from "@/lib/site";

const mockContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => mockContext() }));

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

const NOW = new Date("2026-11-20T18:00:00.000Z");

function seededDb() {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  const add = (id: string, status: string, startsAt: string, endsAt: string) =>
    db
      .prepare(
        `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by)
         VALUES (?, 'E', ?, ?, 38.25, -104.6, 'x', ?, 'a', 'a')`,
      )
      .run(id, startsAt, endsAt, status);
  add("upcoming", "published", "2026-11-21T17:00:00.000Z", "2026-11-21T21:00:00.000Z");
  add("live", "published", "2026-11-20T17:00:00.000Z", "2026-11-20T21:00:00.000Z");
  add("ended", "published", "2026-11-10T17:00:00.000Z", "2026-11-10T21:00:00.000Z");
  add("cancelled", "cancelled", "2026-11-21T17:00:00.000Z", "2026-11-21T21:00:00.000Z");
  add("draft", "draft", "2026-11-21T17:00:00.000Z", "2026-11-21T21:00:00.000Z");
  add("archived", "archived", "2026-11-21T17:00:00.000Z", "2026-11-21T21:00:00.000Z");
  return db;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockContext.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sitemap", () => {
  test("lists upcoming and live published events only, EN and ES, each pointing at the other", async () => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(seededDb()) } });
    const entries = await sitemap();
    const eventUrls = entries.map((e) => e.url).filter((u) => u.includes("/event/")).sort();
    expect(eventUrls).toEqual(
      ["live", "upcoming"].flatMap((id) => [`${SITE_URL}/es/event/${id}`, `${SITE_URL}/event/${id}`]).sort(),
    );
    const en = entries.find((e) => e.url === `${SITE_URL}/event/upcoming`);
    expect(en?.alternates?.languages).toEqual({
      en: `${SITE_URL}/event/upcoming`,
      es: `${SITE_URL}/es/event/upcoming`,
      "x-default": `${SITE_URL}/event/upcoming`,
    });
    expect(entries.find((e) => e.url === `${SITE_URL}/es/event/upcoming`)?.alternates).toEqual(en?.alternates);
  });

  test("with the events table missing the rest of the sitemap is served and no event URLs are listed", async () => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(new Database(":memory:")) } });
    const entries = await sitemap();
    expect(entries.some((e) => e.url.includes("/event/"))).toBe(false);
    expect(entries.some((e) => e.url === `${SITE_URL}/venues`)).toBe(true);
    expect(entries.some((e) => e.url.includes("/venue/"))).toBe(true);
  });

  test("with no Cloudflare context the sitemap still builds", async () => {
    mockContext.mockImplementation(() => {
      throw new Error("no context");
    });
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.some((e) => e.url.includes("/event/"))).toBe(false);
  });
});

describe("robots", () => {
  test("flyer images under /api/ are allowed for crawlers while the rest of /api/ stays disallowed", () => {
    const rules = robots().rules;
    const star = (Array.isArray(rules) ? rules : [rules]).find((r) => r.userAgent === "*");
    expect(star?.allow).toContain("/api/public/events/*/flyer/");
    expect(star?.disallow).toContain("/api/");
  });
});
