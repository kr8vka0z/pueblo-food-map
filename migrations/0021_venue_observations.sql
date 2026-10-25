-- migrations/0021_venue_observations.sql
--
-- Venue Data Rebuild, step 1 (atlas-kb "PFM Venue Data Rebuild Plan
-- 2026-10-25", "Where the information is stored"): one row per thing a
-- source told us about one field of one venue, kept apart from `venues` so
-- "we downloaded this" never counts as "this was confirmed". The published
-- venue record and Publish are unchanged.
--
-- Two kinds of row today:
--   - a FETCH (is_pin = 0): the weekly refresh saw the venue still listed
--     with nothing changed (field 'listed', value 'true'). This replaces the
--     old automatic venues.last_verified bump (scripts/refresh/proposalSql.ts).
--     accepted_at stays NULL: nobody confirmed anything.
--   - a PIN (is_pin = 1, source 'venue_direct'): the venue told us this value
--     itself, saved by an admin with "The venue told us" ticked (PATCH
--     /api/admin/venues/[id]). No automated source may change a pinned field
--     on its own; a proposal touching one always goes to review with the pin
--     shown beside it. The newest pin per (venue_id, field) is the live one.
--
-- `source` has no CHECK on purpose (same as venue_id_aliases, 0016): the
-- source list is still growing, and a CHECK here would mean another table
-- rebuild per new source. `value` is JSON text (hours columns are already
-- JSON; other fields are JSON-encoded). There is no value hash: a hash of raw
-- JSON isn't stable under the key-order differences diffEngine.ts's
-- normalizers exist to absorb, so comparisons go through those instead.
-- Idempotent (IF NOT EXISTS / NOT EXISTS).

CREATE TABLE IF NOT EXISTS venue_observations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id          TEXT NOT NULL,   -- venues.id by convention, no FK (0005's reasoning)
  field             TEXT NOT NULL,   -- a venues column name, or 'listed'
  source            TEXT NOT NULL,   -- 'plentiful','osm',…,'venue_direct'
  value             TEXT,            -- JSON
  fetched_at        TEXT NOT NULL,   -- when we got it (for a pin: when the admin saved it)
  source_updated_at TEXT,            -- the source's own "updated" date, when it gives one
  is_pin            INTEGER NOT NULL DEFAULT 0 CHECK (is_pin IN (0, 1)),
  pinned_by         TEXT,            -- admin who recorded the pin
  pin_note          TEXT,            -- who at the venue said it, and how
  accepted_at       TEXT,            -- set when a person accepted this value onto the map
  accepted_by       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_venue_observations_venue_field ON venue_observations(venue_id, field);
CREATE INDEX IF NOT EXISTS idx_venue_observations_pins ON venue_observations(is_pin) WHERE is_pin = 1;

-- Friendly Harbor Community Center: its admin assistant wrote in through the
-- map's feedback form on 2026-10-12 to say the pantry is the LAST WEDNESDAY,
-- 1-3 PM. Its own website still says Friday, so the plan pins this value now.
-- Copies the venue's current hours_irregular (skips if the venue is gone).
-- No email in the actor fields: this repo is public.
INSERT INTO venue_observations
  (venue_id, field, source, value, fetched_at, is_pin, pinned_by, pin_note, accepted_at, accepted_by)
SELECT id, 'hours_irregular', 'venue_direct', hours_irregular, '2026-10-12T00:00:00.000Z', 1,
       'migration-0021', 'Heather, admin assistant, via feedback form 2026-10-12',
       '2026-10-12T00:00:00.000Z', 'migration-0021'
FROM venues
WHERE id = 'manual-f3d3712c-caf1-40a0-a3cd-b3dc38e14c00'
  AND hours_irregular IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM venue_observations
    WHERE venue_id = 'manual-f3d3712c-caf1-40a0-a3cd-b3dc38e14c00'
      AND field = 'hours_irregular' AND is_pin = 1
  );
