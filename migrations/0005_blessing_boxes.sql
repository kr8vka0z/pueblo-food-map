-- migrations/0005_blessing_boxes.sql
--
-- Blessing Boxes slice 1 (atlas-kb/projects/Pueblo Food Map/Blessing Boxes
-- Build Plan.md). Two changes:
--
-- 1. Adds 'blessing_box' to venues.category's CHECK constraint. SQLite has
--    no ALTER TABLE ... ALTER CONSTRAINT, so the only way to change a CHECK
--    is the standard rebuild recipe: create the new-shape table, copy every
--    row, drop the old table, rename. Verified 2026-09-17 (build plan "Two
--    architecture calls" #2): no other table declares a foreign key to
--    venues (change_proposals.target_venue_id is a plain TEXT column, not a
--    REFERENCES) — so this rebuild carries no chain reaction. No CREATE
--    TRIGGER exists on venues either (checked against every prior migration
--    file), so there's nothing to re-create beyond the 3 indexes below.
--    D1 runs a migration file as one implicit batch — no explicit
--    BEGIN/COMMIT (migrations/0003_better_auth_schema.sql's own header
--    already established this; D1 rejects hand-written transaction control).
--
-- 2. Adds `blessing_boxes`, one row per blessing_box venue holding the
--    fields a normal venue row has no place for (host, most-needed,
--    install/removal dates). `venue_id` is a plain TEXT PRIMARY KEY that
--    matches `venues.id` BY CONVENTION, not a declared FOREIGN KEY — same
--    convention change_proposals already uses, kept for consistency rather
--    than introducing the repo's first FK declaration for one table.
--
-- Everything here targets STAGING (pueblo-food-map-admin-staging) /
-- local dev only for this slice. The production run is Kyle's later call,
-- per the build plan's "Going live (gated on Kyle)" section.

CREATE TABLE venues_new (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
                    'pantry','grocery','convenience','farm','garden',
                    'edible_landscape','meal_site','blessing_box'
                  )),
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  address         TEXT NOT NULL,
  hours_weekly    TEXT,
  accepts_snap    INTEGER,
  accepts_wic     INTEGER,
  phone           TEXT,
  email           TEXT,
  url             TEXT,
  notes           TEXT,
  operator        TEXT,
  source          TEXT NOT NULL,
  last_verified   TEXT NOT NULL,

  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  source_type     TEXT NOT NULL CHECK (source_type IN (
                    'pfp','osm','plentiful','gtfs','manual'
                  )),
  outside_county  INTEGER NOT NULL DEFAULT 0,

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by      TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by      TEXT NOT NULL,
  published_at    TEXT,
  published_by    TEXT
);

INSERT INTO venues_new (
  id, name, category, lat, lng, address, hours_weekly, accepts_snap,
  accepts_wic, phone, email, url, notes, operator, source, last_verified,
  status, source_type, outside_county, created_at, created_by, updated_at,
  updated_by, published_at, published_by
)
SELECT
  id, name, category, lat, lng, address, hours_weekly, accepts_snap,
  accepts_wic, phone, email, url, notes, operator, source, last_verified,
  status, source_type, outside_county, created_at, created_by, updated_at,
  updated_by, published_at, published_by
FROM venues;

DROP TABLE venues;
ALTER TABLE venues_new RENAME TO venues;

CREATE INDEX idx_venues_status      ON venues(status);
CREATE INDEX idx_venues_category    ON venues(category);
CREATE INDEX idx_venues_source_type ON venues(source_type);

-- blessing_boxes: one row per blessing_box venue. Boxes are LIVE, not
-- published (build plan architecture call #1) — every column here is read
-- straight off D1 by the public live endpoint/box page, never through the
-- draft->publish snapshot pipeline. `host_contact` is PRIVATE: the public
-- live endpoint and /box/<id> page must never SELECT it into a response
-- (enforced by naming columns explicitly at every public read site, not by
-- a DB-level ACL — D1 has none).
CREATE TABLE blessing_boxes (
  venue_id      TEXT PRIMARY KEY,   -- matches venues.id; no FK, see header
  host_name     TEXT,               -- public
  host_note     TEXT,               -- public, host-written blurb
  host_contact  TEXT,               -- PRIVATE — never in a public SELECT
  most_needed   TEXT,               -- public, free text (e.g. "canned protein, diapers")
  installed_on  TEXT,               -- ISO date, nullable
  removed_on    TEXT,               -- ISO date, nullable — box no longer in service
  qr_code_id    TEXT,               -- reserved for slice 8 (QR stickers); unused until then
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
