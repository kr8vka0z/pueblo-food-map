/**
 * refresh-ingest.ts — orchestrates the automated venue-refresh pipeline
 * (fixes: venue data hadn't been re-verified since 2026-05 because the
 * scrapers wrote committed .ts files nothing read — see README.md "Data
 * sources" and .github/workflows/refresh-proposals.yml's header for the
 * end-to-end picture). Run by that workflow (weekly cron + manual
 * dispatch); safe to run locally too, see usage below.
 *
 * What this does, in order:
 *   1. Re-runs the two existing scraper scripts UNMODIFIED
 *      (scrape-plentiful.py, fetch-osm-grocery.py + ingest-osm-grocery.py)
 *      and reads their freshly-regenerated output.
 *   2. Loads the current D1 `venues` rows for each source_type.
 *   3. Diffs them (scripts/refresh/diffEngine.ts — pure, unit-tested) into
 *      change_proposals drafts, applying the abnormal-drop and zero-record
 *      guardrails per source.
 *   4. Runs the outbound link-health pass (scripts/refresh/linkHealth.ts)
 *      over every venue with a stored url.
 *   5. If the combined total exceeds the per-run cap, aborts and writes
 *      NOTHING. Otherwise pairs likely renames (a remove + an add at the
 *      same spot or phone → one update of the old id) and has TypeSafe Jev
 *      triage each proposal into a review lane (scripts/refresh/triage.ts,
 *      #543 — `JEV_API_KEY`; absent or failing = written untriaged). Then
 *      writes every surviving proposal as one batch of
 *      SQL statements — `wrangler d1 execute --local --file` locally
 *      (Miniflare's real db.batch()), or `wrangler d1 execute --remote
 *      --command` in production (D1's REST /query endpoint, itself
 *      documented as executing multiple `;`-joined statements "as a
 *      batch" — see d1ApplyFile's own WHY comment for the full trace) —
 *      after superseding any earlier-run pending proposal for the same
 *      (source, target_venue_id).
 *
 * By default this script never writes to `venues` — it only proposes. A
 * "date-only" proposal (change_type 'update', source osm/plentiful,
 * fields_changed EXACTLY ["last_verified"] — "still listed, nothing
 * changed", ~86 of ~104 proposals in a real run) needs no click (Kyle,
 * 2026-09-15), but since the Venue Data Rebuild step 1 (2026-10-25) it no
 * longer bumps `venues.last_verified`: a download isn't a confirmation. It
 * records a 'listed' fetch row in venue_observations (migration 0021) and
 * an already-'approved' change_proposals row instead — see
 * scripts/refresh/proposalSql.ts. Every OTHER proposal shape (a real field
 * change, an add, a remove, any link_health finding) writes a pending
 * `change_proposals` row; a human approving one of those is the path that
 * mutates `venues`. A proposal touching a field the venue itself told us
 * (a venue_direct pin) is always written pending, with the pin attached.
 *
 * One opt-in exception (#543), OFF unless the env var
 * REFRESH_AI_AUTO_APPLY=true: a phone/url change that is formatting-only
 * once normalised AND that Jev scores over 90% "same value" is applied the
 * same way, under actor `refresh-pipeline-ai` (proposalSql.ts).
 *
 * WHY shell out to `wrangler d1 execute` instead of a D1Database binding:
 * this runs as a plain Node process (GitHub Actions runner or a local
 * terminal), not inside a Cloudflare Worker — there's no binding to inject.
 * wrangler reads the CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID env vars.
 * In the workflow, refresh-proposals.yml fills CLOUDFLARE_API_TOKEN from the
 * D1-Write-only CLOUDFLARE_D1_TOKEN secret (#403), never from the deploy
 * token (AGENTS.md "Secrets").
 *
 * Usage:
 *   npx tsx scripts/refresh-ingest.ts --db-mode local    # local D1 (npm run preview's Miniflare SQLite)
 *   npx tsx scripts/refresh-ingest.ts --db-mode staging  # pueblo-food-map-admin-staging (dev.pueblofoodmap.com's database)
 *   npx tsx scripts/refresh-ingest.ts --db-mode remote   # PRODUCTION D1 — only ever run by the real workflow
 *
 * `local` and `remote` share the database name pueblo-food-map-admin and
 * differ only by wrangler's --local/--remote flag; `staging` is a separate
 * database. See DATABASE_NAMES below for why there is no free-form name flag.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Venue } from "@/types/venue";
import {
  diffSource,
  exceedsPerRunCap,
  excludeBlessingBoxes,
  isValidIncomingRecord,
  pendingKey,
  rejectionKey,
  buildLinkHealthProposal,
  PER_RUN_PROPOSAL_CAP,
  type CurrentVenueRow,
  type ProposalDraft,
  type RefreshSource,
} from "./refresh/diffEngine";
import { checkUrl } from "./refresh/linkHealth";
import { buildProposalWriteStatements, type PinRow } from "./refresh/proposalSql";
import { applyIdAliases, type IdAliasRow } from "./refresh/renamePairs";
import {
  buildCareAndShareProposals,
  CAS_SOURCE,
  dropAlreadyReviewed,
  fetchCareAndShare,
  REJECTED_LINKS_SQL,
  rejectedLinkKey,
} from "./refresh/careAndShare";
import {
  computeSwitchStates,
  SWITCH_HISTORY_SQL,
  SWITCH_RESETS_SQL,
  type SwitchHistoryRow,
  type SwitchResetRow,
  type SwitchState,
} from "@/lib/sourceSwitch";
import { chunkSqlStatements } from "./refresh/sqlChunks";
import { createTriageSession, runTriagePass, USD_PER_INPUT_TOKEN } from "./refresh/triage";

const REPO_ROOT = join(__dirname, "..");
// wrangler.jsonc's two D1 bindings, keyed by --db-mode. `local` and `remote`
// are the SAME database name (top-level d1_databases[0]) differing only by
// wrangler's --local/--remote flag: Miniflare's on-disk SQLite vs. the real
// production database. `staging` is a genuinely DIFFERENT database
// (env.staging.d1_databases[0], id 909e74b2-…) that dev.pueblofoodmap.com
// binds — provisioned specifically so the admin surface has real rows to
// render without ever reading or writing production.
//
// WHY staging is its own mode rather than a free-form `--database <name>`
// flag: the only thing this script must never do by accident is write to
// production, and a name flag makes prod the default that a typo falls back
// to. Three fixed modes make every possible invocation an explicit,
// reviewable choice — there is no way to spell "staging" slightly wrong and
// silently hit prod, because a bad value exits 1.
const DATABASE_NAMES = {
  local: "pueblo-food-map-admin",
  remote: "pueblo-food-map-admin",
  staging: "pueblo-food-map-admin-staging",
} as const;
const LINK_HEALTH_DELAY_MS = 500; // politeness — same order of magnitude as scrape-plentiful.py's DETAIL_SLEEP

// Invoke wrangler's own JS entrypoint via `node`, not `npx wrangler` —
// execFileSync resolves a bare command against PATH with no shell, which
// breaks on Windows for `npx` (a `.cmd` shim); the `shell: true` escape
// hatch was tried and reverted (Node's own docs: shell:true does NOT escape
// array args, it just concatenates them, which silently tore this file's
// quoted SQL strings apart word-by-word). `process.execPath` is the exact
// node binary already running this script — resolving wrangler's real bin
// file directly sidesteps PATH/shell/.cmd entirely, identically on Windows
// dev machines (this repo's primary environment, AGENTS.md) and Linux CI.
const WRANGLER_BIN = join(REPO_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const PYTHON_CMD = process.platform === "win32" ? "python" : "python3";

// ─── CLI args ───────────────────────────────────────────────────────────────

type DbMode = keyof typeof DATABASE_NAMES;

/**
 * `--only care_and_share` runs just the Care and Share reader (no Plentiful
 * or OSM scrape, no link-health pass). `--dry-run` reads everything, prints
 * what it found, and writes NOTHING (no proposals, aliases or Jev calls) —
 * the way to watch a source against a local database before trusting it.
 */
function parseFlags(argv: string[]): { onlyCareAndShare: boolean; dryRun: boolean } {
  const idx = argv.indexOf("--only");
  const only = idx >= 0 ? argv[idx + 1] : undefined;
  if (only !== undefined && only !== CAS_SOURCE) {
    console.error(`FATAL: --only accepts only "${CAS_SOURCE}".`);
    process.exit(1);
  }
  return { onlyCareAndShare: only === CAS_SOURCE, dryRun: argv.includes("--dry-run") };
}

function parseDbMode(argv: string[]): DbMode {
  const idx = argv.indexOf("--db-mode");
  const value = idx >= 0 ? argv[idx + 1] : undefined;
  if (value !== "local" && value !== "remote" && value !== "staging") {
    console.error('FATAL: --db-mode <local|remote|staging> is required (e.g. "npx tsx scripts/refresh-ingest.ts --db-mode local").');
    process.exit(1);
  }
  return value;
}

/**
 * Which wrangler flag a mode maps to. `staging` is remote — it's a real
 * Cloudflare-hosted database, just not the production one; the isolation
 * comes from the database NAME (DATABASE_NAMES above), not from this flag.
 */
function wranglerLocationFlag(dbMode: DbMode): "--local" | "--remote" {
  return dbMode === "local" ? "--local" : "--remote";
}

// ─── wrangler d1 execute wrapper ────────────────────────────────────────────

interface WranglerD1Result<T> {
  results: T[];
  success: boolean;
}

/** Runs a read-only query via `wrangler d1 execute --json` and returns its rows. */
function d1Query<T>(dbMode: DbMode, sql: string): T[] {
  const args = [WRANGLER_BIN, "d1", "execute", DATABASE_NAMES[dbMode], wranglerLocationFlag(dbMode), "--json", "--command", sql];
  const stdout = execFileSync(process.execPath, args, { cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 });
  // wrangler prints npm-notice/update-check noise on stdout ahead of the
  // JSON in some installs — find the JSON array by its opening bracket
  // rather than assuming stdout is pure JSON.
  const jsonStart = stdout.indexOf("[");
  const parsed = JSON.parse(stdout.slice(jsonStart)) as WranglerD1Result<T>[];
  return parsed[0]?.results ?? [];
}

/**
 * Applies a batch of SQL statements. `--local` uses `--file` — same apply
 * mechanism scripts/seed-admin-db.ts documents, and Miniflare's real
 * `db.batch()` under the hood (verified in wrangler's own bundled source,
 * `executeLocally`: `splitSqlQuery` + `db.batch(queries.map(db.prepare))`).
 *
 * `--remote` deliberately does NOT use `--file` (fix, was the original bug
 * here): wrangler's `executeRemotely` (node_modules/wrangler/wrangler-dist/
 * cli.js, `executeSql`/`executeRemotely`) branches on `input.file` — when
 * set, it skips the query path ENTIRELY and instead uploads the file to R2
 * and polls a D1 "import" job, printing "your D1 database will be
 * unavailable to serve queries" while it runs. An import outage on a
 * remote database is never acceptable here: this job runs weekly against
 * the SAME database that also holds Better Auth sessions, the auth
 * rate-limit table, and public_submissions — a brief outage here logs the
 * admin out and silently drops any public form submission landing in that
 * window (best-effort insert, see ARCHITECTURE.md "Form-route triad").
 * `--command` instead takes the OTHER branch of that same `executeRemotely`
 * function: no `input.file`, so it posts straight to D1's REST `/query`
 * endpoint (`d1ApiPost(..., "query", { sql })`) — the identical live-query
 * mechanism `d1Query()` above already uses for every read in this file,
 * proven to not take anything offline. Cloudflare's own D1 API docs
 * confirm a `;`-joined multi-statement `sql` string here "will be executed
 * as a batch," and D1's batch semantics (per Cloudflare's docs) commit
 * sequentially and roll back the whole sequence on any one failure.
 *
 * CHUNKING (fix, found by the first real remote run — 107 proposals against
 * the staging database — on 2026-09-02): passing the whole run's SQL as ONE
 * `--command` argv blows Windows' 32,767-character CreateProcess limit and
 * dies with `spawnSync … ENAMETOOLONG` before wrangler ever starts. A full
 * run is ~45 KB of SQL, so this is the normal case, not an edge case. See
 * scripts/refresh/sqlChunks.ts for the split itself and its own tests.
 *
 * ponytail: the ceiling this introduces is that a run is no longer ONE atomic
 * batch — it is a sequence of them, so a mid-sequence failure leaves the
 * earlier chunks committed. That is tolerable here specifically because a
 * `change_proposals` row is inert until a human approves it, and because the
 * diff engine is idempotent against current D1 state: whatever a failed chunk
 * didn't write simply gets re-proposed by the next run. The one sharp edge is
 * main()'s run_id idempotency guard — re-running a PARTIALLY-failed Action
 * under the SAME run_id (GitHub's "Re-run jobs", which keeps run_id stable)
 * sees the earlier chunks' rows and exits 0 without finishing the run. Recover
 * with a fresh `workflow_dispatch` run, which gets a new run_id. Upgrade path
 * if that ever bites: write the SQL through D1's REST /query endpoint directly
 * (no argv involved, no chunking needed) instead of shelling out to wrangler.
 */
function d1ApplyFile(dbMode: DbMode, filePath: string): void {
  if (dbMode !== "local") {
    const chunks = chunkSqlStatements(readFileSync(filePath, "utf-8"));
    chunks.forEach((chunk, i) => {
      console.log(`  applying chunk ${i + 1}/${chunks.length}...`);
      execFileSync(
        process.execPath,
        [WRANGLER_BIN, "d1", "execute", DATABASE_NAMES[dbMode], "--remote", "--command", chunk],
        { cwd: REPO_ROOT, stdio: "inherit" },
      );
    });
    return;
  }
  execFileSync(process.execPath, [WRANGLER_BIN, "d1", "execute", DATABASE_NAMES[dbMode], "--local", "--file", filePath], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

// ─── SQL literal helpers (deliberately NOT imported from seed-admin-db.ts) ─
// seed-admin-db.ts's sqlText/sqlTriState are byte-identical in spirit, but
// importing that module would also execute its own top-level
// `import { groceryOsmVenues } from "@/data/grocery-osm"` — which, under
// Node's ESM module cache, would lock in whatever grocery-osm.ts contained
// at THAT import time. This script deliberately imports grocery-osm.ts
// dynamically, AFTER re-running the OSM scraper below, specifically so it
// sees the freshly-regenerated file, not a stale cached copy — so nothing
// in this file's import graph may touch that module earlier. Two tiny
// functions duplicated is cheaper than that footgun.

function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

// ─── Scraper invocation ─────────────────────────────────────────────────────

function runPython(scriptRelPath: string): void {
  console.log(`\n--- Running ${scriptRelPath} ---`);
  execFileSync(PYTHON_CMD, [scriptRelPath], { cwd: REPO_ROOT, stdio: "inherit" });
}

/** Re-runs the Plentiful scraper and reads its freshly-regenerated TS module. */
async function scrapePlentiful(): Promise<Venue[]> {
  runPython("scripts/scrape-plentiful.py");
  // Cache-busting query param: forces a fresh module evaluation even if
  // this process somehow already touched this path (defensive — nothing
  // else in this file imports it earlier, but a stale re-import here would
  // be a silent, hard-to-notice correctness bug given the whole point of
  // this pipeline is seeing what CHANGED).
  const mod = (await import(`../src/data/pantries-plentiful.ts?t=${Date.now()}`)) as {
    plentifulPantries: Venue[];
  };
  return mod.plentifulPantries;
}

/** Fetches fresh Overpass data, then re-runs the OSM ingest script UNMODIFIED, and reads its output. */
async function scrapeOsm(): Promise<Venue[]> {
  runPython("scripts/fetch-osm-grocery.py");
  runPython("scripts/ingest-osm-grocery.py");
  const mod = (await import(`../src/data/grocery-osm.ts?t=${Date.now()}`)) as { groceryOsmVenues: Venue[] };
  return mod.groceryOsmVenues;
}

// ─── D1 row shape for current venues ────────────────────────────────────────

// hours_irregular (#400) needs migrations/0015 applied to the target D1
// first — against a database without it this SELECT fails loudly, which is
// the right failure (see AGENTS.md's promotion checklist).
const CURRENT_ROW_COLUMNS =
  "id, name, category, lat, lng, address, hours_weekly, hours_irregular, phone, url, operator, last_verified";

function loadCurrentRows(dbMode: DbMode, sourceType: RefreshSource): CurrentVenueRow[] {
  const sql = `SELECT ${CURRENT_ROW_COLUMNS} FROM venues WHERE source_type = '${sourceType}' AND status IN ('draft','published')`;
  return d1Query<CurrentVenueRow>(dbMode, sql);
}

interface RejectedRow {
  source: string;
  target_venue_id: string;
  diff_hash: string;
}
interface PendingRow {
  id: number;
  source: string;
  target_venue_id: string;
}
interface UrlRow {
  id: string;
  url: string;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dbMode = parseDbMode(process.argv.slice(2));
  const { onlyCareAndShare, dryRun } = parseFlags(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);
  // GitHub keeps run_id stable across a retried Action run (only
  // run_attempt increments) — spec §6.10d's idempotency key. Local runs get
  // a fresh id every invocation; there's no retry concept to dedupe against.
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;

  console.log(`=== Pueblo Food Map — automated refresh run ===`);
  console.log(`db-mode: ${dbMode}  database: ${DATABASE_NAMES[dbMode]}  run_id: ${runId}  today: ${today}`);
  if (dbMode === "remote") {
    console.log("!!! REMOTE MODE — this will write to PRODUCTION D1. !!!");
  }
  if (dbMode === "staging") {
    console.log("staging mode — writes to the dev.pueblofoodmap.com database, never production.");
  }
  if (dryRun) console.log("DRY RUN — reads only; nothing will be written.");
  if (onlyCareAndShare) console.log("--only care_and_share — skipping the Plentiful/OSM scrapes and the link-health pass.");

  // Idempotency (§6.10d): a retried Action re-POSTing under the same
  // run_id must not duplicate a whole run's proposals.
  const already = d1Query<{ cnt: number }>(dbMode, `SELECT COUNT(*) as cnt FROM change_proposals WHERE run_id = '${runId}'`);
  if ((already[0]?.cnt ?? 0) > 0) {
    console.log(`run_id "${runId}" already has proposals written — treating as a duplicate retry, exiting 0.`);
    return;
  }

  // ── 1 + 2: scrape, load current D1 state ──
  // Sequential, not Promise.all — each scraper shells out via execFileSync,
  // which blocks Node's single thread until that child process exits, so
  // the two scrapes were never actually concurrent despite the old
  // Promise.all wrapping (a misleading-but-harmless read, fixed here to
  // match what actually runs).
  const plentifulIncoming = onlyCareAndShare ? [] : await scrapePlentiful();
  const osmIncoming = onlyCareAndShare ? [] : await scrapeOsm();
  const currentByType: Record<RefreshSource, CurrentVenueRow[]> = {
    plentiful: loadCurrentRows(dbMode, "plentiful"),
    osm: loadCurrentRows(dbMode, "osm"),
  };

  const rejectedRows = d1Query<RejectedRow>(
    dbMode,
    "SELECT source, target_venue_id, diff_hash FROM change_proposals WHERE status = 'rejected'",
  );
  const rejectedKeys = new Set(rejectedRows.map((r) => rejectionKey(r.source as RefreshSource, r.target_venue_id, r.diff_hash)));

  const pendingRows = d1Query<PendingRow>(
    dbMode,
    "SELECT id, source, target_venue_id FROM change_proposals WHERE status = 'pending'",
  );

  // ── 3: diff each source ──
  const incomingByType: Record<RefreshSource, Venue[]> = {
    plentiful: plentifulIncoming.filter(isValidIncomingRecord),
    osm: osmIncoming.filter(isValidIncomingRecord),
  };
  for (const source of ["plentiful", "osm"] as const) {
    const dropped = (source === "plentiful" ? plentifulIncoming.length : osmIncoming.length) - incomingByType[source].length;
    if (dropped > 0) console.log(`  ${source}: dropped ${dropped} scraped record(s) that failed schema validation`);
  }

  // Migration 0016 (#543) — triage columns + venue_id_aliases. Probed rather
  // than assumed so a database that hasn't had it applied yet still gets a
  // normal, untriaged run instead of a failed one (the promotion checklist
  // applies it first, but a missed step must not break the weekly job).
  const schemaReady =
    d1Query<{ name: string }>(dbMode, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'venue_id_aliases'").length > 0;
  if (!schemaReady) console.log("\nmigration 0016 not applied to this database — skipping rename pairing and Jev triage.");

  // Migration 0021 (venue_observations: fetch rows + venue_direct pins).
  // Probed for the same reason as 0016 above. Without it no pin can exist,
  // so skipping the pin lookup is honest, and date-only rows just skip
  // their observation INSERT.
  const observationsReady =
    d1Query<{ name: string }>(dbMode, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'venue_observations'").length > 0;
  if (!observationsReady) console.log("migration 0021 not applied to this database — no pins checked, no fetch observations written.");
  // Newest pin per (venue, field) is the live one.
  const pins = observationsReady
    ? d1Query<PinRow>(
        dbMode,
        "SELECT o.venue_id, o.field, o.fetched_at, o.pinned_by, o.pin_note FROM venue_observations o " +
          "WHERE o.is_pin = 1 AND o.id = (SELECT MAX(id) FROM venue_observations p WHERE p.is_pin = 1 AND p.venue_id = o.venue_id AND p.field = o.field)",
      )
    : [];
  if (pins.length > 0) console.log(`pins: ${pins.length} venue-confirmed field(s) will only ever go to review.`);

  // Approved renames: map each new upstream id back onto the venue it was
  // approved as, BEFORE diffing — otherwise the renamed venue reappears as
  // the same remove+add pair every run.
  if (schemaReady) {
    const aliases = d1Query<IdAliasRow>(dbMode, "SELECT source, upstream_id, venue_id FROM venue_id_aliases");
    for (const source of ["plentiful", "osm"] as const) {
      incomingByType[source] = applyIdAliases(source, incomingByType[source], aliases, new Set(currentByType[source].map((r) => r.id)));
    }
  }

  // Blessing boxes are live, not managed by this pipeline — strip them from
  // both sides of every source's diff before it ever runs (see
  // excludeBlessingBoxes's own header for why both sides matter).
  for (const source of ["plentiful", "osm"] as const) {
    const stripped = excludeBlessingBoxes(currentByType[source], incomingByType[source]);
    currentByType[source] = stripped.currentRows;
    incomingByType[source] = stripped.incoming;
  }

  let allProposals: ProposalDraft[] = [];
  let anySourceAborted = false;

  for (const source of onlyCareAndShare ? ([] as const) : (["plentiful", "osm"] as const)) {
    const result = diffSource({
      source,
      currentRows: currentByType[source],
      incoming: incomingByType[source],
      runId,
      today,
      rejectedKeys,
    });
    console.log(
      `\n${source}: active=${result.activeCount} incoming=${incomingByType[source].length} ` +
        `proposals=${result.proposals.length} removalCandidates=${result.removalCandidateIds.length} ` +
        `anomaly=${result.anomaly} aborted=${result.aborted}`,
    );
    if (result.aborted) {
      anySourceAborted = true;
      console.error(`  ABORTED (writes nothing for this source): ${result.abortReason}`);
    }
    allProposals = allProposals.concat(result.proposals);
  }

  // ── 3b: Care and Share (Venue Data Rebuild step 2) ──
  // Any refusal/failure aborts THIS source only (nothing from it is
  // written, the job still fails loudly at the end); it never implies a
  // venue closed or changed. Its proposals target our pantries/meal sites of
  // any source_type, matched by alias, id, or the strong/ambiguous check in
  // scripts/refresh/careAndShare.ts. The raw-response cache lives in a temp
  // dir outside the repo and already has contact fields stripped.
  const casCacheDir = mkdtempSync(join(tmpdir(), "pfm-care-and-share-"));
  const cas = await fetchCareAndShare({
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (m) => console.log(m),
    cacheDir: casCacheDir,
  });
  let casCurrentRows: CurrentVenueRow[] = [];
  const aliasStatements: string[] = [];
  if (!cas.ok) {
    anySourceAborted = true;
    console.error(`\ncare_and_share: ABORTED after ${cas.requests} request(s) (writes nothing for this source): ${cas.reason}`);
  } else {
    // blessing_box rows are loaded only so buildCareAndShareProposals can strip them (excludeBlessingBoxes).
    casCurrentRows = d1Query<CurrentVenueRow>(
      dbMode,
      `SELECT ${CURRENT_ROW_COLUMNS} FROM venues WHERE status IN ('draft','published') AND category IN ('pantry','meal_site','blessing_box')`,
    );
    const casAliases = schemaReady
      ? d1Query<IdAliasRow>(dbMode, `SELECT source, upstream_id, venue_id FROM venue_id_aliases WHERE source = '${CAS_SOURCE}'`)
      : [];
    const built = buildCareAndShareProposals({
      locations: cas.locations,
      schedules: cas.schedules,
      venues: casCurrentRows,
      aliases: casAliases,
      runId,
      today,
      fetchedAt: cas.fetchedAt,
      rejectedLinks: new Set(
        d1Query<{ target_venue_id: string; upstream_id: string }>(dbMode, REJECTED_LINKS_SQL).map((r) =>
          rejectedLinkKey(r.upstream_id, r.target_venue_id),
        ),
      ),
      addressPinnedVenueIds: new Set(pins.filter((pin) => pin.field === "address").map((pin) => pin.venue_id)),
    });
    const approvedCasKeys = new Set(
      d1Query<RejectedRow>(
        dbMode,
        `SELECT source, target_venue_id, diff_hash FROM change_proposals WHERE source = '${CAS_SOURCE}' AND status = 'approved' ` +
          "AND reviewed_by NOT IN ('refresh-pipeline','refresh-pipeline-ai','refresh-pipeline-auto')",
      ).map((r) => rejectionKey(r.source as RefreshSource, r.target_venue_id, r.diff_hash)),
    );
    const casProposals = dropAlreadyReviewed(
      built.proposals.filter((p) => !rejectedKeys.has(rejectionKey(p.source, p.targetVenueId, p.diffHash))),
      approvedCasKeys,
    );
    console.log(
      `\ncare_and_share: locations=${cas.locations.length} requests=${cas.requests} strong=${built.stats.strong} ` +
        `ambiguous=${built.stats.ambiguous} duplicates=${built.stats.duplicates} adds=${built.stats.adds} ` +
        `unconvertibleSchedules=${built.stats.unconvertible} proposals=${casProposals.length} ` +
        `(rejected-before=${built.proposals.length - casProposals.length}) newAliases=${built.aliasWrites.length} cache=${casCacheDir}`,
    );
    for (const line of built.report) console.log(line);
    allProposals = allProposals.concat(casProposals);
    // Strong matches link themselves (plan, "Who decides what") — the first
    // time venue_id_aliases is written by the pipeline rather than on a
    // human approval. Written in the same deferred batch as the proposals,
    // so the cap/abort guards below cover them too.
    if (schemaReady) {
      for (const a of built.aliasWrites) {
        aliasStatements.push(
          "INSERT OR IGNORE INTO venue_id_aliases (source, upstream_id, venue_id, created_by) VALUES (" +
            [sqlText(CAS_SOURCE), sqlText(a.upstreamId), sqlText(a.venueId), sqlText("refresh-pipeline")].join(", ") +
            ");",
        );
      }
    }
  }

  // The automatic switch (src/lib/sourceSwitch.ts, migration 0023). Probed
  // like 0016/0021: without the table every pair stays proposal-only.
  const switchReady =
    observationsReady &&
    d1Query<{ name: string }>(dbMode, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'source_switch_resets'").length > 0;
  const switchStates: SwitchState[] = switchReady
    ? computeSwitchStates(d1Query<SwitchHistoryRow>(dbMode, SWITCH_HISTORY_SQL), d1Query<SwitchResetRow>(dbMode, SWITCH_RESETS_SQL))
    : [];
  console.log(
    switchReady
      ? `switch: ${switchStates.map((st) => `${st.source}/${st.field}=${st.streak}${st.on ? " ON" : ""}`).join("  ")}`
      : "migration 0023 not applied to this database — every source stays proposal-only.",
  );

  // ── 4: link-health pass over every active venue with a stored url ──
  // AND category != 'blessing_box': boxes produce no proposals of any kind
  // from this pipeline (same reasoning as excludeBlessingBoxes above) —
  // link_health is a separate proposal source, so it needs its own guard.
  const urlRows = onlyCareAndShare ? [] : d1Query<UrlRow>(
    dbMode,
    "SELECT id, url FROM venues WHERE status IN ('draft','published') AND category != 'blessing_box' AND url IS NOT NULL AND url != ''",
  );
  console.log(`\nlink_health: checking ${urlRows.length} url(s)...`);
  const checkedAt = new Date().toISOString();
  let deadCount = 0;
  for (let i = 0; i < urlRows.length; i++) {
    const { id, url } = urlRows[i];
    if (i > 0) await new Promise((r) => setTimeout(r, LINK_HEALTH_DELAY_MS));
    const outcome = await checkUrl(url);
    if (outcome.classification === "dead") {
      deadCount++;
      console.log(`  DEAD (${outcome.httpStatus}): ${id} -> ${url}`);
      allProposals.push(buildLinkHealthProposal(id, url, outcome.httpStatus, checkedAt, runId));
    }
  }
  console.log(`link_health: ${deadCount} dead link(s) found out of ${urlRows.length} checked`);

  // Rejection memory also applies to link_health proposals.
  allProposals = allProposals.filter((p) => !rejectedKeys.has(rejectionKey(p.source, p.targetVenueId, p.diffHash)));

  // ── 5: per-run cap ──
  console.log(`\nTotal proposals this run: ${allProposals.length} (cap ${PER_RUN_PROPOSAL_CAP})`);
  if (exceedsPerRunCap(allProposals.length)) {
    console.error(
      `FATAL: refresh_ingest_capped — ${allProposals.length} proposals exceeds the per-run cap of ${PER_RUN_PROPOSAL_CAP}. ` +
        `Aborting: NOTHING was written to change_proposals.`,
    );
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    const counts: Record<string, number> = {};
    for (const p of allProposals) {
      const k = `${p.source}/${p.changeType}/${p.proposedDiff.fields_changed.filter((f) => f !== "last_verified").join("+") || "still-listed"}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    console.log(`\nDRY RUN — would write ${allProposals.length} proposal(s) + ${aliasStatements.length} alias(es):`);
    for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${n}  ${k}`);
    for (const p of allProposals.filter((x) => x.source === CAS_SOURCE && x.proposedDiff.fields_changed.length > 1)) {
      console.log(`  ${p.changeType} ${p.targetVenueId}: ${JSON.stringify({ before: p.proposedDiff.before, after: p.proposedDiff.after })}`);
    }
    console.log("Nothing written.");
    if (anySourceAborted) process.exitCode = 1;
    return;
  }

  // ── 5b: rename pairing + Jev triage (#543) — only AFTER every guard above
  // passed; a run that tripped one already returned or will fail below.
  // Never throws: no key or a Jev outage just leaves proposals untriaged.
  const session = createTriageSession({ apiKey: process.env.JEV_API_KEY, log: (m) => console.log(m) });
  const aiAutoApply = process.env.REFRESH_AI_AUTO_APPLY === "true";
  const triagePass = await runTriagePass({
    proposals: allProposals,
    // C&S rows overlap the plentiful ones (same venue, any source_type); dedupe by id.
    currentRows: [...new Map([...currentByType.plentiful, ...currentByType.osm, ...casCurrentRows].map((r) => [r.id, r])).values()],
    session,
    rejectedKeys,
    today,
    schemaReady,
  });
  allProposals = triagePass.proposals;
  const laneCounts: Record<string, number> = {};
  for (const t of triagePass.triage.values()) laneCounts[t.lane] = (laneCounts[t.lane] ?? 0) + 1;
  console.log(
    `\ntriage: ${session.available() ? "on" : `off (${session.stats.disabledReason})`}  ` +
      `renamePairs=${triagePass.renamePairs}  triaged=${triagePass.triage.size}  lanes=${JSON.stringify(laneCounts)}  ` +
      `jevCalls=${session.stats.calls} failures=${session.stats.failures} inputTokens=${session.stats.inputTokens} ` +
      `cost=$${(session.stats.inputTokens * USD_PER_INPUT_TOKEN).toFixed(6)}  aiAutoApply=${aiAutoApply}`,
  );

  if (allProposals.length === 0) {
    console.log("Nothing to write this run.");
  } else {
    // Auto-supersede (§6.10a): any still-pending proposal from an EARLIER
    // run for the same (source, target_venue_id) is superseded by this
    // run's fresher view — a machine-vs-machine event, not a human
    // rejection, hence 'superseded' not 'rejected'. A rename also supersedes
    // an older pending add for its new upstream id (extraSupersedeKeys).
    const freshKeys = new Set([
      ...allProposals.map((p) => pendingKey(p.source, p.targetVenueId)),
      ...triagePass.extraSupersedeKeys,
    ]);
    const toSupersede = pendingRows.filter((r) => freshKeys.has(pendingKey(r.source as RefreshSource, r.target_venue_id)));

    const statements: string[] = [];
    const now = new Date().toISOString();
    for (const row of toSupersede) {
      statements.push(
        `UPDATE change_proposals SET status = 'superseded', reviewed_at = ${sqlText(now)} WHERE id = ${row.id} AND status = 'pending';`,
      );
    }
    // Per-proposal write: a date-only osm/plentiful "still listed" result
    // records a fetch observation + an already-'approved' row (no venues
    // write — see this file's own header and scripts/refresh/proposalSql.ts);
    // every other proposal writes a plain pending row. buildProposalWriteStatements() is
    // the single place that decides which, so this loop can't drift from
    // the /admin/flags bulk-approve button's own isDateOnlyUpdateProposal
    // check.
    let autoAppliedCount = 0;
    for (const p of allProposals) {
      const built = buildProposalWriteStatements(p, now, sqlText, {
        triage: triagePass.triage.get(p),
        aiAutoApply,
        pins,
        observationsReady,
        switchStates,
      });
      if (built.autoApplied) autoAppliedCount++;
      statements.push(...built.statements);
    }

    statements.push(...aliasStatements);

    // mkdtempSync already creates tmpDir — a following mkdirSync(tmpDir) was
    // a redundant no-op (recursive:true tolerates an existing dir) removed
    // here, not a behavior change.
    const tmpDir = mkdtempSync(join(tmpdir(), "pfp-refresh-"));
    const sqlFile = join(tmpDir, "proposals.sql");
    writeFileSync(sqlFile, statements.join("\n") + "\n", "utf-8");

    console.log(
      `Writing ${allProposals.length - autoAppliedCount} proposal(s) for review + ` +
        `auto-recording ${autoAppliedCount} (still-listed fetches${aiAutoApply ? " + AI formatting fixes" : ""}) + ` +
        `superseding ${toSupersede.length} stale pending row(s)...`,
    );
    d1ApplyFile(dbMode, sqlFile);
    console.log("Done.");
  }

  if (anySourceAborted) {
    // Loud, per this pipeline's own hard requirement: a source-level abort
    // must never look like a quiet, successful, nothing-changed run.
    console.error("\nOne or more sources aborted this run — see ABORTED lines above. Failing the job.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
