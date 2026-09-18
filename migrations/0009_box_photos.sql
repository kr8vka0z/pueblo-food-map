-- migrations/0009_box_photos.sql
--
-- Blessing Boxes slice 5 (atlas-kb/projects/Pueblo Food Map/Blessing Boxes
-- Build Plan.md, "Slice 5 — Photos"). One new table, no changes to any
-- existing table — same "no rebuild recipe needed" shape as 0007/0008.
--
-- One row per uploaded photo. The actual JPEG bytes live in R2
-- (BOX_PHOTOS binding, wrangler.jsonc) at `r2_key` — this table is metadata
-- only, same split every other binary-ish asset in this app avoids (there
-- is no precedent to follow; this is the first R2 use in the repo).
--
-- PRIVACY — no name, no email, no IP address, ever, same rule 0007
-- established for box_checkins: there is no column here capable of holding
-- any of those. EXIF/location metadata is stripped from the JPEG bytes
-- themselves before the R2 write (src/lib/jpegSegments.ts), server-side —
-- never trusted to have been stripped client-side alone.
--
-- `checkin_id` is nullable and, like `venue_id`, a plain TEXT/INTEGER
-- column matching box_checkins.id BY CONVENTION, no declared FOREIGN KEY —
-- same convention this schema already uses throughout (blessing_boxes.
-- venue_id, box_checkins.venue_id). Set only when a photo was attached to a
-- check-in at upload time (BoxCheckinPanel's "filled" note form, or the
-- dedicated "Add a photo" choice tied to that same submit) — the upload
-- route validates the referenced check-in belongs to THIS box before
-- storing the link, so a photo can never be attached to another box's
-- check-in.
--
-- `status` starts 'pending' on every insert (moderation-required, same
-- posture public_submissions/change_proposals already use) and moves to
-- 'approved'/'rejected' only via an admin action (POST /api/admin/
-- box-photos/[id]/approve|reject), or to 'flagged' via the public
-- "Report this photo" action (POST /api/public/box-photos/[id]/flag) —
-- flagging hides a photo from the public immediately, pending re-review;
-- see src/app/api/admin/box-photos/[id]/approve/route.ts's own header for
-- why re-approving a flagged photo is allowed (flag_count is kept as
-- history, not reset).
--
-- `width`/`height`/`bytes` are read from the JPEG itself server-side
-- (src/lib/jpegSegments.ts's readJpegDimensions), not trusted from the
-- client — a client-reported size would be trivially spoofable and isn't
-- needed for anything security-sensitive here, but storing the real values
-- costs nothing extra and avoids ever displaying a wrong dimension.
--
-- Applied to STAGING (pueblo-food-map-admin-staging) and local dev only for
-- this slice — production is a later, explicit, Kyle-gated step, same
-- convention as every migration since 0001 (see AGENTS.md "Blessing Boxes
-- — promotion checklist").
--
-- IDEMPOTENCY — every CREATE below uses IF NOT EXISTS, same convention
-- 0007/0008 established: safe to re-run by hand via `d1 execute` even
-- though wrangler's own migrations ledger already prevents this file from
-- re-applying through the normal `d1 migrations apply` path.

CREATE TABLE IF NOT EXISTS box_photos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  venue_id      TEXT NOT NULL,
  checkin_id    INTEGER,          -- nullable — box_checkins.id, only when uploaded alongside a check-in
  r2_key        TEXT NOT NULL,    -- BOX_PHOTOS object key: box-photos/<venueId>/<uuid>.jpg
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged')),
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  bytes         INTEGER NOT NULL,
  flag_count    INTEGER NOT NULL DEFAULT 0,
  reviewed_by   TEXT,             -- admin email (Better Auth identity), set only once an admin has acted
  reviewed_at   TEXT,
  review_reason TEXT,             -- optional admin-entered reject reason
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Two access shapes this schema needs to serve fast: "every pending/flagged
-- photo, newest first" (the admin review queue) and "the most recent
-- APPROVED photo for one or many boxes" (the public list endpoint's
-- latestPhoto field, and the history page's full approved-photo grid).
CREATE INDEX IF NOT EXISTS idx_box_photos_venue_status_created ON box_photos(venue_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_box_photos_status_created ON box_photos(status, created_at);
