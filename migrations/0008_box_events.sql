-- migrations/0008_box_events.sql
--
-- Blessing Boxes slice 3 (atlas-kb/projects/Pueblo Food Map/Blessing Boxes
-- Build Plan.md, "Slice 3 — Activity log page"). One new table, no changes
-- to any existing table.
--
-- box_events records a box's LIFECYCLE, not its day-to-day check-ins
-- (box_checkins, migrations/0007, covers that): added / moved / renamed /
-- paused / removed. Written by the SAME admin actions that already mutate
-- `venues`/`blessing_boxes` (POST /api/admin/venues, PATCH
-- /api/admin/venues/[id] — see src/lib/boxEvents.ts) riding their existing
-- atomic db.batch() calls, so a lifecycle event can never be recorded
-- without the venue write that caused it actually landing, or vice versa.
--
-- `kind='paused'` is defined here for forward-compatibility with the Build
-- Plan's own state diagram, but NOTHING in this slice writes it — there is
-- still no admin "pause without archiving" control (see AGENTS.md's slice-2
-- "out_of_service is currently unreachable" note). A future slice adding
-- that control has a ready-made event kind to write into.
--
-- WHY archiving a box (POST /api/admin/venues/[id]/archive) writes NO
-- event, even though it's a real lifecycle transition: every public read of
-- this table (src/lib/boxActivity.ts's UNION ALL) joins venues on
-- `category = 'blessing_box' AND status != 'archived'` — the same filter
-- SELECT_LIVE_BOXES_SQL already uses (blessingBoxes.ts) — so a 'removed'
-- row written at the exact moment a box is archived would vanish from every
-- public read the instant it's written. See src/lib/boxEvents.ts's own
-- header for the full reasoning, including why editing a box's category
-- AWAY from 'blessing_box' is treated the same way.
--
-- `venue_id` is a plain TEXT column matching venues.id BY CONVENTION, no
-- declared FOREIGN KEY — same convention every other table in this schema
-- uses (blessing_boxes.venue_id, box_checkins.venue_id,
-- change_proposals.target_venue_id).
--
-- `detail` is a short, plain-text, human-readable fact the writing route
-- sets directly (e.g. an address's "old -> new" value) — never JSON, and
-- never a re-derivation of `audit_log`'s full before/after (that table
-- stays the admin-only record; this one is the PUBLIC one-line summary the
-- Build Plan's D1 story calls for).
--
-- `created_at`'s DEFAULT expression is byte-identical to
-- box_checkins.created_at's (migrations/0007) so the two tables' timestamp
-- strings sort correctly against each other in boxActivity.ts's UNION ALL —
-- a mismatched format here would silently break cross-table ordering. In
-- practice every INSERT this slice writes binds an explicit `created_at`
-- value (the writing route's own already-computed `timestamp`/`updatedAt`,
-- so multiple events written in the same admin save — e.g. a rename AND a
-- move together — share one exact instant rather than risking two
-- microseconds-apart `strftime('now')` evaluations); the column DEFAULT
-- exists as a safety net for any future direct INSERT that doesn't.
--
-- Applied to STAGING (pueblo-food-map-admin-staging) and local dev only for
-- this slice — production is a later, explicit, Kyle-gated step, same
-- convention as every migration since 0001 (see AGENTS.md "Blessing Boxes
-- — promotion checklist", now covering 0005-0008).
--
-- IDEMPOTENT — every CREATE uses IF NOT EXISTS (0007's established
-- convention), safe to re-run against a database that already has these
-- objects independent of wrangler's own migrations ledger.

CREATE TABLE IF NOT EXISTS box_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('added','moved','renamed','paused','removed')),
  detail        TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Same two access shapes box_checkins' own index comment describes: "every
-- event for one box, newest first" (the D3 per-box panel on /box/<id>) and
-- the global /boxes/activity feed (newest first across all boxes, this
-- table's own half of boxActivity.ts's UNION ALL).
CREATE INDEX IF NOT EXISTS idx_box_events_venue_created ON box_events(venue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_box_events_created ON box_events(created_at);
