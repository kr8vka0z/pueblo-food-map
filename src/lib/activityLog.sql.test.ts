// @vitest-environment node
/**
 * Real-SQLite proof for the owner Activity log (#679): the queries in
 * activityLog.ts run against a schema built from the real migration files
 * (same pattern as emailRetention.sql.test.ts), then buildActivityDays()
 * shapes the page. Pure helpers (device/IP/diff/filters) are covered at the
 * bottom.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  buildActivityDays,
  describeDevice,
  diffFields,
  loadActivityPage,
  loadActivityPeople,
  maskIp,
  parseActivityFilters,
  summarizeAction,
  type ActivityFilters,
  type AuditActionRow,
} from "@/lib/activityLog";

const MIGRATIONS = [
  "0001_init_admin_schema.sql",
  "0005_blessing_boxes.sql",
  "0007_box_checkins.sql",
  "0009_box_photos.sql",
  "0010_box_adopters_alerts.sql",
  "0017_auth_events.sql",
];

/** D1's `prepare().bind().all()` surface over better-sqlite3. */
function wrapAsD1(db: Database.Database): D1Database {
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql: string) => statement(sql) } as unknown as D1Database;
}

const OWNER = "kysboyd@gmail.com";
const OTHER = "helper@example.com";
const NOW = new Date("2026-09-27T20:00:00.000Z"); // 2:00pm in Pueblo

function filters(over: Partial<ActivityFilters> = {}): ActivityFilters {
  return { ...parseActivityFilters({}, NOW), ...over };
}

let sqlite: Database.Database;
let db: D1Database;

function venue(id: string, name: string) {
  sqlite
    .prepare(
      `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, created_by, updated_by)
       VALUES (?, ?, 'pantry', 38.25, -104.6, '1 Main St', 'manual', '2026-01-01', 'published', 'manual', 'x@example.com', 'x@example.com')`,
    )
    .run(id, name);
}

function signIn(sessionId: string, email: string, at: string, method = "passkey") {
  sqlite
    .prepare(
      `INSERT INTO auth_events (event, email, user_id, session_id, method, ip, user_agent, city, region, country, created_at)
       VALUES ('sign_in', ?, 'u', ?, ?, '203.0.113.9', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15', 'Pueblo', 'Colorado', 'US', ?)`,
    )
    .run(email, sessionId, method, at);
}

function audit(row: {
  actor?: string;
  entity?: string;
  entityId: string;
  action?: string;
  before?: object | null;
  after?: object;
  at: string;
  session?: string | null;
}) {
  sqlite
    .prepare(
      `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.actor ?? OWNER,
      row.entity ?? "venue",
      row.entityId,
      row.action ?? "update",
      row.before === undefined ? JSON.stringify({ name: "Old" }) : row.before === null ? null : JSON.stringify(row.before),
      JSON.stringify(row.after ?? { name: "New" }),
      row.at,
      row.session === undefined ? null : row.session,
    );
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  for (const m of MIGRATIONS) sqlite.exec(readFileSync(join(process.cwd(), "migrations", m), "utf-8"));
  db = wrapAsD1(sqlite);
  venue("v-pantry", "Eastside Pantry");
  venue("v-box", "Mesa Blessing Box");
});

describe("loadActivityPage + buildActivityDays", () => {
  test("groups a session's actions under its sign-in, oldest first, with the sign-out", async () => {
    signIn("s1", OWNER, "2026-09-27T15:00:00.000Z");
    audit({ entityId: "v-pantry", at: "2026-09-27T15:05:00.000Z", session: "s1", before: { name: "Old", hours: "9-5" }, after: { name: "Old", hours: "9-6" } });
    audit({ entityId: "v-box", action: "archive", at: "2026-09-27T15:10:00.000Z", session: "s1" });
    sqlite
      .prepare("INSERT INTO auth_events (event, email, session_id, created_at) VALUES ('sign_out', ?, 's1', '2026-09-27T15:20:00.000Z')")
      .run(OWNER);

    const days = buildActivityDays(await loadActivityPage(db, filters()));

    expect(days).toHaveLength(1);
    expect(days[0].label).toBe("Sunday, Sep 27, 2026");
    const [group] = days[0].groups;
    expect(group.kind).toBe("session");
    if (group.kind !== "session") return;
    expect(group.signIn?.method).toBe("passkey");
    expect(group.items.map((i) => (i.kind === "action" ? summarizeAction(i.row).tag : i.row.event))).toEqual([
      "Edited",
      "Removed",
      "sign_out",
    ]);
    const edit = group.items[0];
    expect(edit.kind === "action" && edit.row.venue_name).toBe("Eastside Pantry");
    expect(edit.kind === "action" && summarizeAction(edit.row).changes).toEqual([{ field: "hours", before: "9-5", after: "9-6" }]);
  });

  test("a session whose sign-in is older than the range still gets its sign-in header", async () => {
    signIn("s-old", OWNER, "2026-07-01T15:00:00.000Z");
    audit({ entityId: "v-pantry", at: "2026-09-27T15:05:00.000Z", session: "s-old" });

    const days = buildActivityDays(await loadActivityPage(db, filters()));

    const group = days[0].groups[0];
    expect(group.kind === "session" && group.signIn?.session_id).toBe("s-old");
  });

  test("refresh-pipeline changes form an Automatic group; old unsessioned rows group per person", async () => {
    audit({ actor: "refresh-pipeline", entityId: "v-pantry", at: "2026-09-27T10:00:00.000Z" });
    audit({ actor: "refresh-pipeline", entityId: "v-box", at: "2026-09-27T10:00:00.000Z" });
    audit({ entityId: "v-pantry", at: "2026-09-26T18:00:00.000Z" });

    const days = buildActivityDays(await loadActivityPage(db, filters()));

    expect(days.map((d) => d.groups.map((g) => g.kind))).toEqual([["automatic"], ["unrecorded"]]);
  });

  test("failed sign-ins are their own groups", async () => {
    sqlite
      .prepare(
        "INSERT INTO auth_events (event, email, method, detail_json, created_at) VALUES ('sign_in_failed', 'attacker@evil.com', 'email_link', '{\"reason\":\"not_allowlisted\"}', '2026-09-27T16:00:00.000Z')",
      )
      .run();

    const days = buildActivityDays(await loadActivityPage(db, filters()));

    expect(days[0].groups[0]).toMatchObject({ kind: "failed", row: { email: "attacker@evil.com" } });
  });

  test("filters: person, automatic, type and place search", async () => {
    signIn("s1", OWNER, "2026-09-27T15:00:00.000Z");
    signIn("s2", OTHER, "2026-09-27T16:00:00.000Z");
    audit({ entityId: "v-pantry", at: "2026-09-27T15:05:00.000Z", session: "s1" });
    audit({ entityId: "v-box", at: "2026-09-27T16:05:00.000Z", session: "s2", actor: OTHER });
    audit({ entityId: "2026-09-27T17:00:00.000Z", action: "publish", before: null, after: { promotedCount: 2 }, at: "2026-09-27T17:00:00.000Z", session: "s1" });
    audit({ actor: "refresh-pipeline", entityId: "v-pantry", at: "2026-09-27T10:00:00.000Z" });

    const byOther = await loadActivityPage(db, filters({ person: OTHER }));
    expect(byOther.actions.map((a) => a.actor_email)).toEqual([OTHER]);
    expect(byOther.events.map((e) => e.email)).toEqual([OTHER]);

    const automatic = await loadActivityPage(db, filters({ person: "automatic" }));
    expect(automatic.actions.map((a) => a.actor_email)).toEqual(["refresh-pipeline"]);
    expect(automatic.events).toEqual([]);

    const publishes = await loadActivityPage(db, filters({ type: "publishes" }));
    expect(publishes.actions.map((a) => a.kind)).toEqual(["publish"]);
    expect(publishes.events).toEqual([]);
    expect(summarizeAction(publishes.actions[0]).note).toBe("2 new");

    const signIns = await loadActivityPage(db, filters({ type: "sign_ins" }));
    expect(signIns.actions).toEqual([]);
    expect(signIns.events).toHaveLength(2);

    const search = await loadActivityPage(db, filters({ q: "mesa" }));
    expect(search.actions.map((a) => a.venue_name)).toEqual(["Mesa Blessing Box"]);
    // A search with a LIKE wildcard is literal, not "match everything".
    expect((await loadActivityPage(db, filters({ q: "%" }))).actions).toEqual([]);
  });

  test("approvals: a box photo approval and an applied data-refresh proposal", async () => {
    sqlite
      .prepare("INSERT INTO box_photos (id, venue_id, r2_key, status, width, height, bytes) VALUES (7, 'v-box', 'k', 'approved', 1, 1, 1)")
      .run();
    audit({ entity: "box_photo", entityId: "7", before: { status: "pending" }, after: { status: "approved" }, at: "2026-09-27T15:00:00.000Z" });
    sqlite
      .prepare(
        `INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, applied_at)
         VALUES ('plentiful', 'v-pantry', 'update', '{}', 'h', 'r', 'approved', ?, '2026-09-27T15:30:00.000Z')`,
      )
      .run(OWNER);
    audit({ entityId: "v-pantry", at: "2026-09-27T15:30:00.000Z" });
    audit({ entityId: "v-pantry", at: "2026-09-27T15:40:00.000Z" }); // a plain edit

    const page = await loadActivityPage(db, filters({ type: "approvals" }));

    expect(page.actions.map((a) => [summarizeAction(a).tag, a.venue_name])).toEqual([
      ["Approved data refresh", "Eastside Pantry"],
      ["Approved photo", "Mesa Blessing Box"],
    ]);
  });

  test("date range: rows outside it are excluded", async () => {
    audit({ entityId: "v-pantry", at: "2026-08-01T15:00:00.000Z" });
    audit({ entityId: "v-pantry", at: "2026-09-27T15:00:00.000Z" });

    expect((await loadActivityPage(db, filters())).actions).toHaveLength(1);
    expect((await loadActivityPage(db, filters({ from: "2026-08-01", to: "2026-08-01" }))).actions).toHaveLength(1);
  });

  test("paging: 'Show older' resumes exactly where the page was cut, no row lost or repeated", async () => {
    for (let i = 0; i < 25; i++) {
      const at = new Date(Date.parse("2026-09-27T12:00:00.000Z") - i * 60_000).toISOString();
      audit({ entityId: "v-pantry", at, session: null });
    }
    // Two rows share a timestamp across the cut.
    audit({ entityId: "v-box", at: "2026-09-27T11:50:00.000Z" });

    const seen: number[] = [];
    let f = filters();
    for (let guard = 0; guard < 10; guard++) {
      const page = await loadActivityPage(db, f, 10);
      seen.push(...page.actions.map((a) => a.id));
      if (!page.nextUntil) break;
      f = { ...f, until: page.nextUntil };
    }
    expect(seen).toHaveLength(26);
    expect(new Set(seen).size).toBe(26);
  });

  test("stays fast with 10,000 audit rows", async () => {
    const insert = sqlite.prepare(
      "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id) VALUES (?, 'venue', 'v-pantry', 'update', '{}', '{}', ?, 's1')",
    );
    sqlite.transaction(() => {
      for (let i = 0; i < 10_000; i++) insert.run(OWNER, new Date(Date.parse("2026-09-27T19:00:00.000Z") - i * 60_000).toISOString());
    })();
    signIn("s1", OWNER, "2026-09-01T12:00:00.000Z");

    const started = performance.now();
    const page = await loadActivityPage(db, filters());
    buildActivityDays(page);
    const elapsed = performance.now() - started;

    // A full page is cut at its oldest timestamp; that row starts the next page.
    expect(page.actions).toHaveLength(299);
    expect(page.nextUntil).not.toBeNull();
    expect(elapsed).toBeLessThan(2000);
  });

  test("people: everyone who signed in or made a change, never a failed attempt's email", async () => {
    signIn("s1", OWNER, "2026-09-27T15:00:00.000Z");
    audit({ actor: OTHER, entityId: "v-pantry", at: "2026-09-27T15:00:00.000Z" });
    audit({ actor: "refresh-pipeline", entityId: "v-pantry", at: "2026-09-27T15:00:00.000Z" });
    sqlite.prepare("INSERT INTO auth_events (event, email, created_at) VALUES ('sign_in_failed', 'attacker@evil.com', '2026-09-27T15:00:00.000Z')").run();

    expect(await loadActivityPeople(db)).toEqual([OTHER, OWNER]);
  });
});

describe("pure helpers", () => {
  test("parseActivityFilters defaults to everyone, all types, the last 30 days (local)", () => {
    expect(parseActivityFilters({}, NOW)).toEqual({ person: "", type: "all", from: "2026-08-29", to: "2026-09-27", q: "", until: undefined });
    expect(parseActivityFilters({ type: "bogus", from: "nope", to: "2026-09-10", person: " Kysboyd@Gmail.com " }, NOW)).toMatchObject({
      type: "all",
      from: "2026-08-12",
      to: "2026-09-10",
      person: "kysboyd@gmail.com",
    });
    // Reversed range is swapped, not empty.
    expect(parseActivityFilters({ from: "2026-09-10", to: "2026-09-01" }, NOW)).toMatchObject({ from: "2026-09-01", to: "2026-09-10" });
  });

  test("describeDevice", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iPhone");
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0 Safari/537.36")).toBe("Chrome on Mac");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/128.0 Safari/537.36 Edg/128.0")).toBe("Edge on Windows");
    expect(describeDevice(null)).toBe("Unknown device");
  });

  test("maskIp keeps enough to recognise a network, not the full address", () => {
    expect(maskIp("203.0.113.9")).toBe("203.0.113.x");
    expect(maskIp("2607:3640:121:e110::1")).toBe("2607:3640:121::…");
    expect(maskIp(null)).toBe("");
  });

  test("diffFields ignores bookkeeping columns and caps long values", () => {
    const { changes } = diffFields(
      JSON.stringify({ name: "A", updated_at: "1", notes: "x" }),
      JSON.stringify({ name: "B", updated_at: "2", notes: "y".repeat(100) }),
    );
    expect(changes.map((c) => c.field)).toEqual(["name", "notes"]);
    expect(changes[1].after.length).toBe(60);
  });

  test("summarizeAction tags", () => {
    const row = (over: Partial<AuditActionRow>): AuditActionRow => ({
      id: 1,
      actor_email: OWNER,
      entity: "venue",
      entity_id: "v",
      action: "update",
      before_json: "{}",
      after_json: "{}",
      timestamp: "2026-09-27T15:00:00.000Z",
      session_id: null,
      venue_id: null,
      venue_name: null,
      from_proposal: 0,
      kind: "edit",
      ...over,
    });
    expect(summarizeAction(row({ action: "create", before_json: null })).tag).toBe("Added");
    expect(summarizeAction(row({ entity: "box_adopter", after_json: '{"status":"rejected"}' })).tag).toBe("Rejected sponsor");
    expect(summarizeAction(row({ entity: "box_checkin", after_json: '{"visibility":"hidden"}' })).tag).toBe("Hid check-in");
    expect(summarizeAction(row({ after_json: '{"event":"public_submission_marked_done"}' })).tag).toBe("Marked suggestion done");
    expect(
      summarizeAction(row({ action: "publish", after_json: '{"promotedCount":1,"editedCount":2,"prUrl":"https://github.com/x/y/pull/1"}' })),
    ).toMatchObject({ tag: "Published", note: "1 new, 2 edited", prUrl: "https://github.com/x/y/pull/1" });
    // Only a GitHub link is ever rendered as the PR link.
    expect(summarizeAction(row({ action: "publish", after_json: '{"prUrl":"javascript:alert(1)"}' })).prUrl).toBeUndefined();
  });
});
