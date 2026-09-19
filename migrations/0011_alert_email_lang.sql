-- migrations/0011_alert_email_lang.sql
--
-- Blessing Boxes slice 6 follow-up: single-language alert emails. Every
-- box_adopters/alert_subscriptions row now records the UI locale ("en" or
-- "es") the applicant/subscriber was using at signup — src/lib/emailSend.ts's
-- composeEmail() renders every outbound email in ONLY that language,
-- replacing the old bilingual EN-block/ES-block composer. See AGENTS.md's
-- Blessing Boxes slice 6 section for the full rationale.
--
-- `lang` DEFAULTs to 'en' so an existing row (every row inserted before this
-- migration, all of which came from a form the site only ever labeled in
-- whichever locale was active — never persisted) degrades to English, the
-- site's own default locale, rather than a null/undefined value the CHECK
-- constraint would reject.
--
-- NOT IDEMPOTENT — SQLite's ALTER TABLE ... ADD COLUMN has no IF NOT EXISTS
-- form (unlike every CREATE TABLE/INDEX in 0007-0010, which do), so running
-- this file twice against the same database fails on the second run with
-- "duplicate column name: lang". This migration must run EXACTLY ONCE per
-- database. Before running it by hand (e.g. via `d1 execute`), confirm the
-- column doesn't already exist:
--   PRAGMA table_info(box_adopters);
--   PRAGMA table_info(alert_subscriptions);
-- (wrangler's own `d1 migrations apply` ledger already prevents this file
-- from re-applying through the normal migration path — this note is for the
-- same manual-`d1 execute` escape hatch 0007-0010's own headers describe.)

ALTER TABLE box_adopters ADD COLUMN lang TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','es'));

ALTER TABLE alert_subscriptions ADD COLUMN lang TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','es'));
