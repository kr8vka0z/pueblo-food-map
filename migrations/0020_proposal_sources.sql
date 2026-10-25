-- migrations/0020_proposal_sources.sql
--
-- Venue Data Rebuild, step 1 (atlas-kb "PFM Venue Data Rebuild Plan
-- 2026-10-25"): widens change_proposals.source's CHECK to the four new
-- source names the rebuild reads from — 'care_and_share', 'website',
-- 'usda_snap', 'cdphe_wic' — keeping the existing four.
--
-- SQLite can't alter a CHECK, so this is the same create-copy-drop-rename
-- rebuild 0005_blessing_boxes.sql used for venues. Safe here for the same
-- reasons: no table declares a FOREIGN KEY to change_proposals, and no
-- trigger or view references it (checked against every migration through
-- 0019). `id` is copied explicitly — proposal ids appear in admin URLs
-- (`?proposal=<id>`) — and SQLite's AUTOINCREMENT counter follows the
-- rename, so new rows still get ids above every existing one. All four
-- indexes are re-created; the four 0016 triage columns (and triage_lane's
-- CHECK) are carried over unchanged. No BEGIN/COMMIT: D1 runs a migration
-- file as one batch and rejects hand-written transaction control (0003).
--
-- venues.source_type is deliberately NOT rebuilt in this step: no new
-- source creates venues yet. It needs the same treatment when one does.
--
-- Apply only via `wrangler d1 migrations apply` (tracked), never
-- `d1 execute --file`: a run that stopped part-way leaves
-- change_proposals_new behind and the next run fails on its CREATE TABLE.

CREATE TABLE change_proposals_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL CHECK (source IN (
                    'osm','plentiful','gtfs','link_health',
                    'care_and_share','website','usda_snap','cdphe_wic'
                  )),
  target_venue_id TEXT NOT NULL,
  change_type     TEXT NOT NULL CHECK (change_type IN ('add','update','remove')),
  proposed_diff   TEXT NOT NULL,
  diff_hash       TEXT NOT NULL,
  run_id          TEXT NOT NULL,
  anomaly         INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','superseded')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  applied_at      TEXT,
  triage_lane     TEXT
    CHECK (triage_lane IS NULL OR triage_lane IN (
      'likely_noise', 'needs_human', 'renamed_or_moved', 'auto_apply_candidate'
    )),
  triage_json     TEXT,
  triage_model    TEXT,
  triage_at       TEXT
);

INSERT INTO change_proposals_new (
  id, source, target_venue_id, change_type, proposed_diff, diff_hash, run_id,
  anomaly, status, created_at, reviewed_by, reviewed_at, applied_at,
  triage_lane, triage_json, triage_model, triage_at
)
SELECT
  id, source, target_venue_id, change_type, proposed_diff, diff_hash, run_id,
  anomaly, status, created_at, reviewed_by, reviewed_at, applied_at,
  triage_lane, triage_json, triage_model, triage_at
FROM change_proposals;

DROP TABLE change_proposals;
ALTER TABLE change_proposals_new RENAME TO change_proposals;

CREATE INDEX idx_change_proposals_status ON change_proposals(status);
CREATE INDEX idx_change_proposals_run    ON change_proposals(run_id);
CREATE INDEX idx_change_proposals_target ON change_proposals(target_venue_id);
CREATE INDEX idx_change_proposals_dedup  ON change_proposals(source, target_venue_id, diff_hash);
