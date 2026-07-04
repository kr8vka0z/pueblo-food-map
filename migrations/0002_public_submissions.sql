-- migrations/0002_public_submissions.sql
--
-- public_submissions: a durable, reviewable record of every accepted public
-- "suggest a venue" (POST /suggest/submit) and "report a closure" (POST
-- /report/submit) form submission (#258). Before this migration, both forms
-- ONLY sent an email to a pueblofoodmap.com inbox -- a submission that
-- arrived while nobody was watching that inbox left no other trace. This
-- table gives every accepted submission a durable, queryable row alongside
-- the (unchanged) email -- the email stays the reliable incumbent channel;
-- this table is the new best-effort durable record.
--
-- Written by the two PUBLIC, unauthenticated submit routes themselves, via
-- the direct ADMIN_DB D1 binding (getCloudflareContext().env.ADMIN_DB) --
-- deliberately NOT via getAdminDb() (src/lib/adminDb.ts), which gates on a
-- verified Cloudflare Access identity and exists for AUTHENTICATED
-- /admin/** routes only (AGENTS.md "Admin authentication"). A public route
-- must never be routed through that admin-only choke point.
--
-- The admin review UI that will read and act on these rows (approve ->
-- create/edit the target venue, reject -> dismiss) is a SEPARATE, later
-- slice (#259). This migration and the two write paths are the only things
-- #258 ships -- nothing in the app reads from this table yet.
CREATE TABLE public_submissions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  kind              TEXT NOT NULL CHECK (kind IN ('new_venue','closure')),
  payload           TEXT NOT NULL,   -- JSON blob of the fields the submitter
                                       -- sent -- the same fields the
                                       -- outgoing Resend email already
                                       -- includes. Kept as one opaque blob
                                       -- rather than a column per field
                                       -- since 'new_venue' and 'closure'
                                       -- submissions carry different field
                                       -- shapes; #259's review UI is what
                                       -- will need to interpret this shape.
  target_venue_id   TEXT,             -- NULL for a 'new_venue' suggestion
                                       -- (no existing venue to target); for
                                       -- a 'closure' report, the reported
                                       -- venue's `venues.id` (already
                                       -- validated to exist by
                                       -- report/submit/route.ts before this
                                       -- row is ever written). Deliberately
                                       -- NOT a FOREIGN KEY -- a venue can
                                       -- later be archived or (per the
                                       -- `venues.id` comment, migrations/
                                       -- 0001) have its id scheme change,
                                       -- and a historical submission record
                                       -- should survive that either way.
  submitter_email   TEXT,             -- nullable: /suggest/submit requires
                                       -- an email, but /report/submit's
                                       -- contact email is optional.
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_by       TEXT,             -- verified Access JWT email claim of
                                       -- the admin who actioned this row --
                                       -- same convention as
                                       -- change_proposals.reviewed_by
                                       -- (migrations/0001). Written by the
                                       -- #259 review UI, not by this
                                       -- migration or #258's write paths.
  reviewed_at       TEXT,
  review_reason     TEXT              -- optional free-text note an admin
                                       -- leaves on approve/reject. #259 owns
                                       -- writing this column.
);

CREATE INDEX idx_public_submissions_status ON public_submissions(status);
CREATE INDEX idx_public_submissions_kind   ON public_submissions(kind);
