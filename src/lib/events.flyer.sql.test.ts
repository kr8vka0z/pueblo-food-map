// @vitest-environment node
/**
 * Real-SQLite proof for the public flyer reads (#760): the feed and the
 * single-event read carry a `flyer` object (and never the raw R2 key), keep the
 * original visibility rules, serve every event when migration 0019 has not been
 * applied yet, and fall back ONLY for a missing column (any other database
 * error propagates).
 */

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import {
  isMissingColumnError,
  loadPublicEventById,
  loadPublicEvents,
  PUBLIC_EVENT_BY_ID_SQL,
  PUBLIC_EVENT_BY_ID_WITH_FLYER_SQL,
  PUBLIC_EVENTS_SQL,
  PUBLIC_EVENTS_WITH_FLYER_SQL,
} from "@/lib/events";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const KEY = "evt-1/22222222-2222-4222-8222-222222222222.jpg";

function build(withFlyerColumns: boolean) {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  if (withFlyerColumns) db.exec(readFileSync(join(process.cwd(), "migrations", "0019_event_flyer.sql"), "utf-8"));
  db.prepare(
    `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, flyer_key, created_by, updated_by)
     VALUES ('evt-1', 'E', '2026-10-11T00:00:00.000Z', '2026-10-11T04:00:00.000Z', 38.25, -104.6, 'x', 'published', ?, 'a', 'a')`,
  ).run(KEY);
  if (withFlyerColumns) {
    db.prepare("UPDATE events SET flyer_width = 300, flyer_height = 420, flyer_alt = 'Flyer', flyer_alt_es = 'Volante' WHERE id = 'evt-1'").run();
  }
  return sqliteD1(db);
}

describe("public flyer reads", () => {
  test("feed and detail expose a flyer object with a site path, size and alt texts, never the raw key", async () => {
    const d1 = build(true);
    const expected = {
      src: "/api/public/events/evt-1/flyer/22222222-2222-4222-8222-222222222222.jpg",
      width: 300,
      height: 420,
      alt: "Flyer",
      alt_es: "Volante",
    };

    const [feedEvent] = await loadPublicEvents(d1, NOW);
    const detail = await loadPublicEventById(d1, "evt-1");

    expect(feedEvent.flyer).toEqual(expected);
    expect(detail?.flyer).toEqual(expected);
    for (const e of [feedEvent, detail]) expect(e).not.toHaveProperty("flyer_key");
  });

  test("an event without a flyer has flyer null", async () => {
    const d1 = build(true);
    await d1.prepare("UPDATE events SET flyer_key = NULL").run();
    expect((await loadPublicEvents(d1, NOW))[0].flyer).toBeNull();
  });

  test("before migration 0019, events still load (without flyers) instead of failing", async () => {
    const d1 = build(false);
    const feed = await loadPublicEvents(d1, NOW);
    const detail = await loadPublicEventById(d1, "evt-1");

    expect(feed.map((e) => e.id)).toEqual(["evt-1"]);
    expect(detail?.id).toBe("evt-1");
    expect(feed[0].flyer ?? null).toBeNull();
    expect(feed[0]).not.toHaveProperty("flyer_key");
  });
});

// ── The queries that actually run (with flyer columns) keep the same WHERE rules
// as the pre-0019 ones, proven on real SQLite. ───────────────────────────────
function withRows(rows: { id: string; status: string; endsAt: string }[]) {
  const db = new Database(":memory:");
  for (const f of ["0018_events.sql", "0019_event_flyer.sql"]) db.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  for (const r of rows) {
    db.prepare(
      `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, flyer_key, created_by, updated_by)
       VALUES (?, 'E', '2026-01-01T00:00:00.000Z', ?, 38.25, -104.6, 'x', ?, 'x/y.jpg', 'a', 'a')`,
    ).run(r.id, r.endsAt, r.status);
  }
  return db;
}

const FUTURE = "2026-10-11T00:00:00.000Z";
const ALL = [
  { id: "live", status: "published", endsAt: FUTURE },
  { id: "draft", status: "draft", endsAt: FUTURE },
  { id: "cancelled", status: "cancelled", endsAt: FUTURE },
  { id: "archived", status: "archived", endsAt: FUTURE },
  { id: "ended", status: "published", endsAt: "2026-10-10T11:59:59.000Z" },
  { id: "edge", status: "published", endsAt: NOW.toISOString() },
];

describe("flyer-column queries keep the original visibility rules", () => {
  test("feed: only published and not ended (ending exactly now is over), and the pre-0019 query agrees", () => {
    const db = withRows(ALL);
    const ids = (sql: string) => (db.prepare(sql).all(NOW.toISOString()) as { id: string }[]).map((r) => r.id);
    expect(ids(PUBLIC_EVENTS_WITH_FLYER_SQL)).toEqual(["live"]);
    expect(ids(PUBLIC_EVENTS_WITH_FLYER_SQL)).toEqual(ids(PUBLIC_EVENTS_SQL));
  });

  test("by id: published (even ended) and cancelled are readable, never draft or archived", () => {
    const db = withRows(ALL);
    const found = (id: string) => db.prepare(PUBLIC_EVENT_BY_ID_WITH_FLYER_SQL).get(id) !== undefined;
    expect(["live", "ended", "edge", "cancelled"].map(found)).toEqual([true, true, true, true]);
    expect(["draft", "archived", "nope"].map(found)).toEqual([false, false, false]);
    const oldFound = (id: string) => db.prepare(PUBLIC_EVENT_BY_ID_SQL).get(id) !== undefined;
    expect(["live", "ended", "cancelled", "draft", "archived"].map(oldFound)).toEqual(["live", "ended", "cancelled", "draft", "archived"].map(found));
  });

  test("beyond the old columns they add only the five flyer ones, and no internal column", () => {
    const db = withRows(ALL);
    const feedKeys = Object.keys(db.prepare(PUBLIC_EVENTS_WITH_FLYER_SQL).get(NOW.toISOString()) as object);
    const oldKeys = Object.keys(db.prepare(PUBLIC_EVENTS_SQL).get(NOW.toISOString()) as object);
    expect(feedKeys.filter((k) => !oldKeys.includes(k)).sort()).toEqual(["flyer_alt", "flyer_alt_es", "flyer_height", "flyer_key", "flyer_width"]);
    for (const internal of ["created_by", "updated_by", "created_at", "updated_at", "status", "cancel_note"]) expect(feedKeys).not.toContain(internal);
  });
});

describe("the pre-0019 fallback fires only for a missing column", () => {
  test("isMissingColumnError matches SQLite's wording and nothing else", () => {
    expect(isMissingColumnError(new Error("no such column: flyer_key"))).toBe(true);
    expect(isMissingColumnError(new Error("table events has no column named flyer_alt"))).toBe(true);
    expect(isMissingColumnError(new Error("D1_ERROR: no such table: events"))).toBe(false);
    expect(isMissingColumnError(new Error("network connection lost"))).toBe(false);
    expect(isMissingColumnError("no such column")).toBe(false);
  });

  test("any other database error propagates instead of silently serving flyer-less data", async () => {
    const boom = async () => {
      throw new Error("D1_ERROR: network connection lost");
    };
    const failing = { prepare: () => ({ bind: () => ({ all: boom, first: boom }) }) } as unknown as D1Database;
    await expect(loadPublicEvents(failing, NOW)).rejects.toThrow("network connection lost");
    await expect(loadPublicEventById(failing, "evt-1")).rejects.toThrow("network connection lost");
  });
});
