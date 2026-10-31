/**
 * refreshAlerts.ts — two daily checks for the automated venue-refresh
 * pipeline's silent-failure modes: proposals nobody has reviewed (#238)
 * and a source that has quietly stopped producing successful runs (#234).
 * Rides the same 5-min prod-only heartbeat cron custom-worker.ts's
 * scheduled() already runs (the Healthchecks.io ping) — no new cron
 * trigger, gated to one of the 288 daily ticks (shouldRunRefreshAlertsCheck)
 * at a UTC slot distinct from PR #616's own once-a-day gate (that PR's
 * src/lib/emailRetention.ts, 09:00 UTC): two independent stateless gates
 * rather than one shared "did something already run this tick" flag, so
 * each job's own header stays the single source of truth for its own
 * schedule. Staging never runs either — env.staging.triggers.crons is `[]`
 * (wrangler.jsonc), so scheduled() itself is never invoked there.
 *
 * WHY no new migration/table for staleness: every successful, non-aborted
 * refresh run for a source writes at least one change_proposals row for
 * that source — an unchanged, still-present venue still gets a pure
 * "still listed" proposal every run (scripts/refresh/diffEngine.ts's
 * `else if (current.last_verified !== today)` branch), written as an
 * already-'approved' row (scripts/refresh/proposalSql.ts; since the Venue
 * Data Rebuild step 1 it no longer bumps venues.last_verified, but the row
 * is still written for exactly this check) — so MAX(created_at) per source IS
 * "when this source last completed a run that wrote anything," and a
 * zero-record or abnormal-drop abort (diffEngine.ts's own guardrails)
 * writes NOTHING for that source, which is exactly the silence this alert
 * needs to catch. change_proposals rows are never deleted, so this MAX
 * always reflects the true most-recent successful run, not just what's
 * happened since some cutoff.
 *
 * ponytail: the ceiling this proxy has is a source with literally zero
 * active `venues` rows left (activeCount === 0 but incoming still > 0) —
 * every per-venue branch in diffSource is skipped, so a run could complete
 * with zero proposals for that source without aborting. Not a real
 * scenario today (plentiful/osm both hold live rows). Upgrade path if it
 * ever becomes one: a dedicated `refresh_runs` completion table written by
 * scripts/refresh-ingest.ts at the end of a successful run.
 *
 * Imports by relative path: under OpenNext this file was compiled by
 * wrangler's own bundler, which didn't resolve tsconfig `@/` aliases. Under
 * vinext, vite builds custom-worker.ts and resolves them (emailSend.ts,
 * imported below, uses them), so this is now house style, not a constraint.
 *
 * WHY `resendApiKey` is passed in rather than read from
 * `process.env.RESEND_API_KEY` (the convention every OTHER Resend send in
 * this app uses, e.g. src/lib/boxAdopters.ts's
 * sendAdopterConfirmedAdminEmail): those all run inside a Next.js request.
 * This code dates from OpenNext, which populated `process.env` only for the
 * duration of a request, so inside scheduled() it read undefined. (Under
 * vinext, workerd fills `process.env` from the bindings everywhere —
 * `nodejs_compat` with a compatibility date after 2025-04-01 — but the
 * binding stays the one source scheduled() is handed directly.)
 * The raw Workers binding (`env.RESEND_API_KEY`, worker-configuration.d.ts)
 * is always populated regardless — the same reasoning custom-worker.ts's
 * existing `env.HC_PING_URL` read already established for this exact
 * handler.
 */

import { sendResendEmail } from "./emailSend";

export const PENDING_AGE_ALERT_DAYS = 14;
export const STALENESS_ALERT_DAYS = 40;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Distinct tick from #616's 09:00 UTC email-retention slot — see file
// header. 09:30 UTC = ~3:30am Mountain, same low-traffic reasoning that
// PR's own RETENTION_RUN_HOUR_UTC comment gives.
const ALERT_RUN_HOUR_UTC = 9;
const ALERT_RUN_MINUTE_UTC = 30;

/** True for exactly one of the 288 daily 5-minute cron ticks. */
export function shouldRunRefreshAlertsCheck(scheduledTimeMs: number): boolean {
  const d = new Date(scheduledTimeMs);
  return d.getUTCHours() === ALERT_RUN_HOUR_UTC && d.getUTCMinutes() === ALERT_RUN_MINUTE_UTC;
}

// ─── Pending-age (#238) ─────────────────────────────────────────────────────

/** Exported so refreshAlerts.sql.test.ts can run this exact string against real SQLite — same convention as src/lib/adminBoxes.ts's SELECT_BOX_VENUES_SQL. */
export const PENDING_AGE_SQL =
  "SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM change_proposals WHERE status = 'pending' AND created_at < ?";

export interface PendingAgeCheck {
  shouldAlert: boolean;
  count: number;
  oldestCreatedAt: string | null;
  oldestAgeDays: number | null;
}

export async function checkPendingAge(db: D1Database, now: Date = new Date()): Promise<PendingAgeCheck> {
  const cutoff = new Date(now.getTime() - PENDING_AGE_ALERT_DAYS * MS_PER_DAY).toISOString();
  const row = await db.prepare(PENDING_AGE_SQL).bind(cutoff).first<{ n: number; oldest: string | null }>();
  const count = row?.n ?? 0;
  const oldest = row?.oldest ?? null;
  const oldestAgeDays = oldest ? Math.floor((now.getTime() - new Date(oldest).getTime()) / MS_PER_DAY) : null;
  return { shouldAlert: count > 0, count, oldestCreatedAt: oldest, oldestAgeDays };
}

// ─── Per-source staleness (#234) ────────────────────────────────────────────

const REFRESH_ALERT_SOURCES = ["plentiful", "osm", "care_and_share", "website"] as const;
/**
 * Sources that alert even when they have NEVER written a row. care_and_share
 * (Venue Data Rebuild step 2) is left out on purpose: it starts writing only
 * once its reader reaches production, and a never-run alert would email
 * every day until then. A first run that fails is already loud (the refresh
 * job exits non-zero when a source aborts); once it has run once, the normal
 * 40-day rule applies to it like the others. `website` (step 3, the server's
 * weekly timer, ops/systemd/) is the same: every page it reads writes a row.
 */
const NEVER_RUN_ALERT_SOURCES: ReadonlySet<string> = new Set(["plentiful", "osm"]);
export type RefreshAlertSource = (typeof REFRESH_ALERT_SOURCES)[number];

/** Hardcoded IN-list, not a bound placeholder loop — REFRESH_ALERT_SOURCES is a fixed, small, compile-time set (ponytail: one string beats a dynamic placeholder builder for two known values). */
export const SOURCE_STALENESS_SQL =
  "SELECT source, MAX(created_at) AS last FROM change_proposals WHERE source IN ('plentiful','osm','care_and_share','website') GROUP BY source";

export interface SourceStalenessCheck {
  source: RefreshAlertSource;
  shouldAlert: boolean;
  lastRunAt: string | null;
  daysSinceLastRun: number | null;
}

export async function checkSourceStaleness(db: D1Database, now: Date = new Date()): Promise<SourceStalenessCheck[]> {
  const result = await db.prepare(SOURCE_STALENESS_SQL).all<{ source: string; last: string | null }>();
  const lastBySource = new Map(result.results.map((r) => [r.source, r.last]));

  // A source outside NEVER_RUN_ALERT_SOURCES is only checked once it has a row.
  const tracked = REFRESH_ALERT_SOURCES.filter((s) => NEVER_RUN_ALERT_SOURCES.has(s) || lastBySource.has(s));
  return tracked.map((source) => {
    const last = lastBySource.get(source) ?? null;
    const daysSinceLastRun = last ? Math.floor((now.getTime() - new Date(last).getTime()) / MS_PER_DAY) : null;
    // `last === null` (a source with NO change_proposals row at all, ever —
    // e.g. the pipeline never successfully ran for it) alerts immediately,
    // same as a source that HAS run before but has since gone stale.
    const shouldAlert = last === null || (daysSinceLastRun !== null && daysSinceLastRun > STALENESS_ALERT_DAYS);
    return { source, shouldAlert, lastRunAt: last, daysSinceLastRun };
  });
}

// ─── Email ──────────────────────────────────────────────────────────────────
// Plain internal text mail to the admin-notice address, through the shared
// sender with the binding's key passed in (see this file's header).

const ALERT_TO = "issues@pueblofoodmap.com";

function sendAlertEmail(resendApiKey: string, subject: string, lines: string[]): Promise<void> {
  return sendResendEmail({ to: ALERT_TO, subject, text: lines.join("\n") }, resendApiKey);
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export interface RefreshAlertsResult {
  pendingAgeAlertSent: boolean;
  staleSourcesAlerted: RefreshAlertSource[];
}

/**
 * Runs both checks and sends up to 1 + REFRESH_ALERT_SOURCES.length emails —
 * one per condition that actually tripped, never a combined "everything's
 * fine" mail. Called at most once a day (shouldRunRefreshAlertsCheck's own
 * gate), so this also bounds each condition to at most one email per day,
 * satisfying the alert's own "no more than once a day per condition"
 * requirement with no extra state to track.
 */
export async function runRefreshAlertsCheck(
  db: D1Database,
  resendApiKey: string | undefined,
  now: Date = new Date(),
): Promise<RefreshAlertsResult> {
  const pendingAge = await checkPendingAge(db, now);
  const staleness = await checkSourceStaleness(db, now);
  const staleSources = staleness.filter((s) => s.shouldAlert);

  if (!pendingAge.shouldAlert && staleSources.length === 0) {
    return { pendingAgeAlertSent: false, staleSourcesAlerted: [] };
  }

  // A missing secret must never throw silently out of a cron (custom-
  // worker.ts's own convention, see env.HC_PING_URL), but it also must not
  // be swallowed as "nothing to report" when something genuinely tripped —
  // that would be the one failure mode this whole feature exists to avoid.
  // The caller (custom-worker.ts) catches this and logs it via
  // logRefreshAlertsFailure.
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured — cannot send refresh alert(s)");
  }

  if (pendingAge.shouldAlert) {
    await sendAlertEmail(
      resendApiKey,
      `[PFM] ${pendingAge.count} data-refresh proposal(s) pending review over ${PENDING_AGE_ALERT_DAYS} days`,
      [
        `${pendingAge.count} change_proposals row(s) have sat in "pending" for more than ${PENDING_AGE_ALERT_DAYS} days.`,
        `Oldest: ${pendingAge.oldestCreatedAt} (${pendingAge.oldestAgeDays} day(s) old).`,
        "",
        // #674: /admin/flags folded into Places — this link now lands on
        // its "To review" filter instead of the retired queue.
        "Review at https://pueblofoodmap.com/admin/places?show=review",
      ],
    );
  }

  // Sequential, not Promise.all/allSettled — deliberate, not an oversight
  // (CI reviewer nit, PR #624): if an earlier send succeeds and a later one
  // throws (a transient Resend 500), this whole call rejects and the
  // caller (custom-worker.ts) only logs one failure, with no record that
  // some emails already went out. Bounded by the once-a-day gate either
  // way — worst case is a duplicate pending-age email on the next tick, or
  // a stale-source alert delayed up to 24h — so low enough impact that
  // per-email failure isolation (email-retention's own runOne() pattern,
  // src/lib/emailRetention.ts) isn't worth the extra complexity here.
  for (const s of staleSources) {
    await sendAlertEmail(
      resendApiKey,
      `[PFM] ${s.source} venue refresh hasn't completed successfully in over ${STALENESS_ALERT_DAYS} days`,
      [
        s.lastRunAt
          ? `The last successful ${s.source} refresh completed ${s.lastRunAt} (${s.daysSinceLastRun} day(s) ago).`
          : `No successful ${s.source} refresh run has ever been recorded.`,
        `The "Venue Data Refresh" cron runs weekly — this source should be completing well inside the ${STALENESS_ALERT_DAYS}-day threshold.`,
        "",
        "Check the workflow: https://github.com/kr8vka0z/pueblo-food-map/actions/workflows/refresh-proposals.yml",
      ],
    );
  }

  return { pendingAgeAlertSent: pendingAge.shouldAlert, staleSourcesAlerted: staleSources.map((s) => s.source) };
}
