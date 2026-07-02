/**
 * seed-admin-db.ts — one-time seed of all 108 current venues into the
 * Cloudflare D1 "pueblo-food-map-admin" database (#237 checkpoint b).
 *
 * WHAT: reads the three RAW venue source arrays — pfpVenues, groceryOsmVenues,
 * plentifulPantries — and generates scripts/generated/seed-admin.sql: one
 * INSERT per record, mapped onto the `venues` table shape defined in
 * migrations/0001_init_admin_schema.sql. Also computes and prints a
 * validation report (per-source counts, PUEBLO_COUNTY_BBOX check,
 * duplicate-id check across all three id namespaces, and a name/coordinates
 * "possible rename" similarity check) — see
 * docs/admin/cloudflare-native-admin-spec.md §7 step 3, the acceptance spec
 * this script implements.
 *
 * WHY raw arrays, not venues.ts's combined `venues` export: that export
 * bakes in the benefit-flags.ts SNAP/WIC overlay at import time (its
 * `.map()` at the bottom of venues.ts unconditionally lets a matched flag
 * win). D1's accepts_snap/accepts_wic must hold only genuinely
 * source-authored values so the tri-state NULL = "no opinion yet" is
 * meaningful — benefit-flags.ts stays a separately-refreshable overlay
 * (spec §7 step 1, the "NB4" fix) that only ever fills a NULL, and only
 * ever wins once an admin can edit D1 directly. Seeding the overlay's
 * guesses as if they were explicit source values would make every one of
 * those fields look admin-set on day one and permanently block the overlay
 * from ever applying again.
 *
 * RUN — one-time, by a human with `wrangler d1 execute` access. NOT part of
 * CI and not imported by app code.
 *   bun run scripts/seed-admin-db.ts
 *   # bun unavailable? fall back to: npx tsx scripts/seed-admin-db.ts
 * This only WRITES scripts/generated/seed-admin.sql (gitignored — derivable
 * from the committed .ts data files) and prints the report; it does not
 * itself touch D1. Review the generated file, then apply with:
 *   npx wrangler d1 execute pueblo-food-map-admin --local  --file=scripts/generated/seed-admin.sql
 *   npx wrangler d1 execute pueblo-food-map-admin --remote --file=scripts/generated/seed-admin.sql
 * `id` is a PRIMARY KEY, so re-applying against an already-seeded table
 * conflicts — see the spec's `DELETE FROM venues` recovery command if a
 * clean re-apply is needed while debugging.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Venue } from "@/types/venue";
import { pfpVenues } from "@/data/venues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";
import { PUEBLO_COUNTY_BBOX } from "@/data/pueblo-bbox";

// ─── Paths ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_FILE = join(REPO_ROOT, "scripts", "generated", "seed-admin.sql");

// ─── Types ──────────────────────────────────────────────────────────────────

export type SourceType = "pfp" | "osm" | "plentiful";

export interface SourceRecord {
  venue: Venue;
  sourceType: SourceType;
}

export interface DuplicateIdEntry {
  id: string;
  sources: SourceType[];
}

export interface SimilarPair {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  reason: string;
}

// `created_by` / `updated_by` / `published_by` are NOT NULL on `venues`
// (schema §4), but no admin identity exists yet at seed time — Cloudflare
// Access ships in checkpoint (c). This sentinel marks every seed-authored
// row distinctly from any real admin email that will appear once the admin
// write path is live.
export const SEED_ACTOR_EMAIL = "seed@pueblofoodmap.com";

// ─── Source data ────────────────────────────────────────────────────────────

export function buildSourceRecords(): SourceRecord[] {
  return [
    ...pfpVenues.map((venue): SourceRecord => ({ venue, sourceType: "pfp" })),
    ...groceryOsmVenues.map((venue): SourceRecord => ({ venue, sourceType: "osm" })),
    ...plentifulPantries.map((venue): SourceRecord => ({ venue, sourceType: "plentiful" })),
  ];
}

// ─── SQL value formatting ───────────────────────────────────────────────────

/** Quote + escape a TEXT value for a SQL literal; `undefined`/`null` -> bare NULL. */
export function sqlText(value: string | undefined | null): string {
  if (value === undefined || value === null) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

/** Tri-state boolean -> D1's NULL=unknown / 0=no / 1=yes INTEGER mapping (schema §4). */
export function sqlTriState(value: boolean | undefined): string {
  if (value === undefined) return "NULL";
  return value ? "1" : "0";
}

// ─── Bbox check ─────────────────────────────────────────────────────────────

/** Point-in-bbox test. bbox format: [[lngWest, latSouth], [lngEast, latNorth]]. */
export function isInsideBbox(
  lat: number,
  lng: number,
  bbox: typeof PUEBLO_COUNTY_BBOX = PUEBLO_COUNTY_BBOX,
): boolean {
  const [[lngWest, latSouth], [lngEast, latNorth]] = bbox;
  return lat >= latSouth && lat <= latNorth && lng >= lngWest && lng <= lngEast;
}

// ─── INSERT statement builder ───────────────────────────────────────────────

const INSERT_COLUMNS = [
  "id", "name", "category", "lat", "lng", "address", "hours_weekly",
  "accepts_snap", "accepts_wic", "phone", "email", "url", "notes", "operator",
  "source", "last_verified", "status", "source_type", "outside_county",
  "created_by", "updated_by", "published_at", "published_by",
] as const;

/**
 * Builds one INSERT statement for a source record. `created_at`/`updated_at`
 * are intentionally omitted from the column list so the schema's own
 * `DEFAULT (strftime(...))` fills them (spec §7 step 3 mapping).
 */
export function buildInsertSql(record: SourceRecord, seedTimestamp: string): string {
  const v = record.venue;
  const outsideCounty = isInsideBbox(v.lat, v.lng) ? 0 : 1;
  const hoursJson = v.hours_weekly ? JSON.stringify(v.hours_weekly) : undefined;

  const values = [
    sqlText(v.id),
    sqlText(v.name),
    sqlText(v.category),
    String(v.lat),
    String(v.lng),
    sqlText(v.address),
    sqlText(hoursJson),
    sqlTriState(v.accepts_snap),
    sqlTriState(v.accepts_wic),
    sqlText(v.phone),
    sqlText(v.email),
    sqlText(v.url),
    sqlText(v.notes),
    sqlText(v.operator),
    sqlText(v.source),
    sqlText(v.last_verified),
    sqlText("published"),
    sqlText(record.sourceType),
    String(outsideCounty),
    sqlText(SEED_ACTOR_EMAIL),
    sqlText(SEED_ACTOR_EMAIL),
    sqlText(seedTimestamp),
    sqlText(SEED_ACTOR_EMAIL),
  ];

  return `INSERT INTO venues (${INSERT_COLUMNS.join(", ")}) VALUES (${values.join(", ")});`;
}

// ─── Validation: duplicate ids across all 3 namespaces ─────────────────────

export function findDuplicateIds(records: SourceRecord[]): DuplicateIdEntry[] {
  const sourcesById = new Map<string, SourceType[]>();
  for (const { venue, sourceType } of records) {
    const list = sourcesById.get(venue.id);
    if (list) {
      list.push(sourceType);
    } else {
      sourcesById.set(venue.id, [sourceType]);
    }
  }
  const duplicates: DuplicateIdEntry[] = [];
  for (const [id, sources] of sourcesById) {
    if (sources.length > 1) duplicates.push({ id, sources });
  }
  return duplicates;
}

// ─── Validation: name / coords "possible rename" similarity check ──────────
// Same heuristic §6.6's review-UI "possible rename" hint uses (spec §7 step
// 3). Deliberately simple (ponytail — no fuzzy-matching library): flags a
// pair when the case-insensitive trimmed names match AND the coordinates
// are within ~0.001° of each other, OR when they share an identical
// non-empty phone. O(n²) over 108 records (~5.8k comparisons) is trivial at
// this scale.

const COORD_EPSILON_DEGREES = 0.001;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function findSimilarPairs(records: SourceRecord[]): SimilarPair[] {
  const pairs: SimilarPair[] = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i].venue;
      const b = records[j].venue;

      const sameName = normalizeName(a.name) === normalizeName(b.name);
      const closeCoords =
        Math.abs(a.lat - b.lat) <= COORD_EPSILON_DEGREES &&
        Math.abs(a.lng - b.lng) <= COORD_EPSILON_DEGREES;
      const namePlusCoordsMatch = sameName && closeCoords;

      const phoneMatch = !!a.phone && !!b.phone && a.phone.trim() === b.phone.trim();

      if (!namePlusCoordsMatch && !phoneMatch) continue;

      const reasons: string[] = [];
      if (namePlusCoordsMatch) reasons.push("same name + coordinates within 0.001°");
      if (phoneMatch) reasons.push("same phone");

      pairs.push({
        aId: a.id,
        aName: a.name,
        bId: b.id,
        bName: b.name,
        reason: reasons.join("; "),
      });
    }
  }

  return pairs;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const isMainModule = (() => {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
})();

async function main(): Promise<void> {
  const seedTimestamp = new Date().toISOString();
  const records = buildSourceRecords();

  const readCounts: Record<SourceType, number> = {
    pfp: pfpVenues.length,
    osm: groceryOsmVenues.length,
    plentiful: plentifulPantries.length,
  };
  const writtenCounts: Record<SourceType, number> = { pfp: 0, osm: 0, plentiful: 0 };
  const statements: string[] = [];
  for (const record of records) {
    writtenCounts[record.sourceType]++;
    statements.push(buildInsertSql(record, seedTimestamp));
  }

  const outsideBbox = records.map((r) => r.venue).filter((v) => !isInsideBbox(v.lat, v.lng));
  const duplicates = findDuplicateIds(records);
  const similarPairs = findSimilarPairs(records);

  const sourceOrder: SourceType[] = ["pfp", "osm", "plentiful"];
  const totalRead = sourceOrder.reduce((sum, s) => sum + readCounts[s], 0);
  const totalWritten = sourceOrder.reduce((sum, s) => sum + writtenCounts[s], 0);

  console.log("=== Pueblo Food Map Admin DB — Seed & Validation Report ===");
  console.log(`Generated: ${seedTimestamp}\n`);

  console.log("--- 1. Per-source counts (read / written) ---");
  for (const s of sourceOrder) {
    console.log(`  ${s.padEnd(10)} ${readCounts[s]}/${readCounts[s]} read, ${writtenCounts[s]}/${readCounts[s]} written`);
  }
  console.log(`  ${"TOTAL".padEnd(10)} ${totalRead}/${totalRead} read, ${totalWritten}/${totalRead} written\n`);

  console.log("--- 2. Bbox check (PUEBLO_COUNTY_BBOX) ---");
  if (outsideBbox.length === 0) {
    console.log("  None. All records fall within PUEBLO_COUNTY_BBOX.\n");
  } else {
    for (const v of outsideBbox) {
      console.log(`  OUTSIDE BBOX: ${v.id} "${v.name}" (${v.lat}, ${v.lng})`);
    }
    console.log("");
  }

  console.log("--- 3. Duplicate-id collisions (across pfp+osm+plentiful combined) ---");
  if (duplicates.length === 0) {
    console.log("  None. All ids are unique across all three source namespaces.\n");
  } else {
    for (const d of duplicates) {
      console.log(`  DUPLICATE: id="${d.id}" appears in sources: ${d.sources.join(", ")}`);
    }
    console.log("");
  }

  console.log('--- 4. Name / lat-lng similarity ("possible rename" / likely-duplicate) check ---');
  if (similarPairs.length === 0) {
    console.log("  None found.\n");
  } else {
    console.log(`  ${similarPairs.length} candidate pair(s) found:`);
    for (const p of similarPairs) {
      console.log(`  - ${p.aId} ("${p.aName}")  <->  ${p.bId} ("${p.bName}")`);
      console.log(`      reason: ${p.reason}`);
    }
    console.log("");
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  const header =
    `-- Auto-generated by scripts/seed-admin-db.ts — DO NOT COMMIT (gitignored).\n` +
    `-- Generated: ${seedTimestamp}\n` +
    `-- ${statements.length} INSERT statements — pfp ${writtenCounts.pfp}, osm ${writtenCounts.osm}, plentiful ${writtenCounts.plentiful}.\n\n`;
  writeFileSync(OUT_FILE, header + statements.join("\n") + "\n", "utf-8");

  console.log(`Wrote ${statements.length} INSERT statements to ${OUT_FILE}`);
  console.log("\nNext steps (apply manually, review the file first):");
  console.log("  npx wrangler d1 execute pueblo-food-map-admin --local  --file=scripts/generated/seed-admin.sql");
  console.log("  npx wrangler d1 execute pueblo-food-map-admin --remote --file=scripts/generated/seed-admin.sql");
}

if (isMainModule) {
  main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  });
}
