-- migrations/0019_event_flyer.sql
--
-- Issue #760 (Events 4/6, umbrella #156): the flyer image on an event card.
-- The picture itself lives in R2 (bucket binding EVENT_FLYERS); D1 holds
-- only the pointer and what the card needs to reserve its space and name it.
--
-- flyer_key (already in 0018) = the R2 object key, "<eventId>/<uuid>.<ext>".
-- It changes every time the flyer is replaced, which is what makes the
-- public URL safe to cache for a year.
--
-- flyer_width / flyer_height: read from the stored file's own header by the
-- upload route (never client-reported), so the card can hold the exact
-- aspect ratio before the image loads and not jump.
-- flyer_alt / flyer_alt_es: the admin's description for screen readers; the
-- card falls back to the event name when both are empty.
--
-- ADD COLUMN only, all nullable: no existing row or write changes. NOT
-- idempotent (a re-run fails with "duplicate column"), so production applies
-- it with `wrangler d1 migrations apply`, never `d1 execute --file`
-- (AGENTS.md "Promotion checklist — D1 migrations"). The code that reads
-- these columns fails soft until this has been applied.
ALTER TABLE events ADD COLUMN flyer_width INTEGER;
ALTER TABLE events ADD COLUMN flyer_height INTEGER;
ALTER TABLE events ADD COLUMN flyer_alt TEXT;
ALTER TABLE events ADD COLUMN flyer_alt_es TEXT;
