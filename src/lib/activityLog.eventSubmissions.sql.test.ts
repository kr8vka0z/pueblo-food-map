// @vitest-environment node
/**
 * Real-SQLite proof that the owner Activity log labels reviewed "Share an
 * event" submissions (#883, entity 'event_submission') with the event's name
 * and what was done, instead of a nameless "Edited".
 */

import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { loadActivityPage, parseActivityFilters, summarizeAction } from "@/lib/activityLog";

test("converted and dismissed submissions show the event name and the right label", async () => {
  const sqlite = new Database(":memory:");
  for (const m of [
    "0001_init_admin_schema.sql", "0005_blessing_boxes.sql", "0007_box_checkins.sql", "0009_box_photos.sql",
    "0010_box_adopters_alerts.sql", "0017_auth_events.sql",
  ]) {
    sqlite.exec(readFileSync(join(process.cwd(), "migrations", m), "utf-8"));
  }
  const insert = sqlite.prepare(
    `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp)
     VALUES ('kysboyd@gmail.com', 'event_submission', ?, 'update', ?, ?, ?)`,
  );
  insert.run("s1", JSON.stringify({ id: "s1", name: "Turkey Giveaway", status: "pending" }),
    JSON.stringify({ id: "s1", name: "Turkey Giveaway", status: "converted", converted_event_id: "e1" }), "2026-09-27T15:00:00.000Z");
  insert.run("s2", JSON.stringify({ id: "s2", name: "Coat Drive", status: "pending" }),
    JSON.stringify({ id: "s2", name: "Coat Drive", status: "dismissed" }), "2026-09-27T16:00:00.000Z");

  const { actions } = await loadActivityPage(sqliteD1(sqlite), parseActivityFilters({}, new Date("2026-09-27T20:00:00.000Z")));
  const shown = [...actions]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((r) => [r.venue_name, summarizeAction(r).tag]);
  expect(shown).toEqual([
    ["Turkey Giveaway", "Made shared event a draft"],
    ["Coat Drive", "Dismissed shared event"],
  ]);
});
