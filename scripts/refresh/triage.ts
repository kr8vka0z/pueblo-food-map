/**
 * triage.ts — TypeSafe Jev triage for the refresh pipeline (issue #543).
 *
 * WHY this exists: the review queue at /admin/flags gets every non-date-only
 * proposal a run produces, with no way to tell "probably nothing changed"
 * apart from "a human must decide" apart from "these two rows are actually
 * one renamed venue." Jev is a DECISION api (typed yes/no + choice questions
 * with calibrated probabilities, no text generation — atlas-kb note
 * "2026-09-19-typesafe-jev-use-cases.md") — one batched call per proposal
 * (or per rename PAIR, see renamePairs.ts) carrying the before/after record
 * and source, classifying it into a lane. Ported request/response shape from
 * the already-live client (`atlas-hooks/skillcheck.py`'s `ask()`/`judge()`,
 * verified against TypeSafe's docs 2026-09-19) — same
 * `POST https://api.typesafe.ai/v1/systemone`, Bearer key, batched
 * `{state, model, questions}` body, `answers[id].noul`/`.choice`/
 * `.probabilities` response shape.
 *
 * NON-NEGOTIABLE (issue #543's own words): "Jev never auto-applies anything
 * beyond what's already auto-applied today (date-only updates), unless the
 * issue explicitly specifies a narrow, safe auto-apply lane with a
 * confidence threshold." It does: a phone/url-only update where the before
 * and after values are the SAME once normalized (a formatting change, not a
 * real one) AND Jev's own noise verdict agrees — see
 * computeAutoApplyEligibility below. That lane only WRITES when the caller
 * passes `autoApplyEnabled: true` (scripts/refresh-ingest.ts, gated on the
 * `REFRESH_AI_AUTO_APPLY` env var, default unset/OFF) — see
 * scripts/refresh/proposalSql.ts's triage branch for the write path itself.
 * A Jev verdict can only ever move a proposal to a MORE cautious lane
 * (`needs_human`), never override or bypass a deterministic guard: every
 * guard in diffEngine.ts (destructive-clear, abnormal-drop, zero-record,
 * per-run cap) already ran, above this module, before any proposal reaches
 * here — see refresh-ingest.ts's call site.
 *
 * Dates stay in code (Jev's own docs: "weak at maths, counting and dates" —
 * atlas-kb note above): `last_verified` is never included in a question's
 * `state`, matching diffEngine.ts's own diff_hash exclusion of it.
 *
 * Model pinned to `jev-1.13.0`, not `jev-latest` (the atlas-kb note's own
 * warning: "jev-latest moves under you" — a silently different model would
 * shift the calibration a threshold was tuned against).
 */

import { reviewableDiffFields } from "@/lib/adminProposals";
import type { Venue } from "@/types/venue";
import type { ChangeType, CurrentVenueRow, ProposalDraft, ProposalSource } from "./diffEngine";
import type { RenamePairCandidate } from "./renamePairs";

export const JEV_MODEL = "jev-1.13.0";
export const QUESTION_SET_VERSION = "v1";
export const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";

/** Mirrors the `change_proposals.triage_lane` CHECK constraint (migrations/0015). */
export type TriageLane = "likely_noise" | "needs_human" | "renamed_or_moved" | "auto_apply_candidate";

// ─── TypeSafe request/response shapes (ported from atlas-hooks/skillcheck.py) ─

export interface JevQuestion {
  type: "noul" | "choice" | "score";
  instructions: string;
  criteria?: Record<string, string>;
}

export interface JevAnswer {
  noul?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
  score?: number;
}

export interface JevResponse {
  answers?: Record<string, JevAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface AskJevOptions {
  /** Injectable for tests — defaults to the global fetch (same convention as linkHealth.ts's checkUrl). */
  fetchImpl?: typeof fetch;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

/** One batched POST /v1/systemone call — every question about one `state` runs in parallel server-side (docs: "extra questions are nearly free"), so callers batch, never loop. */
export async function askJev(state: unknown, questions: Record<string, JevQuestion>, options: AskJevOptions): Promise<JevResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(TYPESAFE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state, model: options.model ?? JEV_MODEL, questions }),
    });
    if (!res.ok) {
      throw new Error(`TypeSafe request failed: HTTP ${res.status}`);
    }
    return (await res.json()) as JevResponse;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Question wording — exact phrasing matters for calibration (docs: "wording changes results a lot") ─

const NOISE_QUESTION_ID = "real_change";
const NOISE_QUESTION: JevQuestion = {
  type: "noul",
  instructions:
    "Compare the BEFORE and AFTER values for this public food-assistance venue's data field(s), given in `state`. " +
    "Is this a genuine real-world change (the actual phone number, hours, or address changed), rather than scraper " +
    "noise, a formatting difference, or a data artifact that doesn't reflect anything actually changing?",
};

const REMOVE_QUESTION_ID = "remove_reason";
const REMOVE_QUESTION: JevQuestion = {
  type: "choice",
  instructions:
    "A source that previously listed this public food-assistance venue (given in `state.before`) no longer lists " +
    "it in today's scrape. What most likely explains this?",
  criteria: {
    gone: "The venue has actually closed or stopped operating.",
    temporarily_missing: "The venue is still open, but this scrape run missed it — a scrape gap, site hiccup, or a temporary listing removal.",
    renamed_or_moved: "The venue is still operating but now appears under a different name or at a different address in the source.",
    unclear: "There isn't enough information here to tell which of the above is true.",
  },
};

const RENAME_QUESTION_ID = "same_place";
const RENAME_QUESTION: JevQuestion = {
  type: "noul",
  instructions:
    "`state.before` describes a public food-assistance venue a source stopped listing. `state.after` describes a " +
    "new venue the same source started listing, at a similar location or with a matching phone number. Are BEFORE " +
    "and AFTER very likely the SAME real-world place, just listed under a different name, address text, or details " +
    "— not two different places?",
};

// ─── State builders — public venue fields only, `last_verified` always stripped ─

/** Fields a triage `state` may ever carry — mirrors diffEngine.ts's SOURCE_OWNED_FIELDS ∪ address/category/id, minus last_verified (dates stay in code). Public venue data only (issue #543's own non-negotiable) — never any admin-only or PII field. */
const STATE_FIELDS: ReadonlyArray<keyof Venue> = ["id", "name", "category", "lat", "lng", "address", "phone", "url", "hours_weekly", "operator"];

function stripToStateFields(record: Partial<Venue> | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const out: Record<string, unknown> = {};
  for (const field of STATE_FIELDS) {
    if (field in record) out[field] = (record as Record<string, unknown>)[field];
  }
  return out;
}

function currentRowToStateRecord(row: CurrentVenueRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of STATE_FIELDS) {
    if (field === "hours_weekly") continue; // JSON-string D1 form — not needed for a rename/noise gut-check, and Jev is weak at structured comparison anyway
    out[field] = (row as unknown as Record<string, unknown>)[field] ?? null;
  }
  return out;
}

// ─── Triage result — what gets stored in change_proposals.triage_* ─────────

export interface TriageResult {
  lane: TriageLane;
  model: string;
  questionSet: string;
  /** Raw Jev answers, keyed by question id — "every AI decision is recorded with its question, its probability and its lane" (issue #543). */
  answers: Record<string, JevAnswer>;
  /** Set only for a rename-pair triage — the OTHER proposal this verdict also applies to. */
  pairedWith?: string;
  inputTokens?: number;
}

/** JSON shape written to change_proposals.triage_json — see migrations/0015's own column comment. */
export function serializeTriageResult(result: TriageResult): string {
  return JSON.stringify({
    question_set: result.questionSet,
    answers: result.answers,
    ...(result.pairedWith ? { paired_with: result.pairedWith } : {}),
  });
}

// ─── Deterministic auto-apply shape check (the "narrow, safe auto-apply lane" the issue permits) ─

const PHONE_DIGITS = /\D/g;

function normalizedPhone(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.replace(PHONE_DIGITS, "");
}

/** Same host+path, tolerating an http->https scheme upgrade and a trailing slash — the shape a scraper's own formatting pass produces, not a real change of destination. */
function normalizedUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const u = new URL(value);
    return `${u.host}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return value.toLowerCase();
  }
}

/**
 * True only for an `update` proposal whose SOLE reviewable field change
 * (excluding last_verified) is `phone` or `url`, AND the before/after
 * values normalize to the SAME thing — a formatting difference, never a
 * real change. This is the deterministic half of the auto-apply gate
 * (issue #543: "a narrow, safe auto-apply lane with a confidence
 * threshold" — narrow = this shape check; threshold = Jev's own noise
 * verdict, see classifyProposalLane). Never phone/url values that differ
 * once normalized — that IS a real change, and it stays human-reviewed
 * regardless of what Jev says.
 */
export function computeAutoApplyEligibility(proposal: ProposalDraft): boolean {
  if (proposal.changeType !== "update") return false;
  const fields = reviewableDiffFields(proposal.proposedDiff);
  if (fields.length !== 1) return false;
  const field = fields[0];
  if (field !== "phone" && field !== "url") return false;

  const before = (proposal.proposedDiff.before ?? {}) as Record<string, unknown>;
  const after = (proposal.proposedDiff.after ?? {}) as Record<string, unknown>;
  const normalize = field === "phone" ? normalizedPhone : normalizedUrl;
  const b = normalize(before[field]);
  const a = normalize(after[field]);
  return b !== null && a !== null && b === a;
}

// ─── Lane classification — Jev's verdict can only move a row to a MORE cautious lane ─

const LIKELY_NOISE_BELOW = 0.15; // real_change noul probability below this = Jev thinks it's noise
const RENAME_CONFIRM_ABOVE = 0.7; // same_place noul probability above this = confirmed rename pair
const AUTO_APPLY_NOISE_BELOW = 0.05; // stricter than LIKELY_NOISE_BELOW — the auto-apply lane needs Jev to be near-certain this is a formatting artifact, not just "probably"

/** Classifies a plain (non-remove, non-paired) update proposal from its `real_change` noul answer + the deterministic shape check. */
export function classifyUpdateLane(proposal: ProposalDraft, realChangeAnswer: JevAnswer | undefined): TriageLane {
  const p = realChangeAnswer?.noul;
  const eligible = computeAutoApplyEligibility(proposal);
  if (eligible && typeof p === "number" && p < AUTO_APPLY_NOISE_BELOW) return "auto_apply_candidate";
  if (typeof p === "number" && p < LIKELY_NOISE_BELOW) return "likely_noise";
  return "needs_human";
}

/** Classifies an unpaired remove proposal from its `remove_reason` choice answer. Every branch still lands `needs_human` — archiving a venue is destructive and Jev's own non-negotiable ("a low probability sends work to a person; it never grants permission") means a remove is never auto-applied by this triage, whatever the verdict. */
export function classifyRemoveLane(_answer: JevAnswer | undefined): TriageLane {
  return "needs_human";
}

/** Classifies a confirmed rename pair from its `same_place` noul answer. Below the confirm threshold, the pair is NOT treated as a rename — both proposals fall back to their own individual classification (the caller's job; see refresh-ingest.ts's triage loop). */
export function isRenameConfirmed(answer: JevAnswer | undefined): boolean {
  return typeof answer?.noul === "number" && answer.noul > RENAME_CONFIRM_ABOVE;
}

// ─── Per-proposal triage (unpaired) ────────────────────────────────────────

export interface TriageProposalOptions extends AskJevOptions {}

/**
 * Triages one proposal that isn't part of a confirmed rename pair. `add`
 * proposals are never sent to Jev — the issue's own lane design has no
 * question for "should a brand-new venue be queued," and one already always
 * is ("Queue for Kyle — anything real and consequential: a new venue...").
 * Skipping the call here is a real cost saving, not a gap: an unpaired add
 * always classifies `needs_human` with no Jev round trip.
 */
export async function triageProposal(proposal: ProposalDraft, options: TriageProposalOptions): Promise<TriageResult> {
  if (proposal.changeType === "add") {
    return { lane: "needs_human", model: options.model ?? JEV_MODEL, questionSet: QUESTION_SET_VERSION, answers: {} };
  }

  if (proposal.changeType === "remove") {
    const state = { source: proposal.source, before: stripToStateFields(proposal.proposedDiff.before) };
    const resp = await askJev(state, { [REMOVE_QUESTION_ID]: REMOVE_QUESTION }, options);
    const answers = resp.answers ?? {};
    return {
      lane: classifyRemoveLane(answers[REMOVE_QUESTION_ID]),
      model: options.model ?? JEV_MODEL,
      questionSet: QUESTION_SET_VERSION,
      answers,
      inputTokens: resp.usage?.input_tokens,
    };
  }

  // update
  const state = buildUpdateState(proposal);
  const resp = await askJev(state, { [NOISE_QUESTION_ID]: NOISE_QUESTION }, options);
  const answers = resp.answers ?? {};
  return {
    lane: classifyUpdateLane(proposal, answers[NOISE_QUESTION_ID]),
    model: options.model ?? JEV_MODEL,
    questionSet: QUESTION_SET_VERSION,
    answers,
    inputTokens: resp.usage?.input_tokens,
  };
}

function buildUpdateState(proposal: ProposalDraft): { source: ProposalSource; change_type: ChangeType; before: unknown; after: unknown; fields_changed: string[] } {
  return {
    source: proposal.source,
    change_type: proposal.changeType,
    before: stripToStateFields(proposal.proposedDiff.before),
    after: stripToStateFields(proposal.proposedDiff.after),
    fields_changed: reviewableDiffFields(proposal.proposedDiff),
  };
}

// ─── Rename-pair triage ─────────────────────────────────────────────────────

export interface RenamePairTriageResult {
  removeResult: TriageResult;
  addResult: TriageResult;
  confirmed: boolean;
}

/**
 * ONE Jev call per candidate pair (not two) — "batching is nearly free"
 * applies within a call, not across separate proposals, so a shared call
 * covering both the remove and the add is the cheaper, and more coherent,
 * shape: Jev sees BOTH records at once and answers a single "same place?"
 * question, rather than guessing from one side alone.
 */
export async function triageRenamePair(candidate: RenamePairCandidate, options: TriageProposalOptions): Promise<RenamePairTriageResult> {
  const state = {
    source: candidate.removeProposal.source,
    before: currentRowToStateRecord(candidate.removedRow),
    after: stripToStateFields(candidate.addProposal.proposedDiff.after),
  };
  const resp = await askJev(state, { [RENAME_QUESTION_ID]: RENAME_QUESTION }, options);
  const answers = resp.answers ?? {};
  const confirmed = isRenameConfirmed(answers[RENAME_QUESTION_ID]);
  const lane: TriageLane = confirmed ? "renamed_or_moved" : "needs_human";

  const shared = {
    model: options.model ?? JEV_MODEL,
    questionSet: QUESTION_SET_VERSION,
    answers,
    inputTokens: resp.usage?.input_tokens,
  };
  return {
    confirmed,
    removeResult: { ...shared, lane, pairedWith: candidate.addProposal.targetVenueId },
    addResult: { ...shared, lane, pairedWith: candidate.removeProposal.targetVenueId },
  };
}

// ─── LLM text-rewrite hook (issue #543 step 3) — no producer wires to it yet ─

export interface TextRewriteRequest {
  field: string;
  value: string;
  context: string;
}

/**
 * The hook point for issue #543's "LLM pass only where text must be
 * rewritten" — a small generative call for the few cases Jev cannot handle
 * (it never generates text). NOT wired to any real model in this slice:
 * scripts/scrape-plentiful.py's own parse-failure path already swallows an
 * unparseable hours string to `hours_weekly=None` before it ever reaches a
 * proposal (diffEngine.ts's isGuardedClear guard on top of that), so
 * nothing produced by this pipeline today actually NEEDS a rewrite — wiring
 * a real call here with no caller that can trigger it would be
 * unexercised, untestable code (ponytail rung 1: "does this need to be
 * built at all"). `noopTextRewriter` is the default; a future slice that
 * adds a real producer (e.g. a scraper change that preserves the
 * unparseable string instead of discarding it) swaps this for a real
 * Claude-backed implementation without touching any call site.
 */
export type TextRewriter = (request: TextRewriteRequest) => Promise<string | null>;

export const noopTextRewriter: TextRewriter = async () => null;
