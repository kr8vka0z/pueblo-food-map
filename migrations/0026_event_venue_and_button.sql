-- migrations/0026_event_venue_and_button.sql
--
-- Issue #882 (event card redesign, umbrella #156): the venue's name on the
-- card and the wording of the card's action button.
--
-- venue_name: optional, shown in bold above the address under "Where". The
-- admin form fills it from the linked place (venue_id) when it is empty; it
-- is the event's own copy, like address/lat/lng, so renaming the place later
-- does not change a past event.
--
-- link_label: what the action button says for link_url. One of website,
-- signup, tickets, rsvp, volunteer, donate, custom; NULL reads as website, so
-- every event saved before this migration shows "Visit website". Checked by
-- adminEventValidation.ts (the trust boundary), not a CHECK constraint: adding
-- a wording later would otherwise need a table rebuild.
-- link_label_custom / link_label_custom_es: the admin's own words, used only
-- when link_label = 'custom' (Spanish falls back to English when blank).
--
-- ADD COLUMN only, all nullable: no existing row or write changes. NOT
-- idempotent (a re-run fails with "duplicate column"), so production applies
-- it with `wrangler d1 migrations apply`, never `d1 execute --file`
-- (AGENTS.md "Promotion checklist — D1 migrations"). The public event reads
-- select these columns, so this must reach a database before the code does.
ALTER TABLE events ADD COLUMN venue_name TEXT;
ALTER TABLE events ADD COLUMN link_label TEXT;
ALTER TABLE events ADD COLUMN link_label_custom TEXT;
ALTER TABLE events ADD COLUMN link_label_custom_es TEXT;
