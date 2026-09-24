/**
 * triage.ts — TypeSafe Jev triage + rename pairing for the refresh pipeline
 * (issue #543).
 *
 * WHY this exists: /admin/flags gets every non-date-only proposal a run
 * produces, with no way to tell "probably nothing changed" from "a human
 * must decide" from "these two rows are one renamed venue." Weekly runs
 * (#543) quadruple that queue. Jev is a DECISION api — typed yes/no and
 * choice questions answered with calibrated probabilities, no generated
 * text — so each proposal gets ONE batched call and a lane that is a
 * sorting/filtering aid at /admin/flags.
 *
 * Request/response shape verified against https://docs.typesafe.ai/api.md
 * (2026-09-24): `POST https://api.typesafe.ai/v1/systemone`, Bearer key,
 * body `{state, model, questions}`; noul answers carry `noul` (0-1), choice
 * answers carry `choice` + `probabilities` + `confidence`; the response's
 * top-level `model` is the versioned id that actually answered (stored, not
 * the request string). 429 = rate limit and 529 = overloaded, both
 * "retry after a short delay".
 *
 * Non-negotiables (issue #543):
 *   - Runs AFTER every deterministic guard (zero-record, abnormal-drop,
 *     destructive-clear, per-run cap) in refresh-ingest.ts. A run that trips
 *     one never reaches this module; a lane here can never undo a guard.
 *   - Jev only ever moves work toward a human. The one write it can unlock
 *     is the `auto_apply_candidate` lane, which also needs a deterministic
 *     shape match (computeAutoApplyEligibility) AND the REFRESH_AI_AUTO_APPLY
 *     flag, OFF by default — the issue's own order of work is "store triage,
 *     change no behaviour" first. See proposalSql.ts for the write itself.
 *   - Degrades, never fails the run: no key, a 5xx, a timeout or three
 *     failures in a row → the rest of the run is written untriaged.
 *   - Dates stay in code (docs' jaggedness page: weak at dates/maths):
 *     `last_verified` is never sent. Public venue fields only, never PII.
 *
 * Model pinned to `jev-1.13.0`, not `jev-latest` — the alias moves under
 * you and would shift the probabilities the thresholds below were set on.
 *
 * Not asked (deliberate): the issue's "how risky is applying this
 * unattended?" score. No lane depends on it — removes and adds are always
 * human, and the only auto-apply shape is already pinned by a deterministic
 * formatting check — so it would be recorded and never read.
 */

import { isDateOnlyUpdateProposal, reviewableDiffFields } from "@/lib/adminProposals";
import type { Venue } from "@/types/venue";
import { rejectionKey, pendingKey, type CurrentVenueRow, type ProposalDraft } from "./diffEngine";
import { buildRenameProposal, findRenamePairCandidates, type RenamePairCandidate } from "./renamePairs";

export const JEV_MODEL = "jev-1.13.0";
export const QUESTION_SET_VERSION = "v1";
export const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
/** $0.042 per 1M input tokens, output free (docs.typesafe.ai/models.md, jev-1.13.0). */
export const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

/** Mirrors the `change_proposals.triage_lane` CHECK constraint (migrations/0016). */
export type TriageLane = "likely_noise" | "needs_human" | "renamed_or_moved" | "auto_apply_candidate";

// ─── TypeSafe request/response shapes (docs.typesafe.ai/api.md) ─────────────

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true?: string; false?: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> };

export interface JevAnswer {
  type?: string;
  noul?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface JevResponse {
  model?: string;
  answers?: Record<string, JevAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

// ─── Session: one per run — owns the key, the breaker and the usage tally ───

export interface TriageSessionOptions {
  /** Absent/empty = triage off for the whole run; every proposal is written untriaged. */
  apiKey?: string;
  /** Injectable for tests — same convention as linkHealth.ts's checkUrl. */
  fetchImpl?: typeof fetch;
  model?: string;
  timeoutMs?: number;
  /** Delay before the single retry on 429/529. Tests pass 0. */
  retryDelayMs?: number;
  /** Consecutive failed calls before Jev is switched off for the rest of the run. */
  maxConsecutiveFailures?: number;
  log?: (message: string) => void;
}

export interface TriageSession {
  readonly model: string;
  /** false once the key is missing or the breaker has tripped. */
  available(): boolean;
  /** One batched call. Returns null on any failure — callers treat null as "untriaged", never as an error. */
  ask(state: unknown, questions: Record<string, JevQuestion>): Promise<JevResponse | null>;
  readonly stats: { calls: number; failures: number; inputTokens: number; disabledReason: string | null };
}

const RETRYABLE_STATUSES = new Set([429, 529]);

export function createTriageSession(options: TriageSessionOptions): TriageSession {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? JEV_MODEL;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const retryDelayMs = options.retryDelayMs ?? 1_500;
  const maxFailures = options.maxConsecutiveFailures ?? 3;
  const log = options.log ?? (() => {});
  const stats = {
    calls: 0,
    failures: 0,
    inputTokens: 0,
    disabledReason: options.apiKey ? null : "no JEV_API_KEY set",
  } as TriageSession["stats"];
  let consecutiveFailures = 0;

  async function post(body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(TYPESAFE_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    model,
    stats,
    available: () => stats.disabledReason === null,
    async ask(state, questions) {
      if (stats.disabledReason !== null) return null;
      stats.calls++;
      const body = JSON.stringify({ state, model, questions });
      try {
        let res = await post(body);
        if (RETRYABLE_STATUSES.has(res.status)) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          res = await post(body);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as JevResponse;
        stats.inputTokens += json.usage?.input_tokens ?? 0;
        consecutiveFailures = 0;
        return json;
      } catch (err) {
        stats.failures++;
        consecutiveFailures++;
        // Never log the request body or headers — the key rides in them.
        log(`  jev: call failed (${err instanceof Error ? err.message : "unknown error"})`);
        if (consecutiveFailures >= maxFailures) {
          stats.disabledReason = `${consecutiveFailures} consecutive failures`;
          log(`  jev: switched off for the rest of this run (${stats.disabledReason}) — remaining proposals are written untriaged`);
        }
        return null;
      }
    },
  };
}

// ─── Question wording — exact phrasing matters for calibration (docs: "wording changes results a lot") ─

const NOISE_QUESTION_ID = "real_change";
const NOISE_QUESTION: JevQuestion = {
  type: "noul",
  instructions:
    "Compare `before` and `after` for this public food-assistance venue's changed field(s), listed in `fields_changed`. " +
    "Is this a genuine real-world change (the actual phone number, hours, address, name or website changed), rather than " +
    "scraper noise, a formatting difference, or a data artifact that doesn't reflect anything actually changing?",
};

const REMOVE_QUESTION_ID = "remove_reason";
const REMOVE_QUESTION: JevQuestion = {
  type: "choice",
  instructions:
    "A source that previously listed this public food-assistance venue (given in `before`) no longer lists it in " +
    "today's scrape. What most likely explains this?",
  criteria: {
    gone: "The venue has actually closed or stopped operating.",
    temporarily_missing: "The venue is still open, but this scrape missed it — a scrape gap, site hiccup, or a temporary listing removal.",
    renamed_or_moved: "The venue is still operating but now appears under a different name or at a different address in the source.",
    unclear: "There isn't enough information here to tell which of the above is true.",
  },
};

const RENAME_QUESTION_ID = "same_place";
const RENAME_QUESTION: JevQuestion = {
  type: "noul",
  instructions:
    "`before` describes a public food-assistance venue a source stopped listing. `after` describes a new venue the " +
    "same source started listing, at a similar location or with a matching phone number. Are `before` and `after` " +
    "the SAME real-world place, just listed under a different name, address text, or details — not two different places?",
};

// ─── State builders — public venue fields only, `last_verified` always stripped ─

/** Public venue fields a `state` may carry. Never last_verified (dates stay in code), never admin-only columns. */
const STATE_FIELDS: ReadonlyArray<keyof Venue> = ["name", "category", "lat", "lng", "address", "phone", "url", "hours_weekly", "operator"];

function pickStateFields(record: object | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const out: Record<string, unknown> = {};
  for (const field of STATE_FIELDS) {
    if (field in record) out[field] = (record as Record<string, unknown>)[field] ?? null;
  }
  return out;
}

// ─── Result — what gets stored in change_proposals.triage_* ────────────────

export interface TriageResult {
  lane: TriageLane;
  /** Versioned model that answered; null when the lane came from a rule with no Jev call (an add). */
  model: string | null;
  questionSet: string;
  /** Raw Jev answers keyed by question id — "every AI decision is recorded with its question, its probability and its lane" (#543). */
  answers: Record<string, JevAnswer>;
  /** Rename pairs only: the upstream id the add side carried. */
  pairedWith?: string;
}

/** JSON written to change_proposals.triage_json. */
export function serializeTriageResult(result: TriageResult): string {
  return JSON.stringify({
    question_set: result.questionSet,
    method: result.model ? "jev" : "rule",
    answers: result.answers,
    ...(result.pairedWith ? { paired_with: result.pairedWith } : {}),
  });
}

// ─── Deterministic auto-apply shape (the issue's "reformatted phone, url scheme change") ─

function normalizedPhone(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const digits = value.replace(/\D/g, "");
  // Tolerate a leading US country code ("+1 719…" vs "719…") — same number.
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/** Same host+path+query, tolerating an http→https upgrade, a `www.` prefix and a trailing slash. */
function normalizedUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const u = new URL(value);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return null; // unparseable → never "the same", never auto-applied
  }
}

/**
 * True only for an `update` whose SOLE reviewable change is `phone` or `url`
 * AND whose before/after normalise to the same value — a formatting change,
 * not a real one. The deterministic half of the auto-apply gate; values
 * that differ once normalised are a real change and stay human-reviewed
 * whatever Jev says. Never link_health (a dead-link finding clears the url).
 */
export function computeAutoApplyEligibility(proposal: ProposalDraft): boolean {
  if (proposal.changeType !== "update" || proposal.source === "link_health") return false;
  if (proposal.proposedDiff.meta?.rename) return false;
  const fields = reviewableDiffFields(proposal.proposedDiff);
  if (fields.length !== 1) return false;
  const field = fields[0];
  if (field !== "phone" && field !== "url") return false;
  const before = (proposal.proposedDiff.before ?? {}) as Record<string, unknown>;
  const after = (proposal.proposedDiff.after ?? {}) as Record<string, unknown>;
  const normalize = field === "phone" ? normalizedPhone : normalizedUrl;
  const b = normalize(before[field]);
  const a = normalize(after[field]);
  return b !== null && b === a;
}

// ─── Lane thresholds — Jev can only move a row toward a human ──────────────

const LIKELY_NOISE_BELOW = 0.15; // real_change below this = Jev reads it as noise (a sort aid only)
const AUTO_APPLY_NOISE_BELOW = 0.05; // stricter: the only lane that can ever write
const RENAME_CONFIRM_ABOVE = 0.7; // same_place above this = confirmed rename pair

export function classifyUpdateLane(proposal: ProposalDraft, realChange: JevAnswer | undefined): TriageLane {
  const p = realChange?.noul;
  if (typeof p !== "number") return "needs_human";
  if (p < AUTO_APPLY_NOISE_BELOW && computeAutoApplyEligibility(proposal)) return "auto_apply_candidate";
  if (p < LIKELY_NOISE_BELOW) return "likely_noise";
  return "needs_human";
}

export function isRenameConfirmed(answer: JevAnswer | undefined): boolean {
  return typeof answer?.noul === "number" && answer.noul > RENAME_CONFIRM_ABOVE;
}

// ─── Per-proposal triage ───────────────────────────────────────────────────

/**
 * One proposal that is not part of a rename pair. Returns null (= write it
 * untriaged) when Jev is off or the call failed.
 *   - add: no Jev call — the issue's lane design always queues a new venue
 *     for a human, so a call could not change the outcome. Lane needs_human.
 *   - remove: `remove_reason` choice, sent the venue's FULL current row
 *     (a remove proposal's own `before` is only {id, name}). Always
 *     needs_human — archiving is destructive; the verdict is shown, not acted on.
 *   - update: `real_change` noul → classifyUpdateLane.
 */
export async function triageProposal(
  proposal: ProposalDraft,
  session: TriageSession,
  currentRow?: CurrentVenueRow,
): Promise<TriageResult | null> {
  if (!session.available()) return null;
  if (proposal.changeType === "add") {
    return { lane: "needs_human", model: null, questionSet: QUESTION_SET_VERSION, answers: {} };
  }
  if (proposal.changeType === "remove") {
    const state = { source: proposal.source, before: pickStateFields(currentRow ?? proposal.proposedDiff.before) };
    const resp = await session.ask(state, { [REMOVE_QUESTION_ID]: REMOVE_QUESTION });
    if (!resp) return null;
    return { lane: "needs_human", model: resp.model ?? session.model, questionSet: QUESTION_SET_VERSION, answers: resp.answers ?? {} };
  }
  const state = {
    source: proposal.source,
    fields_changed: reviewableDiffFields(proposal.proposedDiff),
    before: pickStateFields(proposal.proposedDiff.before),
    after: pickStateFields(proposal.proposedDiff.after),
  };
  const resp = await session.ask(state, { [NOISE_QUESTION_ID]: NOISE_QUESTION });
  if (!resp) return null;
  const answers = resp.answers ?? {};
  return {
    lane: classifyUpdateLane(proposal, answers[NOISE_QUESTION_ID]),
    model: resp.model ?? session.model,
    questionSet: QUESTION_SET_VERSION,
    answers,
  };
}

/**
 * Asks Jev whether a candidate remove+add pair is one place. Returns
 * `{confirmed: null}` when Jev is off or the call failed — the caller then
 * falls back to the plain distance/phone heuristic.
 */
export async function confirmRenamePair(
  candidate: RenamePairCandidate,
  session: TriageSession,
): Promise<{ confirmed: boolean | null; result: TriageResult | null }> {
  if (!session.available()) return { confirmed: null, result: null };
  const state = {
    source: candidate.removeProposal.source,
    before: pickStateFields(candidate.removedRow),
    after: pickStateFields(candidate.addProposal.proposedDiff.after),
  };
  const resp = await session.ask(state, { [RENAME_QUESTION_ID]: RENAME_QUESTION });
  if (!resp) return { confirmed: null, result: null };
  const answers = resp.answers ?? {};
  const confirmed = isRenameConfirmed(answers[RENAME_QUESTION_ID]);
  return {
    confirmed,
    result: {
      lane: confirmed ? "renamed_or_moved" : "needs_human",
      model: resp.model ?? session.model,
      questionSet: QUESTION_SET_VERSION,
      answers,
      pairedWith: candidate.addProposal.targetVenueId,
    },
  };
}

// ─── The whole pass, as refresh-ingest.ts runs it ──────────────────────────

/** Runs `fn` over `items` with at most `limit` in flight — keeps a ~100-proposal run to seconds without bursting Jev's rate limit. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface TriagePassInput {
  proposals: ProposalDraft[];
  /** Every current row the diff ran against, all sources — removes and pairs read the full row from here. */
  currentRows: CurrentVenueRow[];
  session: TriageSession;
  rejectedKeys: ReadonlySet<string>;
  today: string;
  /** false when migration 0016 isn't on this database — no pairing (approving one needs venue_id_aliases), no triage columns. */
  schemaReady: boolean;
  concurrency?: number;
}

export interface TriagePassOutput {
  /** Final write set: each paired remove+add replaced by ONE rename proposal. */
  proposals: ProposalDraft[];
  /** Triage per proposal (by object identity); absent = write untriaged. */
  triage: Map<ProposalDraft, TriageResult>;
  renamePairs: number;
  /** Extra (source, target) keys whose older pending rows this run supersedes — a paired add's upstream id. */
  extraSupersedeKeys: string[];
}

/**
 * Pairing then triage, over proposals that already passed every guard.
 * Date-only and link_health proposals pass straight through untouched.
 * A candidate pair becomes one rename proposal when Jev confirms it, or —
 * when Jev is off or its call failed — on the plain distance/phone match
 * alone (a human still approves it). Jev answering "not the same place"
 * leaves the remove and add separate. A rename a human already rejected
 * is never re-paired (rejection memory, same key shape as diffEngine).
 */
export async function runTriagePass(input: TriagePassInput): Promise<TriagePassOutput> {
  const { session, schemaReady, rejectedKeys, today } = input;
  const concurrency = input.concurrency ?? 5;
  const triage = new Map<ProposalDraft, TriageResult>();
  if (!schemaReady) return { proposals: input.proposals, triage, renamePairs: 0, extraSupersedeKeys: [] };

  const currentById = new Map(input.currentRows.map((r) => [r.id, r]));
  const skip = (p: ProposalDraft) =>
    p.source === "link_health" || isDateOnlyUpdateProposal({ change_type: p.changeType, source: p.source }, p.proposedDiff);

  const candidates = findRenamePairCandidates(input.proposals.filter((p) => !skip(p)), input.currentRows).filter((c) => {
    const rename = buildRenameProposal(c, today);
    return !rejectedKeys.has(rejectionKey(rename.source, rename.targetVenueId, rename.diffHash));
  });
  const verdicts = await mapWithConcurrency(candidates, concurrency, (c) => confirmRenamePair(c, session));

  const replaced = new Map<ProposalDraft, ProposalDraft | null>(); // remove → rename proposal, add → null (dropped)
  const extraSupersedeKeys: string[] = [];
  candidates.forEach((c, i) => {
    const { confirmed, result } = verdicts[i];
    if (confirmed === false) return; // Jev says two different places — keep remove + add separate
    const rename = buildRenameProposal(c, today);
    replaced.set(c.removeProposal, rename);
    replaced.set(c.addProposal, null);
    extraSupersedeKeys.push(pendingKey(c.addProposal.source, c.addProposal.targetVenueId));
    if (result) triage.set(rename, result);
  });

  const out: ProposalDraft[] = [];
  for (const p of input.proposals) {
    if (!replaced.has(p)) out.push(p);
    else if (replaced.get(p)) out.push(replaced.get(p)!);
  }

  const toTriage = out.filter((p) => !skip(p) && !triage.has(p) && !p.proposedDiff.meta?.rename);
  const results = await mapWithConcurrency(toTriage, concurrency, (p) =>
    triageProposal(p, session, p.changeType === "remove" ? currentById.get(p.targetVenueId) : undefined),
  );
  toTriage.forEach((p, i) => {
    if (results[i]) triage.set(p, results[i]!);
  });

  return { proposals: out, triage, renamePairs: replaced.size / 2, extraSupersedeKeys };
}

// ─── LLM text-rewrite hook (issue #543 step 4) — OFF, no producer yet ─────

export interface TextRewriteRequest {
  field: string;
  value: string;
  context: string;
}

/**
 * Hook for the issue's "LLM pass only where text must be written" (Jev
 * generates nothing). Deliberately not wired to a model: nothing this
 * pipeline produces today needs text written — scrape-plentiful.py drops an
 * unparseable hours string to null before it reaches a proposal (and
 * diffEngine's destructive-clear guard keeps that from erasing real hours),
 * and a rename proposal's own before/after already describes itself. A
 * future producer swaps `noopTextRewriter` for a Claude-backed one whose
 * output lands as a proposal, never a direct write.
 */
export type TextRewriter = (request: TextRewriteRequest) => Promise<string | null>;

export const noopTextRewriter: TextRewriter = async () => null;
