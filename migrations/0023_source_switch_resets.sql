-- migrations/0023_source_switch_resets.sql
--
-- Venue Data Rebuild step 2 (atlas-kb "PFM Venue Data Rebuild Plan
-- 2026-10-25", "Decided: sources switch themselves on"). A (source, field)
-- pair starts updating on its own after Kyle approves 5 of its real changes
-- in a row unedited. The count itself is derived from change_proposals
-- history (src/lib/sourceSwitch.ts), so approve/reject need no extra write.
-- The one event that history can't show is Kyle editing, in the venue form,
-- a value a pair's approved or automatic change put there (an "edited
-- approval", or undoing an automatic change). Each such edit writes one row
-- here, and the pair's count restarts after the newest one.
--
-- `source` has no CHECK, same reasoning as venue_observations (0021).
-- ADD-only and idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS source_switch_resets (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  source    TEXT NOT NULL,   -- change_proposals.source, e.g. 'care_and_share'
  field     TEXT NOT NULL,   -- a venues column, e.g. 'phone'
  venue_id  TEXT,            -- the edit that caused it
  reset_at  TEXT NOT NULL,
  reset_by  TEXT             -- admin email
);

CREATE INDEX IF NOT EXISTS idx_source_switch_resets_pair ON source_switch_resets(source, field);
