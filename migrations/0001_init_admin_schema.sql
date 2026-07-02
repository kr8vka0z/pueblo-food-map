-- migrations/0001_init_admin_schema.sql
--
-- venues: the single source of truth for EVERY venue on the public map —
-- hand-curated and auto-generated alike. Today: 108 rows (10 pfp + 60 osm +
-- 38 plentiful — verified by direct count against src/data/*.ts, 2026-07-01).
-- This is a scope change from v1.0 of this document, which scoped `venues`
-- to just the 10 pfpVenues records and left OSM/Plentiful as untouched,
-- script-owned static files. See §7 for the full-seed migration.

CREATE TABLE venues (
  id              TEXT PRIMARY KEY,             -- id: 'garden-*' /
                                                  -- 'landscape-*' (PFP),
                                                  -- 'osm-<type>-<id>' (OSM's
                                                  -- own node/way id — verified
                                                  -- in scripts/ingest-osm-
                                                  -- grocery.py), 'plentiful-
                                                  -- <url-slug>' (the LAST
                                                  -- SEGMENT of Plentiful's own
                                                  -- detail-page URL —
                                                  -- verified in scripts/
                                                  -- scrape-plentiful.py). All
                                                  -- three schemes are
                                                  -- collision-free by
                                                  -- construction today
                                                  -- (distinct prefixes,
                                                  -- source-native
                                                  -- identifiers); the seed
                                                  -- script's validation
                                                  -- report (§7 step 3) fails
                                                  -- loudly if that's ever
                                                  -- wrong. NOT claimed stable
                                                  -- under a Plentiful rename,
                                                  -- though (fixes
                                                  -- Important-1 — softened
                                                  -- from an earlier "verified
                                                  -- stable" claim): the slug
                                                  -- embeds the venue NAME
                                                  -- (e.g. 'plentiful-pueblo-
                                                  -- community-soup-kitchen-
                                                  -- 1bc98af5'), and the
                                                  -- committed data already
                                                  -- has a same-name/same-
                                                  -- coordinates/same-phone
                                                  -- pair under two DIFFERENT
                                                  -- ids ('...-1bc98af5' vs
                                                  -- '...-plentiful-3195') —
                                                  -- so a Plentiful-side
                                                  -- rename is expected to
                                                  -- surface as a remove+add
                                                  -- pair, not an update (same
                                                  -- failure class as an OSM
                                                  -- node→way remap). §6.6's
                                                  -- "possible rename" hint is
                                                  -- the mitigation; id
                                                  -- stability itself is not
                                                  -- claimed.
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
                    'pantry','grocery','convenience','farm','garden',
                    'edible_landscape','meal_site'
                  )),
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  address         TEXT NOT NULL,
  hours_weekly    TEXT,      -- JSON-encoded WeeklyHours (nullable)
  accepts_snap    INTEGER,   -- tri-state: NULL=unknown, 0=no, 1=yes.
                                -- Publish-serializer mapping (one line, per
                                -- nit): NULL -> Venue.accepts_snap left
                                -- `undefined` (key omitted), 0 -> `false`,
                                -- 1 -> `true` — matches the optional
                                -- `boolean` the Venue type already declares
                                -- (src/types/venue.ts). NULL/`undefined` is
                                -- also exactly the signal the benefitFlags
                                -- overlay checks before falling back (fixes
                                -- NB4, §7 step 1) — a non-NULL value here is
                                -- an admin's explicit edit and always wins.
  accepts_wic     INTEGER,   -- same tri-state + serializer mapping as
                                -- accepts_snap, above.
  phone           TEXT,
  email           TEXT,
  url             TEXT,
  notes           TEXT,
  operator        TEXT,
  source          TEXT NOT NULL,   -- human-readable provenance citation,
                                     -- e.g. "OpenStreetMap (node/4041375052)"
                                     -- — same meaning as today's Venue.source.
  last_verified   TEXT NOT NULL,   -- ISO date, matches Venue.last_verified

  -- Admin/workflow columns — NOT part of the public Venue shape; stripped
  -- out by the publish serializer before a row becomes a static record.
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  source_type     TEXT NOT NULL CHECK (source_type IN (
                    'pfp','osm','plentiful','gtfs','manual'
                  )),               -- WHICH upstream feed owns this row, if
                                     -- any. Distinct from `source` (a free-
                                     -- text citation string) — this is the
                                     -- MACHINE key the refresh diff engine
                                     -- (§6.3) uses to know which existing
                                     -- rows a given run is responsible for.
                                     -- 'manual' = admin-created, no upstream
                                     -- feed. 'gtfs' is reserved for forward-
                                     -- compat — no GTFS feeder exists yet
                                     -- (#133: roadmap/post-demo).
  outside_county  INTEGER NOT NULL DEFAULT 0,  -- set when lat/lng fails the
                                                 -- PUEBLO_COUNTY_BBOX check
                                                 -- (src/data/pueblo-bbox.ts)
                                                 -- + admin explicitly
                                                 -- confirmed anyway

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by      TEXT NOT NULL,   -- verified Access JWT email claim — for a
                                     -- row created by approving a change-
                                     -- proposal, this is the REVIEWING
                                     -- admin's email, not a bot identity
                                     -- (§6.7)
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by      TEXT NOT NULL,
  published_at    TEXT,            -- NULL until first publish
  published_by    TEXT
);

CREATE INDEX idx_venues_status      ON venues(status);
CREATE INDEX idx_venues_category    ON venues(category);
CREATE INDEX idx_venues_source_type ON venues(source_type);

-- change_proposals: what an automated refresh run or a link-health check
-- thinks should change. NOTHING here touches `venues` until an admin
-- approves it (§6) — this table is the mechanism that lets #133's
-- ingestion and #234's freshness/drift monitoring propose changes without
-- ever writing directly to the live data. NEW in this revision.
CREATE TABLE change_proposals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL CHECK (source IN (
                    'osm','plentiful','gtfs','link_health'
                  )),
  target_venue_id TEXT NOT NULL,   -- the stable id this proposal targets.
                                     -- For 'add', the id the record WOULD
                                     -- get (deterministic per source — see
                                     -- the `venues.id` comment above), so no
                                     -- separate fuzzy match-key concept is
                                     -- needed. For 'update'/'remove', an id
                                     -- that already exists in `venues`.
  change_type     TEXT NOT NULL CHECK (change_type IN ('add','update','remove')),
                                     -- No separate 'restore' value (Important-2):
                                     -- an 'add' whose target_venue_id already
                                     -- exists as an archived row applies as an
                                     -- upsert-that-revives instead of a plain
                                     -- INSERT (§6.3, §6.7) — the review UI
                                     -- detects and labels this case "Restore"
                                     -- by checking current archived-row
                                     -- existence, no schema distinction needed.
  proposed_diff   TEXT NOT NULL,   -- JSON, ONE shape for every source (fixes
                                     -- a §6.5 shape-mismatch nit): { before:
                                     -- Venue|null, after: Venue|null,
                                     -- fields_changed: string[], meta?:
                                     -- Record<string, unknown> }. `meta` is
                                     -- the extensibility valve for source-
                                     -- specific context that isn't a venue
                                     -- field itself — e.g. a link_health
                                     -- proposal sets meta: { http_status,
                                     -- checked_at } alongside a normal
                                     -- `after` with the url field cleared
                                     -- (§6.5). A link_health proposal's
                                     -- `after` only ever carries what the
                                     -- check can safely assert (e.g. url
                                     -- cleared) — it can't invent a
                                     -- replacement URL.
  diff_hash       TEXT NOT NULL,   -- stable hash (e.g. SHA-256) of the
                                     -- normalized { after, fields_changed }
                                     -- content, computed identically every
                                     -- run. Powers rejection memory (§6.10b)
                                     -- — an identical diff to one a human
                                     -- already rejected is not re-proposed.
                                     -- New in this revision (fixes NB3b).
  run_id          TEXT NOT NULL,   -- groups every proposal from one refresh
                                     -- run, so the review UI can show/
                                     -- approve/reject a run as a unit (§6.6)
                                     -- and the sanity guardrail (§6.4) can
                                     -- flag a run without a second table.
                                     -- Also doubles as an idempotency key
                                     -- (fixes NB3d, §6.10d): minted by the
                                     -- calling GitHub Action as `${{
                                     -- github.run_id }}`, stable across a
                                     -- retried POST for the same workflow
                                     -- run, so a retry can't duplicate a
                                     -- whole run's proposals.
  anomaly         INTEGER NOT NULL DEFAULT 0,  -- 1 if this run tripped the
                                                 -- sanity guardrail (§6.4) —
                                                 -- surfaced distinctly in the
                                                 -- review UI and EXCLUDED
                                                 -- from the default "approve
                                                 -- all" bulk action.
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected',
                    'superseded')),  -- 'superseded' (fixes NIT: distinguish
                                       -- from human rejection in the data):
                                       -- the proposal was made moot by
                                       -- something OTHER than an explicit
                                       -- human approve/reject click — a
                                       -- newer ingest run targeting the same
                                       -- (source, target_venue_id) (§6.10a),
                                       -- a hand-edit touching the same
                                       -- fields (§5 step 2), or the
                                       -- stale-apply guard finding the data
                                       -- moved since this proposal was
                                       -- written (§6.10c). 'rejected' means
                                       -- a human looked at it and said no;
                                       -- 'superseded' means the world moved
                                       -- on before anyone looked.
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_by     TEXT,             -- verified Access JWT email claim of the
                                     -- admin who approved/rejected this —
                                     -- also this table's own audit trail for
                                     -- the review decision itself, so a
                                     -- rejection does not additionally write
                                     -- an audit_log row (§6.7).
  reviewed_at     TEXT,
  applied_at      TEXT              -- NULL until an 'approved' proposal's
                                     -- venues mutation actually lands (§6.7)
);

CREATE INDEX idx_change_proposals_status ON change_proposals(status);
CREATE INDEX idx_change_proposals_run    ON change_proposals(run_id);
CREATE INDEX idx_change_proposals_target ON change_proposals(target_venue_id);
-- Composite index for the two §6.10 lifecycle lookups: auto-supersede
-- (source, target_venue_id, status='pending') and rejection memory
-- (source, target_venue_id, diff_hash, status='rejected') — both query on
-- this same leading-column shape, so one index covers both (fixes NB3a/b).
CREATE INDEX idx_change_proposals_dedup  ON change_proposals(source, target_venue_id, diff_hash);

-- audit_log: append-only. No UPDATE/DELETE grant is ever exposed at the
-- app layer — enforced by omission (no route handler for it exists), not
-- by a DB permission (D1 has no per-table ACLs). Unchanged from v1.0 of
-- this document — approving a change-proposal reuses these exact same
-- action values (create/update/archive), so no new enum value is needed
-- here (§6.7).
CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email   TEXT NOT NULL,
  entity        TEXT NOT NULL,    -- 'venue' (v1); 'banner' from #73 Phase 2
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('create','update','publish','archive')),
  before_json   TEXT,             -- NULL on create
  after_json    TEXT NOT NULL,
  timestamp     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_audit_entity    ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);

-- NOTE: `banners` (migrations/0002_banners.sql, #73 Phase 2) is intentionally
-- NOT created here — deferred per spec §2/§11. The audit_log.entity comment
-- above documents the future value so the eventual migration is a known,
-- reviewed shape rather than an ad hoc addition.
