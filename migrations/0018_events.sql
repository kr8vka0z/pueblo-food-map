-- migrations/0018_events.sql
--
-- Issue #757 (Events 1/6, umbrella #156): one-off "special events" (a
-- produce giveaway, a turkey drive). Storage only — the star pin, event
-- card and flyer upload are later slices.
--
-- Events are LIVE like blessing boxes, never part of the venue Publish
-- snapshot: an admin write shows on GET /api/public/events within the 60s
-- edge cache (src/lib/events.ts, src/app/api/public/events/route.ts).
--
-- Every free-text field has an English column and a nullable `_es` twin;
-- the public layer falls back to English when the Spanish one is NULL.
--
-- starts_at / ends_at: absolute UTC instants, ISO-8601 with a "Z"
-- (e.g. 2026-11-21T17:00:00.000Z). Admins type Pueblo time (America/Denver);
-- src/lib/eventTime.ts converts BEFORE it reaches this table, so a row
-- never depends on any browser's clock. The fixed ISO shape is also what
-- lets the CHECK and the feed's `ends_at > ?` compare as plain text.
--
-- lat / lng / address: the event's OWN location. venue_id is an optional
-- pointer to the place it was copied from, a plain TEXT column with no
-- FOREIGN KEY (same convention as blessing_boxes.venue_id, 0005) — an event
-- keeps its own coordinates even if that venue is later moved or archived.
--
-- flyer_key: reserved for the R2 flyer upload (slice 4, #760). Unused now.
--
-- status: draft -> published -> cancelled/archived. Nothing is ever
-- deleted; archive is a status. A cancelled event keeps cancel_note(_es).
--
-- Fresh table, so this is idempotent (IF NOT EXISTS) — unlike the ALTER
-- TABLE migrations (0011/0012/0015/0016/0017). Production still applies it
-- with `wrangler d1 migrations apply`, never `d1 execute --file` (AGENTS.md
-- "Promotion checklist — D1 migrations").
CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  name_es         TEXT,
  host            TEXT,
  host_es         TEXT,
  description     TEXT,
  description_es  TEXT,
  what_to_bring   TEXT,
  what_to_bring_es TEXT,
  cancel_note     TEXT,
  cancel_note_es  TEXT,

  starts_at       TEXT NOT NULL,
  ends_at         TEXT NOT NULL,

  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  address         TEXT NOT NULL,
  venue_id        TEXT,

  link_url        TEXT,
  flyer_key       TEXT,

  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','cancelled','archived')),

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by      TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by      TEXT NOT NULL,
  published_at    TEXT,

  CHECK (ends_at > starts_at)
);

-- The public feed's one query: WHERE status = 'published' AND ends_at > now.
CREATE INDEX IF NOT EXISTS idx_events_status_ends ON events(status, ends_at);
