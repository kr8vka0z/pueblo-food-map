-- migrations/0016_proposal_triage.sql
--
-- Issue #543: TypeSafe Jev triages each change_proposals row before a human
-- sees it at /admin/flags — a calibrated-probability verdict (real change vs
-- scraper noise; for a remove, gone/temporarily-missing/renamed-or-moved/
-- unclear; for a remove+add pair with close coordinates or a shared phone,
-- whether it's the same place renamed) surfaced as a sort/filter aid, never
-- as a second write path beyond what already auto-applies today (the
-- existing date-only `last_verified` bump). See scripts/refresh/triage.ts's
-- own header for the question set and lane rules, and AGENTS.md's
-- "Automated venue-refresh pipeline" section for the design.
--
-- Part 1 — four nullable columns on change_proposals, additive only — every existing SELECT (`SELECT *`
-- at src/app/admin/flags/page.tsx, every `SELECT id, source, ...` explicit
-- list elsewhere) either already reads `*` and picks these up for free, or
-- doesn't name them and is unaffected. NULL means "never triaged" (a
-- date-only proposal, which auto-applies before triage ever runs, or a run
-- from before this migration) — the review UI treats NULL the same as a
-- Jev-call failure: routed to plain "needs a human," never a reason to
-- treat a row as safer than an untriaged one.
--
-- triage_lane: the machine's classification, purely a sorting/filtering aid
--   at /admin/flags — never a second gate that can itself apply a write.
--   'auto_apply_candidate' only means "this row is ELIGIBLE for the
--   REFRESH_AI_AUTO_APPLY-gated auto-apply lane" (default OFF, see
--   scripts/refresh/triage.ts) — with that flag off, it renders in the UI
--   exactly like 'likely_noise', just filterable separately.
-- triage_json: the full recorded decision — question(s) asked, Jev's raw
--   answer(s)/probabilities, the question-set version, and (for a paired
--   remove+add) the counterpart's target_venue_id — "every AI decision is
--   recorded with its question, its probability and its lane" (issue #543).
-- triage_model: the exact TypeSafe model string (pinned, e.g. "jev-1.13.0"
--   — never "jev-latest", which moves under you), so a later threshold
--   re-tune can tell which rows were judged by which model version.
-- triage_at: when the triage call ran — distinct from created_at (the
--   proposal itself may predate this migration and get triaged later by a
--   backfill, though no backfill ships in this slice).
--
-- NOT IDEMPOTENT — SQLite's ALTER TABLE ... ADD COLUMN has no IF NOT EXISTS
-- form (same limitation 0011/0012's own headers document). Running this file
-- twice against the same database fails on the second run with "duplicate
-- column name: triage_lane". Must run EXACTLY ONCE per database, only ever
-- via `wrangler d1 migrations apply` (tracked) — never `d1 execute --file`
-- outside that ledger, unless first confirming via
-- `PRAGMA table_info(change_proposals);` that the columns don't already exist.

ALTER TABLE change_proposals ADD COLUMN triage_lane TEXT
  CHECK (triage_lane IS NULL OR triage_lane IN (
    'likely_noise', 'needs_human', 'renamed_or_moved', 'auto_apply_candidate'
  ));
ALTER TABLE change_proposals ADD COLUMN triage_json  TEXT;
ALTER TABLE change_proposals ADD COLUMN triage_model  TEXT;
ALTER TABLE change_proposals ADD COLUMN triage_at     TEXT;

-- Part 2 — venue_id_aliases: closes the rename LOOP, not just the rename
-- gap. Plentiful ids embed the venue's name (0001's own id comment), so a
-- renamed venue arrives as a brand-new upstream id. Approving a rename
-- proposal (scripts/refresh/renamePairs.ts) updates the OLD venue row in
-- place — same id, so /venue/<id> links, audit history and any pending
-- link_health finding all keep pointing at it — and records the new
-- upstream id here. refresh-ingest.ts maps every incoming record through
-- this table BEFORE diffing, so next week's scrape of the new id matches
-- the old row instead of proposing the same remove+add pair forever.
-- Written only by applyApprovedProposal (src/lib/adminProposals.ts) on a
-- human approval — never by the pipeline itself.
CREATE TABLE IF NOT EXISTS venue_id_aliases (
  source       TEXT NOT NULL,   -- change_proposals.source of the rename ('plentiful' | 'osm')
  upstream_id  TEXT NOT NULL,   -- the id the scraper now emits
  venue_id     TEXT NOT NULL,   -- the venues.id it maps to
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by   TEXT NOT NULL,   -- approving admin's email
  PRIMARY KEY (source, upstream_id)
);
