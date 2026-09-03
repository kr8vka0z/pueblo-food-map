/**
 * refresh-ingest.ts — orchestrates the automated venue-refresh pipeline
 * (fixes: venue data hadn't been re-verified since 2026-05 because the
 * scrapers wrote committed .ts files nothing read — see README.md "Data
 * sources" and .github/workflows/refresh-proposals.yml's header for the
 * end-to-end picture). Run by that workflow (monthly cron + manual
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
 *      NOTHING. Otherwise writes every surviving proposal as one batch of
 *      SQL statements — `wrangler d1 execute --local --file` locally
 *      (Miniflare's real db.batch()), or `wrangler d1 execute --remote
 *      --command` in production (D1's REST /query endpoint, itself
 *      documented as executing multiple `;`-joined statements "as a
 *      batch" — see d1ApplyFile's own WHY comment for the full trace) —
 *      after superseding any earlier-run pending proposal for the same
 *      (source, target_venue_id).
 *
 * This script NEVER writes to `venues` — only `change_proposals`. That's a
 * structural guarantee, not a runtime check: no function in this file or
 * scripts/refresh/*.ts constructs an UPDATE/INSERT/DELETE against `venues`
 * anywhere. A human approving a proposal (a separate, later slice) is the
 * only path that ever mutates `venues` from this pipeline's output.
 *
 * WHY shell out to `wrangler d1 execute` instead of a D1Database binding:
 * this runs as a plain Node process (GitHub Actions runner or a local
 * terminal), not inside a Cloudflare Worker — there's no binding to inject.
 * Reuses the exact CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID credentials
 * deploy-prod.yml already uses for `wrangler deploy` (AGENTS.md's
 * established secret names) — no new secret introduced by this pipeline.
 *
 * Usage:
 *   npx tsx scripts/refresh-ingest.ts --db-mode local    # local D1 (npm run preview's Miniflare SQLite)
 *   npx tsx scripts/refresh-ingest.ts --db-mode remote   # PRODUCTION D1 — only ever run by the real workflow
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Venue } from "@/types/venue";
import {
  diffSource,
  exceedsPerRunCap,
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

const REPO_ROOT = join(__dirname, "..");
const DATABASE_NAME = "pueblo-food-map-admin"; // wrangler.jsonc d1_databases[0].database_name
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

type DbMode = "local" | "remote";

function parseDbMode(argv: string[]): DbMode {
  const idx = argv.indexOf("--db-mode");
  const value = idx >= 0 ? argv[idx + 1] : undefined;
  if (value !== "local" && value !== "remote") {
    console.error('FATAL: --db-mode <local|remote> is required (e.g. "npx tsx scripts/refresh-ingest.ts --db-mode local").');
    process.exit(1);
  }
  return value;
}

// ─── wrangler d1 execute wrapper ────────────────────────────────────────────

interface WranglerD1Result<T> {
  results: T[];
  success: boolean;
}

/** Runs a read-only query via `wrangler d1 execute --json` and returns its rows. */
function d1Query<T>(dbMode: DbMode, sql: string): T[] {
  const args = [WRANGLER_BIN, "d1", "execute", DATABASE_NAME, `--${dbMode}`, "--json", "--command", sql];
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
 * unavailable to serve queries" while it runs. That's fine for a one-time
 * schema seed (scripts/seed-admin-db.ts) but this job runs monthly against
 * the SAME database that also holds Better Auth sessions, the auth
 * rate-limit table, and public_submissions — a brief outage here logs the
 * admin out and silently drops any public form submission landing in that
 * window (best-effort insert, see AGENTS.md "Public submissions queue").
 * `--command` instead takes the OTHER branch of that same `executeRemotely`
 * function: no `input.file`, so it posts straight to D1's REST `/query`
 * endpoint (`d1ApiPost(..., "query", { sql })`) — the identical live-query
 * mechanism `d1Query()` above already uses for every read in this file,
 * proven to not take anything offline. Cloudflare's own D1 API docs
 * confirm a `;`-joined multi-statement `sql` string here "will be executed
 * as a batch," and D1's batch semantics (per Cloudflare's docs) commit
 * sequentially and roll back the whole sequence on any one failure — the
 * same effective atomicity the file-header comment above already claimed,
 * just reached through the query path instead of the offline import path.
 */
function d1ApplyFile(dbMode: DbMode, filePath: string): void {
  if (dbMode === "remote") {
    const sql = readFileSync(filePath, "utf-8");
    execFileSync(process.execPath, [WRANGLER_BIN, "d1", "execute", DATABASE_NAME, "--remote", "--command", sql], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    return;
  }
  execFileSync(process.execPath, [WRANGLER_BIN, "d1", "execute", DATABASE_NAME, "--local", "--file", filePath], {
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

const CURRENT_ROW_COLUMNS =
  "id, name, category, lat, lng, address, hours_weekly, phone, url, operator, last_verified";

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
  const today = new Date().toISOString().slice(0, 10);
  // GitHub keeps run_id stable across a retried Action run (only
  // run_attempt increments) — spec §6.10d's idempotency key. Local runs get
  // a fresh id every invocation; there's no retry concept to dedupe against.
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;

  console.log(`=== Pueblo Food Map — automated refresh run ===`);
  console.log(`db-mode: ${dbMode}  run_id: ${runId}  today: ${today}`);
  if (dbMode === "remote") {
    console.log("!!! REMOTE MODE — this will write to PRODUCTION D1. !!!");
  }

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
  const plentifulIncoming = await scrapePlentiful();
  const osmIncoming = await scrapeOsm();
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

  let allProposals: ProposalDraft[] = [];
  let anySourceAborted = false;

  for (const source of ["plentiful", "osm"] as const) {
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

  // ── 4: link-health pass over every active venue with a stored url ──
  const urlRows = d1Query<UrlRow>(
    dbMode,
    "SELECT id, url FROM venues WHERE status IN ('draft','published') AND url IS NOT NULL AND url != ''",
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

  if (allProposals.length === 0) {
    console.log("Nothing to write this run.");
  } else {
    // Auto-supersede (§6.10a): any still-pending proposal from an EARLIER
    // run for the same (source, target_venue_id) is superseded by this
    // run's fresher view — a machine-vs-machine event, not a human
    // rejection, hence 'superseded' not 'rejected'.
    const freshKeys = new Set(allProposals.map((p) => pendingKey(p.source, p.targetVenueId)));
    const toSupersede = pendingRows.filter((r) => freshKeys.has(pendingKey(r.source as RefreshSource, r.target_venue_id)));

    const statements: string[] = [];
    const now = new Date().toISOString();
    for (const row of toSupersede) {
      statements.push(
        `UPDATE change_proposals SET status = 'superseded', reviewed_at = ${sqlText(now)} WHERE id = ${row.id} AND status = 'pending';`,
      );
    }
    for (const p of allProposals) {
      statements.push(
        "INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id) VALUES (" +
          [
            sqlText(p.source),
            sqlText(p.targetVenueId),
            sqlText(p.changeType),
            sqlText(JSON.stringify(p.proposedDiff)),
            sqlText(p.diffHash),
            sqlText(p.runId),
          ].join(", ") +
          ");",
      );
    }

    // mkdtempSync already creates tmpDir — a following mkdirSync(tmpDir) was
    // a redundant no-op (recursive:true tolerates an existing dir) removed
    // here, not a behavior change.
    const tmpDir = mkdtempSync(join(tmpdir(), "pfp-refresh-"));
    const sqlFile = join(tmpDir, "proposals.sql");
    writeFileSync(sqlFile, statements.join("\n") + "\n", "utf-8");

    console.log(`Writing ${allProposals.length} proposal(s) + superseding ${toSupersede.length} stale pending row(s)...`);
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
