-- migrations/0010_box_adopters_alerts.sql
--
-- Blessing Boxes slice 6 (atlas-kb/projects/Pueblo Food Map/Blessing Boxes
-- Build Plan.md, "Slice 6 — Adopt a box + email alerts"). Two new tables,
-- no changes to any existing table — same "no rebuild recipe needed" shape
-- as 0007/0008/0009.
--
-- 1. box_adopters: one row per "adopt this box" application. `email` and
--    `note` are PRIVATE — never in any public SELECT (only `display_name`,
--    once approved, is shown on the box's card as "Cared for by ..."). This
--    mirrors box_photos' moderation lifecycle: every insert starts
--    'pending', and only an admin action (POST /api/admin/box-adopters/
--    [id]/approve|reject) moves it to 'approved'/'rejected'.
--
--    `email_confirmed_at` is set by the applicant clicking the link in
--    their own confirm email (double opt-in) — Approve is refused (409)
--    until this is set, so an admin can never publish a display name for an
--    email nobody has proven they control.
--
--    `confirm_token` is a 32-byte random hex value (src/lib/boxAdopters.ts's
--    randomToken()), UNIQUE so a token can be looked up without leaking
--    which row it belongs to via a sequential id guess.
--
-- 2. alert_subscriptions: ONE shared table for all three kinds of email
--    recipient (host / adopter / giver) rather than three near-identical
--    tables — confirm/stop/cooldown logic is written once
--    (src/lib/boxAlerts.ts) and applies uniformly regardless of `role`.
--    `adopter_id` is set only for role='adopter' (linking back to the
--    box_adopters row that produced it on approval); host and giver rows
--    leave it null. UNIQUE(role, venue_id, email) means one email can hold
--    at most one subscription per role per box — re-signing up updates the
--    existing row (see boxAlerts.ts's upsert logic) rather than creating a
--    duplicate that would double-send.
--
--    `confirm_token` / `unsubscribe_token` are both 32-byte random hex,
--    both UNIQUE, and deliberately SEPARATE columns/values — a leaked
--    unsubscribe link (sent in every alert email, so it circulates far more
--    than a one-time confirm link) must never be usable to forge a
--    confirmation, and vice versa.
--
--    `last_alerted_at` is the per-subscription cooldown claim
--    (ALERT_COOLDOWN_HOURS = 6, src/lib/boxAlerts.ts) — claimed atomically
--    via `UPDATE ... WHERE last_alerted_at IS NULL OR < ? RETURNING ...`
--    BEFORE calling Resend, so two overlapping check-ins can never double-
--    send to the same recipient.
--
-- PRIVACY — `email` is real PII (unlike box_checkins/box_photos, which the
-- Build Plan holds to a strict "no email, ever" rule): a person can only
-- reach these tables by typing their own address into a form and confirming
-- it, and every email this slice sends carries a one-click stop link. No
-- column here is ever selected by a public read path except through the
-- confirm/stop token routes, which look up ONE row by an unguessable token
-- and never enumerate.
--
-- `venue_id` is a plain TEXT column matching venues.id BY CONVENTION, no
-- declared FOREIGN KEY — same convention every other blessing-box table in
-- this schema already uses (blessing_boxes.venue_id, box_checkins.venue_id,
-- box_photos.venue_id).
--
-- Applied to STAGING (pueblo-food-map-admin-staging) and local dev only for
-- this slice — production is a later, explicit, Kyle-gated step, same
-- convention as every migration since 0001 (see AGENTS.md "Blessing Boxes
-- — promotion checklist").
--
-- IDEMPOTENCY — every CREATE below uses IF NOT EXISTS, same convention
-- 0007/0008/0009 established: safe to re-run by hand via `d1 execute` even
-- though wrangler's own migrations ledger already prevents this file from
-- re-applying through the normal `d1 migrations apply` path.

CREATE TABLE IF NOT EXISTS box_adopters (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id           TEXT NOT NULL,
  display_name       TEXT NOT NULL,   -- PUBLIC once approved — "Cared for by ..."
  email              TEXT NOT NULL,   -- PRIVATE — never in a public SELECT
  note               TEXT,            -- PRIVATE, optional, admin-only
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  email_confirmed_at TEXT,            -- set only once the applicant clicks their confirm link
  confirm_token      TEXT NOT NULL UNIQUE,
  reviewed_by        TEXT,            -- admin email (Better Auth identity), set only once an admin has acted
  reviewed_at        TEXT,
  review_reason      TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- "Every pending/approved adopter for one box" is this schema's one access
-- shape (the admin queue lists pending; the public card lists approved) —
-- same reasoning box_photos' own venue_id+status+created_at index documents.
CREATE INDEX IF NOT EXISTS idx_box_adopters_venue_status ON box_adopters(venue_id, status);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  role               TEXT NOT NULL CHECK (role IN ('host','adopter','giver')),
  venue_id           TEXT NOT NULL,
  email              TEXT NOT NULL,
  adopter_id         INTEGER,         -- set only for role='adopter' — the box_adopters row this subscription came from
  confirmed_at       TEXT,            -- double opt-in for giver/adopter; set immediately (admin-vouched) for an admin-added host row
  confirm_token      TEXT NOT NULL UNIQUE,
  unsubscribe_token  TEXT NOT NULL UNIQUE,
  unsubscribed_at    TEXT,
  last_alerted_at    TEXT,            -- the per-subscription cooldown claim — see boxAlerts.ts's own header
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (role, venue_id, email)
);

-- "Every confirmed, non-unsubscribed subscription for one box, filtered by
-- role" is the send path's one query shape (src/lib/boxAlerts.ts).
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_venue ON alert_subscriptions(venue_id);
