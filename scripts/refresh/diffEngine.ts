/**
 * diffEngine.ts — pure diffing + guardrail logic for the automated venue-
 * refresh pipeline (fixes: venue data hadn't been re-verified since
 * 2026-05, because the scrapers wrote committed .ts files nothing read —
 * see README.md "Data sources" and docs/admin/cloudflare-native-admin-spec.md
 * §6 for the original design this implements a scoped slice of).
 *
 * WHY pure: this is the one piece of the refresh pipeline whose correctness
 * actually matters — a wrong diff either hides a real upstream change or
 * proposes a bogus one against a database backing a public map people use to
 * find food. Kept free of D1/child_process/network I/O so every rule (the
 * source-owned field allowlist, the sanity guardrail's 20%-with-floor-5
 * math, the per-run cap) is testable with plain fixtures — no live D1, no
 * live scrape, no GitHub Actions run required. scripts/refresh-ingest.ts is
 * the only caller and owns all the I/O (wrangler CLI, child_process,
 * network fetch) around these functions.
 *
 * This is a deliberately NARROWER slice than the full design doc
 * (docs/admin/cloudflare-native-admin-spec.md §6.10): auto-supersede (a) and
 * rejection memory (b) are implemented here because they're this job's own
 * write-time concern (don't leave stale duplicate proposals behind on every
 * run). The stale-apply guard (c) is NOT implemented — it only matters when
 * an approved proposal is actually applied to `venues`, which is slice 2
 * (the review/approval UI), not this ingestion job.
 */

import { createHash } from "node:crypto";
import type { Venue, WeeklyHours } from "@/types/venue";

export type RefreshSource = "osm" | "plentiful";
export type ProposalSource = RefreshSource | "link_health";
export type ChangeType = "add" | "update" | "remove";

/** The subset of a D1 `venues` row (migrations/0001_init_admin_schema.sql) this engine reads. */
export interface CurrentVenueRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  hours_weekly: string | null; // JSON string, matches D1 storage — not a parsed object
  phone: string | null;
  url: string | null;
  operator: string | null;
  last_verified: string;
}

/**
 * Source-owned field allowlist (spec §6.3's NB2 fix). Diffing compares ONLY
 * these fields per source — anything else is either not authored by that
 * source, or (OSM's `address`) is enrichment territory this pipeline
 * doesn't reproduce deterministically.
 *
 * `address` is deliberately EXCLUDED for `osm`: today's committed
 * `grocery-osm.ts` carries reverse-geocoded addresses for records OSM
 * itself has no `addr:*` tags for (a ONE-OFF script ran that enrichment by
 * hand, per ARCHITECTURE.md / the spec's own NB2 finding) — this pipeline
 * re-runs only `scripts/ingest-osm-grocery.py` as-is, which emits the raw
 * "Address not in OpenStreetMap" placeholder for those same records. Diffing
 * `address` for OSM would propose clobbering a real, enriched (possibly
 * hand-corrected) address back to that placeholder on every single run.
 * Plentiful's address is NOT enrichment — it's scraped directly off the
 * directory card — so it stays in Plentiful's allowlist.
 *
 * `operator` and `hours_weekly` are ALSO excluded for `osm`, found by
 * actually running this pipeline against a live re-scrape (not assumed from
 * reading the spec): `scripts/ingest-osm-grocery.py`, as reused unmodified,
 * never emits an `operator` field at all (OSM's `operator` tag is folded
 * into a free-text `notes` sentence instead — "Operated by X" — never a
 * dedicated field), and only ever dumps `opening_hours` into that same
 * `notes` text, never into structured `hours_weekly`. Both fields DO appear
 * populated in today's committed `grocery-osm.ts` — but only because a
 * one-off script (`scripts/scrub-osm-venues.ts`) parsed them out of `notes`
 * by hand, once, outside this repeatable pipeline (matches the exact
 * "address" enrichment gap the design doc's §6.3 NB2 fix already names —
 * this is the same gap, just two more fields it didn't call out). Diffing
 * either field against a re-run of the unmodified scraper would propose
 * WIPING every real value back to empty/null on every single run — this was
 * caught by running the local-D1 verification below, not by inspection.
 */
export const SOURCE_OWNED_FIELDS: Record<RefreshSource, ReadonlyArray<keyof Venue>> = {
  osm: ["name", "category", "lat", "lng", "phone", "url"],
  plentiful: ["name", "category", "lat", "lng", "address", "phone", "url", "hours_weekly"],
};

// ─── Guardrails ─────────────────────────────────────────────────────────────

const SANITY_GUARDRAIL_PERCENT = 0.2;
const SANITY_GUARDRAIL_FLOOR = 5;
/** Combined add+update+remove+link_health proposals a single run may write before it aborts entirely (spec §6.9). */
export const PER_RUN_PROPOSAL_CAP = 150;

export interface SanityCheckResult {
  /** true = this run's removal candidates look like an upstream failure, not a real mass-removal. */
  anomaly: boolean;
  removalCount: number;
  activeCount: number;
  /** The computed trip point — max(floor, ceil(20% of active)). "Reach or exceed" this trips the guardrail. */
  thresholdCount: number;
}

/**
 * Abnormal-drop guardrail. `activeCount` MUST already be scoped to
 * `status IN ('draft','published')` for the one `source_type` being
 * diffed — never `published`-only (undercounts, over-trips) and never
 * including `archived` (an archived row is already off the public map; it
 * shouldn't count toward "how much just vanished").
 *
 * Threshold = max(floor, ceil(20% of active)) — the floor RAISES the bar for
 * small sources, it does not lower it: a 10-row source trips at 5 removals
 * (50%), not at 2 (the raw 20% figure). ceil, not round or floor, so 38 *
 * 0.2 = 7.6 trips at 8, not 7 — matches the design doc's own worked example.
 */
export function checkSanityGuardrail(removalCount: number, activeCount: number): SanityCheckResult {
  const thresholdCount = Math.max(SANITY_GUARDRAIL_FLOOR, Math.ceil(activeCount * SANITY_GUARDRAIL_PERCENT));
  return { anomaly: removalCount >= thresholdCount, removalCount, activeCount, thresholdCount };
}

/** true = this run's total proposal count exceeds the cap and must write NOTHING. */
export function exceedsPerRunCap(totalProposals: number): boolean {
  return totalProposals > PER_RUN_PROPOSAL_CAP;
}

// ─── Proposal shape ─────────────────────────────────────────────────────────

/** Mirrors `change_proposals.proposed_diff`'s one shape for every source (schema comment, migrations/0001). */
export interface ProposedDiff {
  before: Partial<Venue> | null;
  after: Partial<Venue> | null;
  fields_changed: string[];
  meta?: Record<string, unknown>;
}

export interface ProposalDraft {
  source: ProposalSource;
  targetVenueId: string;
  changeType: ChangeType;
  proposedDiff: ProposedDiff;
  diffHash: string;
  runId: string;
}

/**
 * Stable hash of a proposal's real content — spec §4: "normalized {after,
 * fields_changed} content, computed identically every run." Powers both
 * auto-supersede's identity check and rejection memory (§6.10a/b). Field
 * order inside `after` doesn't matter (JSON.stringify's own key order does
 * — callers must build `after` with a consistent key order across runs,
 * which every builder below does by construction).
 */
export function computeDiffHash(after: Partial<Venue> | null, fieldsChanged: string[]): string {
  const normalized = JSON.stringify({ after, fields_changed: [...fieldsChanged].sort() });
  return createHash("sha256").update(normalized).digest("hex");
}

function buildProposal(
  source: ProposalSource,
  targetVenueId: string,
  changeType: ChangeType,
  before: Partial<Venue> | null,
  after: Partial<Venue> | null,
  fieldsChanged: string[],
  runId: string,
  meta?: Record<string, unknown>,
): ProposalDraft {
  const proposedDiff: ProposedDiff = { before, after, fields_changed: fieldsChanged, ...(meta ? { meta } : {}) };
  return {
    source,
    targetVenueId,
    changeType,
    proposedDiff,
    diffHash: computeDiffHash(after, fieldsChanged),
    runId,
  };
}

/** Rejection-memory / auto-supersede lookup key — (source, target, diff_hash) or (source, target) per spec §4's dedup index. */
export function rejectionKey(source: ProposalSource, targetVenueId: string, diffHash: string): string {
  return `${source}:${targetVenueId}:${diffHash}`;
}
export function pendingKey(source: ProposalSource, targetVenueId: string): string {
  return `${source}:${targetVenueId}`;
}

// ─── Field comparison ───────────────────────────────────────────────────────

/** Normalizes a WeeklyHours-shaped value (object OR its JSON-string D1 form) for equality comparison. */
function normalizeHours(value: string | WeeklyHours | undefined | null): string {
  if (value === null || value === undefined) return "";
  const parsed = typeof value === "string" ? (JSON.parse(value) as WeeklyHours) : value;
  const sortedDays = Object.keys(parsed).sort();
  const stable: Record<string, string[]> = {};
  for (const day of sortedDays) stable[day] = [...(parsed[day as keyof WeeklyHours] ?? [])];
  return JSON.stringify(stable);
}

function currentFieldValue(row: CurrentVenueRow, field: keyof Venue): unknown {
  if (field === "hours_weekly") return normalizeHours(row.hours_weekly);
  return (row as unknown as Record<string, unknown>)[field] ?? null;
}

function incomingFieldValue(venue: Venue, field: keyof Venue): unknown {
  if (field === "hours_weekly") return normalizeHours(venue.hours_weekly);
  return (venue as unknown as Record<string, unknown>)[field] ?? null;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a ?? "") === String(b ?? "");
}

// ─── Incoming-record validity (spec §6.9's schema-validation slice) ───────

/** Minimal shape guard — a record missing these is dropped from the run, never diffed or proposed. */
export function isValidIncomingRecord(v: Partial<Venue>): v is Venue {
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.category === "string" &&
    typeof v.lat === "number" &&
    Number.isFinite(v.lat) &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lng) &&
    typeof v.address === "string" &&
    v.address.length > 0
  );
}

// ─── The diff ───────────────────────────────────────────────────────────────

export interface DiffSourceParams {
  source: RefreshSource;
  /** `venues` rows for this source_type, `status IN ('draft','published')` — see checkSanityGuardrail's own note on scope. */
  currentRows: CurrentVenueRow[];
  /** Freshly scraped records, already run through isValidIncomingRecord by the caller. */
  incoming: Venue[];
  runId: string;
  /** Today's date (`YYYY-MM-DD`) — stamped as the new `last_verified` for every add/update/confirmed-unchanged proposal. */
  today: string;
  /** (source, target, diff_hash) keys of proposals a human has already explicitly rejected (§6.10b). */
  rejectedKeys?: ReadonlySet<string>;
  /** (source, target) keys of still-`pending` proposals from an EARLIER run — flipped to `superseded` by the caller, not written again identically here (§6.10a) is the caller's job; this just tells the caller which keys are being superseded. */
}

export interface DiffSourceResult {
  proposals: ProposalDraft[];
  removalCandidateIds: string[];
  activeCount: number;
  anomaly: boolean;
  /** true = this source's run wrote NOTHING (zero-record guard or the sanity guardrail tripped). */
  aborted: boolean;
  abortReason?: string;
}

/**
 * Diffs one source's freshly-scraped records against its current active D1
 * rows and returns the change_proposals this run would write.
 *
 * Guardrail behavior is stricter than the original design doc's: that doc
 * still writes anomaly-flagged removal proposals for a human to see (§6.4).
 * This job runs unattended on a monthly cron with no review UI live yet
 * (slice 2) — so here, tripping EITHER the zero-record guard or the sanity
 * guardrail means this source writes NOTHING at all, not "writes removals
 * flagged for extra scrutiny." A human isn't watching a queue yet; a
 * scraper glitch proposing 20%+ of a source's venues gone is safer held
 * entirely than half-written for nobody to catch.
 */
export function diffSource(params: DiffSourceParams): DiffSourceResult {
  const { source, currentRows, incoming, runId, today, rejectedKeys } = params;
  const activeCount = currentRows.length;

  if (incoming.length === 0) {
    return {
      proposals: [],
      removalCandidateIds: [],
      activeCount,
      anomaly: false,
      aborted: true,
      abortReason: `zero records scraped for source="${source}" — refusing to diff (would propose removing all ${activeCount} active rows)`,
    };
  }

  const currentById = new Map(currentRows.map((r) => [r.id, r]));
  const seenIds = new Set<string>();
  const proposals: ProposalDraft[] = [];

  const fields = SOURCE_OWNED_FIELDS[source];

  for (const inc of incoming) {
    if (seenIds.has(inc.id)) continue; // defensive dedupe — the scrapers already dedupe their own output
    seenIds.add(inc.id);
    const current = currentById.get(inc.id);

    if (!current) {
      const after: Partial<Venue> = { ...inc, last_verified: today };
      proposals.push(buildProposal(source, inc.id, "add", null, after, Object.keys(after), runId));
      continue;
    }

    const changedFields = fields.filter((f) => !valuesEqual(currentFieldValue(current, f), incomingFieldValue(inc, f)));

    if (changedFields.length > 0) {
      const before: Partial<Venue> = { last_verified: current.last_verified };
      const after: Partial<Venue> = { last_verified: today };
      for (const f of changedFields) {
        (before as Record<string, unknown>)[f] = currentFieldValue(current, f);
        (after as Record<string, unknown>)[f] = incomingFieldValue(inc, f);
      }
      proposals.push(buildProposal(source, inc.id, "update", before, after, [...changedFields, "last_verified"], runId));
    } else if (current.last_verified !== today) {
      // Confirmed present, source-owned fields unchanged — this run's only
      // job here is refreshing the freshness signal. NOT a direct D1 write:
      // like every other proposal, this still needs a human approve before
      // `venues.last_verified` actually moves (the pipeline's guardrail:
      // "proposes only," no exception for a field this trivial).
      proposals.push(
        buildProposal(
          source,
          inc.id,
          "update",
          { last_verified: current.last_verified },
          { last_verified: today },
          ["last_verified"],
          runId,
        ),
      );
    }
    // else: already verified today AND nothing else changed — genuinely
    // nothing to propose. Without this branch, running this pipeline twice
    // in one day (a manual dispatch alongside the scheduled run, say) would
    // write an identical last_verified-refresh proposal twice; a truly
    // no-op record must produce zero proposals, not a trivial one.
  }

  const removalCandidateIds = currentRows.filter((r) => !seenIds.has(r.id)).map((r) => r.id);

  const sanity = checkSanityGuardrail(removalCandidateIds.length, activeCount);
  if (sanity.anomaly) {
    return {
      proposals: [],
      removalCandidateIds,
      activeCount,
      anomaly: true,
      aborted: true,
      abortReason: `abnormal drop for source="${source}": ${removalCandidateIds.length}/${activeCount} active rows missing from this run's scrape (threshold ${sanity.thresholdCount})`,
    };
  }

  for (const id of removalCandidateIds) {
    const current = currentById.get(id)!;
    const before: Partial<Venue> = { id: current.id, name: current.name };
    proposals.push(buildProposal(source, id, "remove", before, null, [], runId));
  }

  const filtered = rejectedKeys
    ? proposals.filter((p) => !rejectedKeys.has(rejectionKey(p.source, p.targetVenueId, p.diffHash)))
    : proposals;

  return { proposals: filtered, removalCandidateIds, activeCount, anomaly: false, aborted: false };
}

// ─── Link health ────────────────────────────────────────────────────────────

/** Builds the change_proposals draft for one dead-link finding (spec §6.5). Never invents a replacement URL. */
export function buildLinkHealthProposal(
  targetVenueId: string,
  deadUrl: string,
  httpStatus: number,
  checkedAt: string,
  runId: string,
): ProposalDraft {
  return buildProposal(
    "link_health",
    targetVenueId,
    "update",
    { url: deadUrl },
    // `null`, not `undefined` — must survive JSON.stringify (both in the
    // diff_hash and in the SQL payload) as an explicit "clear this field"
    // instruction, matching spec §6.5's exact proposed_diff shape.
    { url: null as unknown as string },
    ["url"],
    runId,
    { http_status: httpStatus, checked_at: checkedAt },
  );
}
