// @vitest-environment node
/**
 * Real-SQLite proof for the public flyer reads (#760): the feed and the
 * single-event read carry a `flyer` object (and never the raw R2 key), and
 * both keep serving every event when migration 0019 has not been applied yet.
 */

import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { loadPublicEventById, loadPublicEvents } from "@/lib/events";

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
