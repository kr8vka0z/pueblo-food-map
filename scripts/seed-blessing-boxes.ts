/**
 * seed-blessing-boxes.ts — dev-only PRACTICE blessing-box data (Blessing
 * Boxes Build Plan slice 1). Generates two throwaway SQL files, never a
 * migration: `scripts/generated/seed-blessing-boxes.sql` (4 obviously-fake
 * boxes, INSERT into `venues` + `blessing_boxes`) and
 * `scripts/generated/remove-blessing-boxes.sql` (the matching DELETEs) —
 * so staging/dev D1 can be seeded and cleaned back up without ever leaving
 * a fake box permanently in the data.
 *
 * WHY a script, not a migration: migrations/0005_blessing_boxes.sql is
 * schema only (see AGENTS.md's own "migrations... independent of a Worker
 * deploy" convention) — practice DATA has no business inside a schema
 * change, and doesn't need to survive a `d1 migrations apply` re-run the
 * way a table definition does.
 *
 * WHY every id/name is obviously fake: Kyle reviews slice 1 on
 * dev.pueblofoodmap.com before he's compiled the real Pueblo-area box list
 * (see the "Kyle's rollout approach" planning note) — a fake box that could
 * be mistaken for a real one is exactly the leak the "boxes are live, not
 * published" architecture (Build Plan call #1) was designed to keep off
 * the PUBLISHED map; nothing stops it from being live-readable on staging,
 * so the names themselves are the safety net.
 *
 * RUN — same one-time, human-reviewed convention as seed-admin-db.ts: this
 * only WRITES the two .sql files below (gitignored — derivable from this
 * committed script); it never touches D1 itself.
 *   npx tsx scripts/seed-blessing-boxes.ts
 * Then apply the one you want with wrangler, same as any other admin
 * schema/data file in this repo (staging = dev.pueblofoodmap.com's DB):
 *   npx wrangler d1 execute pueblo-food-map-admin-staging --remote --file=scripts/generated/seed-blessing-boxes.sql
 *   npx wrangler d1 execute pueblo-food-map-admin-staging --remote --file=scripts/generated/remove-blessing-boxes.sql
 * (or --local against Miniflare's on-disk DB for `npm run preview`).
 * NEVER pass `pueblo-food-map-admin` (no `-staging` suffix, i.e.
 * production) to either command — see AGENTS.md's `--db-mode` table for why
 * a name flag with no fixed-mode guard is exactly how a script accidentally
 * targets prod.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUEBLO_CENTER_LAT, PUEBLO_CENTER_LNG } from "@/data/pueblo-bbox";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SEED_OUT_FILE = join(REPO_ROOT, "scripts", "generated", "seed-blessing-boxes.sql");
const REMOVE_OUT_FILE = join(REPO_ROOT, "scripts", "generated", "remove-blessing-boxes.sql");

interface FakeBox {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  hostName: string;
  hostNote: string;
  mostNeeded: string;
  installedOn: string;
}

// Four practice boxes, spread a few blocks around downtown Pueblo
// (PUEBLO_CENTER) so they render at plausible-looking map positions without
// claiming a real street address. Every name/host carries a "(TEST DATA)"
// or "Fake"/"Practice" marker — deliberately impossible to mistake for a
// real submission during Kyle's slice-1 review.
const FAKE_BOXES: FakeBox[] = [
  {
    id: "fake-blessing-box-practice-1",
    name: "Practice Blessing Box #1 (TEST DATA)",
    lat: PUEBLO_CENTER_LAT + 0.01,
    lng: PUEBLO_CENTER_LNG + 0.01,
    address: "TEST DATA — no real address",
    hostName: "Fake Host One",
    hostNote: "This is dev-only practice data, not a real blessing box.",
    mostNeeded: "Canned vegetables, pasta",
    installedOn: "2026-01-01",
  },
  {
    id: "fake-blessing-box-practice-2",
    name: "Practice Blessing Box #2 (TEST DATA)",
    lat: PUEBLO_CENTER_LAT - 0.015,
    lng: PUEBLO_CENTER_LNG + 0.008,
    address: "TEST DATA — no real address",
    hostName: "Fake Host Two",
    hostNote: "This is dev-only practice data, not a real blessing box.",
    mostNeeded: "Peanut butter, rice",
    installedOn: "2026-02-15",
  },
  {
    id: "fake-blessing-box-practice-3",
    name: "Practice Blessing Box #3 (TEST DATA)",
    lat: PUEBLO_CENTER_LAT + 0.02,
    lng: PUEBLO_CENTER_LNG - 0.012,
    address: "TEST DATA — no real address",
    hostName: "Fake Host Three",
    hostNote: "This is dev-only practice data, not a real blessing box.",
    mostNeeded: "Diapers, baby formula",
    installedOn: "2026-03-01",
  },
  {
    id: "fake-blessing-box-practice-4",
    name: "Practice Blessing Box #4 (TEST DATA, no host note)",
    lat: PUEBLO_CENTER_LAT - 0.008,
    lng: PUEBLO_CENTER_LNG - 0.018,
    address: "TEST DATA — no real address",
    hostName: "Fake Host Four",
    hostNote: "",
    mostNeeded: "",
    installedOn: "",
  },
];

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlOptString(value: string): string {
  return value ? sqlString(value) : "NULL";
}

function buildSeedSql(): string {
  const lines: string[] = [
    "-- GENERATED by scripts/seed-blessing-boxes.ts — dev-only PRACTICE data.",
    "-- Never apply this to pueblo-food-map-admin (production). See the",
    "-- script's own header for the staging/local wrangler commands.",
    "",
  ];

  for (const box of FAKE_BOXES) {
    lines.push(
      `INSERT INTO venues (id, name, category, lat, lng, address, source, last_verified, status, source_type, outside_county, created_by, updated_by) VALUES (` +
        `${sqlString(box.id)}, ${sqlString(box.name)}, 'blessing_box', ${box.lat}, ${box.lng}, ` +
        `${sqlString(box.address)}, 'seed-blessing-boxes.ts (dev-only practice data)', ` +
        `${sqlString(new Date().toISOString().slice(0, 10))}, 'published', 'manual', 0, ` +
        `'seed-script', 'seed-script');`,
    );
    lines.push(
      `INSERT INTO blessing_boxes (venue_id, host_name, host_note, most_needed, installed_on) VALUES (` +
        `${sqlString(box.id)}, ${sqlOptString(box.hostName)}, ${sqlOptString(box.hostNote)}, ` +
        `${sqlOptString(box.mostNeeded)}, ${sqlOptString(box.installedOn)});`,
    );
  }

  return lines.join("\n") + "\n";
}

function buildRemoveSql(): string {
  const lines: string[] = [
    "-- GENERATED by scripts/seed-blessing-boxes.ts — removes the practice",
    "-- blessing boxes this script's seed file inserted. blessing_boxes rows",
    "-- delete first (no FK enforcement in this schema, but matches the",
    "-- delete-child-then-parent order everywhere else in this repo).",
    "",
  ];
  for (const box of FAKE_BOXES) {
    lines.push(`DELETE FROM blessing_boxes WHERE venue_id = ${sqlString(box.id)};`);
    lines.push(`DELETE FROM venues WHERE id = ${sqlString(box.id)};`);
  }
  return lines.join("\n") + "\n";
}

function main(): void {
  mkdirSync(dirname(SEED_OUT_FILE), { recursive: true });
  writeFileSync(SEED_OUT_FILE, buildSeedSql(), "utf-8");
  writeFileSync(REMOVE_OUT_FILE, buildRemoveSql(), "utf-8");
  console.log(`Wrote ${FAKE_BOXES.length} practice boxes to:`);
  console.log(`  ${SEED_OUT_FILE}`);
  console.log(`  ${REMOVE_OUT_FILE}`);
  console.log("\nReview both files, then apply with wrangler (staging/local only — see this file's header).");
}

main();
