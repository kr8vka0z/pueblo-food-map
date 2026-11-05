-- migrations/0027_event_submissions.sql
--
-- Issue #883 (public "Share an event" page, umbrella #156): events the public
-- sends in for review. Nothing here is ever on the map: an admin turns a row
-- into a DRAFT event ("Make it a draft event") or dismisses it.
--
-- A new table rather than a new `kind` in public_submissions: that table's
-- CHECK (kind IN ('new_venue','closure')) can't be widened without
-- rebuilding it, and an event's fields have nothing in common with a venue's.
--
-- payload: JSON of the validated event fields (validateEventSubmission in
-- src/lib/adminEventValidation.ts), times already converted to UTC, plus the
-- pin (lat/lng) of the address the sender picked in the form's address
-- check, or nulls; convert uses that pin instead of geocoding again. The
-- sender's name and email live in their own columns, never inside payload,
-- so the payload can be shown or copied without carrying personal data.
-- submitter_email is personal data: stored for review only, never logged,
-- never in an audit row, never on a public page or response.
--
-- flyer_key: the optional flyer in the EVENT_FLYERS bucket, under the
-- `pending.submissions/` prefix. That prefix contains a dot, which the
-- public flyer route's id pattern refuses, so a pending flyer has no public
-- URL at all. On convert the object is copied to the new event's own key.
-- flyer_width / flyer_height: read from the stored file's bytes by the
-- submit route, never client-reported.
--
-- status: pending -> converted (converted_event_id set) or dismissed.
-- Nothing is ever deleted.
--
-- Fresh table, so this is idempotent (IF NOT EXISTS). Production still
-- applies it with `wrangler d1 migrations apply`, never `d1 execute --file`
-- (AGENTS.md "Promotion checklist — D1 migrations").
CREATE TABLE IF NOT EXISTS event_submissions (
  id                  TEXT PRIMARY KEY,
  payload             TEXT NOT NULL,
  submitter_name      TEXT NOT NULL,
  submitter_email     TEXT NOT NULL,
  flyer_key           TEXT,
  flyer_width         INTEGER,
  flyer_height        INTEGER,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','converted','dismissed')),
  converted_event_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at         TEXT,
  reviewed_by         TEXT
);

-- The admin list's one query: WHERE status = 'pending' ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_event_submissions_status ON event_submissions(status, created_at);
