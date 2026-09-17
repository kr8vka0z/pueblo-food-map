-- migrations/0007_box_checkins.sql
--
-- Blessing Boxes slice 2 (atlas-kb/projects/Pueblo Food Map/Blessing Boxes
-- Build Plan.md, "Slice 2 — Check-ins and live status"). Two new tables,
-- no changes to any existing table — unlike 0005, this migration needs no
-- rebuild recipe.
--
-- 1. box_checkins: one row per public check-in. Status is COMPUTED from
--    this table at read time (src/lib/blessingBoxes.ts's computeBoxStatus)
--    — there is deliberately no `status` column anywhere; see that file's
--    own header for the state-diagram rule this encodes.
--
--    PRIVACY — matches Discovery §5 verbatim: "No name, no email, no IP
--    address — ever, including in v2." There is no column here capable of
--    holding any of those, structurally, not by convention: no `name`,
--    `email`, or `ip` field exists to accidentally populate.
--
--    `note` is written only for 'filled'/'problem' check-ins (enforced by
--    src/lib/blessingBoxes.ts's write-path validation, not a DB CHECK —
--    SQLite has no cross-column conditional CHECK worth the complexity for
--    one optional field). Length-capped at insert time via
--    FIELD_LIMITS.BOX_CHECKIN_NOTE, same convention as every other
--    user-text field in this app (src/lib/fieldLimits.ts).
--
--    `kind='problem'` rows are ADMIN-ONLY from the moment they're written:
--    every public read (GET /api/public/blessing-boxes, /box/<id>) filters
--    `kind != 'problem'` explicitly at the query, the same "never SELECT
--    the private thing" structural guarantee 0005 already established for
--    blessing_boxes.host_contact.
--
--    `venue_id` is a plain TEXT column matching venues.id BY CONVENTION,
--    no declared FOREIGN KEY — same convention blessing_boxes.venue_id and
--    change_proposals.target_venue_id already use in this schema (0005/0001).
--
-- 2. box_checkin_rate_limit: the shared D1-backed counter the public
--    check-in write route uses instead of src/lib/rateLimit.ts's
--    per-isolate in-process limiter (too weak for a feature used daily —
--    see src/lib/checkinRateLimit.ts's own header for the full reasoning).
--    Deliberately a NEW table, not a reuse of migrations/0004's `rateLimit`
--    table — that one's shape is owned by the installed better-auth
--    library and can change on a dependency bump; this app's own write
--    path should never be coupled to a third-party plugin's private schema.
--    `key` already encodes an hour bucket (see checkinRateLimit.ts), so a
--    row is naturally scoped to one hour; stale rows are swept
--    opportunistically by the write path itself, not a cron.
--
-- Applied to STAGING (pueblo-food-map-admin-staging) and local dev only for
-- this slice — production is a later, explicit, Kyle-gated step, same
-- convention as every migration since 0001 (see AGENTS.md "Blessing Boxes
-- — promotion checklist").

CREATE TABLE box_checkins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('filled','took','low','empty','problem')),
  note          TEXT,
  visibility    TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible','hidden')),
  hidden_by     TEXT,             -- admin email (Better Auth identity), set only on hide
  hidden_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Two access shapes this schema needs to serve fast: "every check-in for
-- one box, newest first" (both public reads and the admin panel) and "is
-- this box's latest status-relevant signal still within 7 days" (same
-- query, computed in application code from the same index).
CREATE INDEX idx_box_checkins_venue_created ON box_checkins(venue_id, created_at);

CREATE TABLE box_checkin_rate_limit (
  key     TEXT PRIMARY KEY,  -- HMAC(TURNSTILE_SECRET_KEY, "scope:id:hour-bucket") — see checkinRateLimit.ts
  bucket  INTEGER NOT NULL,  -- the hour bucket this row belongs to, for the opportunistic sweep below
  count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_box_checkin_rate_limit_bucket ON box_checkin_rate_limit(bucket);
