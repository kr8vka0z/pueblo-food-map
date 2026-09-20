/**
 * load-real-blessing-boxes.ts — turns Kyle's real Pueblo-area blessing-box
 * address list into ready-to-apply SQL. Real-data sibling of
 * scripts/seed-blessing-boxes.ts (same shape: this only WRITES two SQL
 * files into scripts/generated/ — gitignored, derivable from this committed
 * script — and never touches D1 itself).
 *
 * Source list: atlas-kb/projects/Pueblo Food Map/Blessing Boxes - Initial
 * Location List.md — 27 real locations from Kyle's Google My Maps layer
 * (2026-09-18). "216 W Routt" is intentionally NOT here: that box is
 * already live via migrations/0006_convert_routt_blessing_box.sql.
 *
 * Geocoding: the same free US Census geocoder the admin venue-create path
 * uses (src/app/api/admin/geocode/route.ts) — same endpoint, benchmark, and
 * coordinate rounding. That route's own parser (parseMatches/round6) isn't
 * exported, so this script can't import it directly without editing an
 * unrelated admin route out of this slice's scope; it mirrors the same
 * request shape instead. Results are cached to
 * scripts/generated/load-real-blessing-boxes-geocode-cache.json so re-runs
 * don't re-hit the service.
 *
 * Every address is checked against PUEBLO_COUNTY_BBOX
 * (src/data/pueblo-bbox.ts) after geocoding. Anything the geocoder can't
 * resolve, or that resolves outside the county bbox, is EXCLUDED from the
 * generated SQL and printed in a "needs attention" list — never silently
 * dropped or guessed.
 *
 * Idempotent re-run: ids are deterministic (slug of the street address, see
 * boxId() below), and every INSERT uses `INSERT OR IGNORE` (same mechanism
 * migrations/0006 already uses for blessing_boxes) — so applying the
 * generated SQL twice against the same database cannot create duplicates.
 * The SQL carries no environment-specific values, so the same two files
 * apply to staging and production alike.
 *
 * RUN — one-time, human-reviewed, same convention as seed-blessing-boxes.ts:
 *   bun run scripts/load-real-blessing-boxes.ts
 * (or: bunx tsx scripts/load-real-blessing-boxes.ts)
 * This only WRITES the files below; review them, then apply with wrangler
 * yourself (staging or prod — your call, not this script's):
 *   npx wrangler d1 execute <db-name> --remote --file=scripts/generated/load-real-blessing-boxes.sql
 *   npx wrangler d1 execute <db-name> --remote --file=scripts/generated/remove-real-blessing-boxes.sql
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUEBLO_COUNTY_BBOX } from "@/data/pueblo-bbox";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const GENERATED_DIR = join(REPO_ROOT, "scripts", "generated");
const LOAD_OUT_FILE = join(GENERATED_DIR, "load-real-blessing-boxes.sql");
const REMOVE_OUT_FILE = join(GENERATED_DIR, "remove-real-blessing-boxes.sql");
const CACHE_FILE = join(GENERATED_DIR, "load-real-blessing-boxes-geocode-cache.json");

// ─── Source list (Blessing Boxes - Initial Location List.md) ───────────────

interface RealBoxSource {
  order: number;
  streetAddress: string;
  cityStateZip: string;
  /** Only entry 19 (the church) carries extra fields per Kyle's naming rule. */
  name?: string;
  phone?: string;
  website?: string;
  description?: string;
}

// ponytail: cityStateZip defaults to "Pueblo, CO" for every entry except the
// three the source list itself calls out (Pueblo West, Avondale, and the
// church's own full Google-Maps address) — matches the list's own "City is
// Pueblo unless the entry says otherwise" note, no need for a fancier
// per-entry geocoding config.
const PUEBLO = "Pueblo, CO";

const REAL_BOXES: RealBoxSource[] = [
  { order: 1, streetAddress: "573 S Rogers Dr", cityStateZip: PUEBLO },
  { order: 2, streetAddress: "1308 E Ash St", cityStateZip: PUEBLO },
  { order: 3, streetAddress: "1923 E 8th St", cityStateZip: PUEBLO },
  { order: 4, streetAddress: "1139 Cedar St", cityStateZip: PUEBLO },
  { order: 5, streetAddress: "1016 N Elizabeth St", cityStateZip: PUEBLO },
  { order: 6, streetAddress: "621 E Paseo Dorado Dr", cityStateZip: PUEBLO },
  { order: 7, streetAddress: "1113 Blake St", cityStateZip: PUEBLO },
  { order: 8, streetAddress: "903 E 2nd St", cityStateZip: PUEBLO },
  { order: 9, streetAddress: "1099 S McCulloch Blvd", cityStateZip: "Pueblo West, CO" },
  { order: 10, streetAddress: "1411 Santa Rosa St", cityStateZip: PUEBLO },
  { order: 11, streetAddress: "2724 Cheyenne Ave", cityStateZip: PUEBLO },
  { order: 12, streetAddress: "2713 N Grand Ave", cityStateZip: PUEBLO },
  { order: 13, streetAddress: "2320 E Routt Ave", cityStateZip: PUEBLO },
  { order: 14, streetAddress: "2924 E 13th St", cityStateZip: PUEBLO },
  { order: 15, streetAddress: "1004 W 15th St", cityStateZip: PUEBLO },
  { order: 16, streetAddress: "1587 36th Ln", cityStateZip: PUEBLO },
  { order: 17, streetAddress: "302 US-50 BUS", cityStateZip: "Avondale, CO" },
  { order: 18, streetAddress: "1249 E Routt Ave", cityStateZip: PUEBLO },
  {
    order: 19,
    streetAddress: "3910 O Neal Ave",
    cityStateZip: "Pueblo, CO 81005",
    name: "Pueblo First Seventh-Day Adventist Church",
    phone: "(719) 564-6193",
    website: "https://www.pueblofirstsda.com",
    description:
      "Located just south of the Southwest Corner of Vinewood and O'neal. Accepting and donating non perishable food and hygienic items.",
  },
  { order: 20, streetAddress: "540 Alma Ave", cityStateZip: PUEBLO },
  { order: 21, streetAddress: "3223 Shalimar Terrace", cityStateZip: PUEBLO },
  { order: 22, streetAddress: "421 E Spaulding Ave", cityStateZip: PUEBLO },
  { order: 23, streetAddress: "740 W 15th St", cityStateZip: PUEBLO },
  { order: 24, streetAddress: "516 W 6th St", cityStateZip: PUEBLO },
  { order: 25, streetAddress: "275 W John Powell Blvd", cityStateZip: PUEBLO },
  { order: 26, streetAddress: "4007 Valley Dr", cityStateZip: PUEBLO },
  // Entry 27 shows a teal pin on Kyle's map layer; he doesn't know what that
  // means, so per his instruction it's treated as a regular box (task spec).
  { order: 27, streetAddress: "2529 E 8th St", cityStateZip: PUEBLO },
];

// ─── Census geocoder (mirrors src/app/api/admin/geocode/route.ts) ─────────

const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const CENSUS_BENCHMARK = "Public_AR_Current";
const FETCH_TIMEOUT_MS = 8000;
// ponytail: politeness delay between live geocoder calls — Census documents
// no hard rate limit for this endpoint, but 27 back-to-back requests from a
// script is exactly the kind of burst a free public API might throttle.
const REQUEST_DELAY_MS = 250;

interface CensusMatch {
  lat: number;
  lng: number;
  matchedAddress: string;
}

interface CacheEntry {
  queriedAt: string;
  matches: CensusMatch[];
}

type GeocodeCache = Record<string, CacheEntry>;

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function loadCache(): GeocodeCache {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as GeocodeCache;
  } catch {
    return {};
  }
}

function saveCache(cache: GeocodeCache): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Same shape as the admin geocode route's own CensusGeocoderResponse parsing. */
async function geocodeAddress(query: string): Promise<CensusMatch[]> {
  const url = `${CENSUS_GEOCODER_URL}?address=${encodeURIComponent(query)}&benchmark=${CENSUS_BENCHMARK}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}`);
  const data = (await res.json()) as {
    result?: { addressMatches?: { matchedAddress?: unknown; coordinates?: { x?: unknown; y?: unknown } }[] };
  };
  const raw = data.result?.addressMatches;
  if (!Array.isArray(raw)) return [];
  const matches: CensusMatch[] = [];
  for (const entry of raw) {
    const x = entry.coordinates?.x;
    const y = entry.coordinates?.y;
    const matchedAddress = entry.matchedAddress;
    if (typeof x !== "number" || typeof y !== "number" || typeof matchedAddress !== "string") continue;
    matches.push({ lat: round6(y), lng: round6(x), matchedAddress });
  }
  return matches;
}

/** [[lngWest, latSouth], [lngEast, latNorth]] per src/data/pueblo-bbox.ts's own doc comment. */
function isInPuebloBbox(lat: number, lng: number): boolean {
  const [[lngWest, latSouth], [lngEast, latNorth]] = PUEBLO_COUNTY_BBOX;
  return lat >= latSouth && lat <= latNorth && lng >= lngWest && lng <= lngEast;
}

// ─── Geocoding results / report ────────────────────────────────────────────

interface GeocodedBox extends RealBoxSource {
  fullQuery: string;
  lat: number | null;
  lng: number | null;
  matchedAddress: string | null;
  inBbox: boolean;
  ok: boolean;
}

async function geocodeAll(sources: RealBoxSource[]): Promise<GeocodedBox[]> {
  const cache = loadCache();
  const results: GeocodedBox[] = [];
  let cacheDirty = false;

  for (const source of sources) {
    const fullQuery = `${source.streetAddress}, ${source.cityStateZip}`;
    let entry = cache[fullQuery];

    if (!entry) {
      let matches: CensusMatch[];
      try {
        matches = await geocodeAddress(fullQuery);
      } catch (err) {
        console.error(`  ! geocode failed for "${fullQuery}": ${err instanceof Error ? err.message : err}`);
        matches = [];
      }
      entry = { queriedAt: new Date().toISOString(), matches };
      cache[fullQuery] = entry;
      cacheDirty = true;
      await sleep(REQUEST_DELAY_MS);
    }

    const best = entry.matches[0] ?? null;
    const inBbox = best !== null && isInPuebloBbox(best.lat, best.lng);
    results.push({
      ...source,
      fullQuery,
      lat: best?.lat ?? null,
      lng: best?.lng ?? null,
      matchedAddress: best?.matchedAddress ?? null,
      inBbox,
      ok: best !== null && inBbox,
    });
  }

  if (cacheDirty) saveCache(cache);
  return results;
}

// ─── SQL generation ─────────────────────────────────────────────────────────

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlOptString(value: string | null | undefined): string {
  return value ? sqlString(value) : "NULL";
}

/** Deterministic id from the street address — see header's "Idempotent re-run" note. */
function boxId(streetAddress: string): string {
  const slug = streetAddress
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `real-blessing-box-${slug}`;
}

function boxName(box: GeocodedBox): string {
  // Naming convention is Kyle's, not invented here: entries carry no host or
  // box name of their own except the church, which he named explicitly.
  return box.name ?? `Blessing Box — ${box.streetAddress}`;
}

const RUN_LABEL = "load-real-blessing-boxes.ts";
const VENUES_INSERT_COLUMNS = [
  "id", "name", "category", "lat", "lng", "address", "phone", "url", "notes",
  "source", "last_verified", "status", "source_type", "outside_county",
  "created_by", "updated_by",
] as const;

function buildLoadSql(boxes: GeocodedBox[], today: string): string {
  const lines: string[] = [
    `-- GENERATED by scripts/${RUN_LABEL} — real Pueblo-area blessing box`,
    "-- locations from Kyle's Google My Maps list (see the script header for",
    "-- the source note). Idempotent: every INSERT uses OR IGNORE against a",
    "-- deterministic id, so re-applying this file is a no-op the second time.",
    "-- Safe for staging or production — no environment-specific values.",
    "",
  ];

  for (const box of boxes) {
    const id = boxId(box.streetAddress);
    lines.push(
      `INSERT OR IGNORE INTO venues (${VENUES_INSERT_COLUMNS.join(", ")}) VALUES (` +
        `${sqlString(id)}, ${sqlString(boxName(box))}, 'blessing_box', ${box.lat}, ${box.lng}, ` +
        `${sqlString(box.matchedAddress ?? box.fullQuery)}, ${sqlOptString(box.phone)}, ` +
        `${sqlOptString(box.website)}, ${sqlOptString(box.description)}, ` +
        `${sqlString(RUN_LABEL)}, ${sqlString(today)}, 'published', 'manual', 0, ` +
        `${sqlString(RUN_LABEL)}, ${sqlString(RUN_LABEL)});`,
    );
    // Matches migrations/0006_convert_routt_blessing_box.sql's own pattern
    // exactly: no host info known yet for any of these, an admin fills it in
    // later via the edit screen.
    lines.push(`INSERT OR IGNORE INTO blessing_boxes (venue_id) VALUES (${sqlString(id)});`);
  }

  return lines.join("\n") + "\n";
}

function buildRemoveSql(boxes: GeocodedBox[]): string {
  const lines: string[] = [
    `-- GENERATED by scripts/${RUN_LABEL} — removes the real blessing boxes`,
    "-- this script's load file inserted. blessing_boxes rows delete first",
    "-- (no FK enforcement in this schema, but matches the delete-child-then-",
    "-- parent order everywhere else in this repo).",
    "",
  ];
  for (const box of boxes) {
    const id = boxId(box.streetAddress);
    lines.push(`DELETE FROM blessing_boxes WHERE venue_id = ${sqlString(id)};`);
    lines.push(`DELETE FROM venues WHERE id = ${sqlString(id)};`);
  }
  return lines.join("\n") + "\n";
}

// ─── Report ─────────────────────────────────────────────────────────────────

function printReport(boxes: GeocodedBox[]): void {
  console.log("\nGeocoding results:\n");
  console.log(
    "order | address                              | lat        | lng          | matched address                                   | in bbox | ok",
  );
  console.log("-".repeat(140));
  for (const b of boxes) {
    console.log(
      `${String(b.order).padStart(5)} | ${b.streetAddress.padEnd(36)} | ${(b.lat ?? "—").toString().padEnd(10)} | ` +
        `${(b.lng ?? "—").toString().padEnd(12)} | ${(b.matchedAddress ?? "(no match)").toString().padEnd(50)} | ` +
        `${(b.inBbox ? "yes" : "no").padEnd(7)} | ${b.ok ? "OK" : "SKIPPED"}`,
    );
  }

  const problems = boxes.filter((b) => !b.ok);
  if (problems.length > 0) {
    console.log("\nNeeds attention (excluded from the SQL):");
    for (const b of problems) {
      const reason = b.lat === null ? "geocoder found no match" : "resolved outside the Pueblo County bbox";
      console.log(`  #${b.order} "${b.fullQuery}" — ${reason}`);
    }
  } else {
    console.log("\nAll addresses geocoded and landed inside the Pueblo County bbox.");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Geocoding ${REAL_BOXES.length} real blessing box addresses via the US Census geocoder...`);
  const geocoded = await geocodeAll(REAL_BOXES);
  printReport(geocoded);

  const usable = geocoded.filter((b) => b.ok);
  const today = new Date().toISOString().slice(0, 10);

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(LOAD_OUT_FILE, buildLoadSql(usable, today), "utf-8");
  writeFileSync(REMOVE_OUT_FILE, buildRemoveSql(usable), "utf-8");

  console.log(`\nWrote ${usable.length} of ${geocoded.length} boxes to:`);
  console.log(`  ${LOAD_OUT_FILE}`);
  console.log(`  ${REMOVE_OUT_FILE}`);
  console.log("\nReview both files, then apply with wrangler yourself (staging or prod).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
