-- migrations/0006_convert_routt_blessing_box.sql
--
-- Closes a production-promotion gap found in PR #470's review: the real
-- Routt St box conversion (category flip + blessing_boxes row) was done
-- BY HAND on staging D1 — it existed in no committed file. If `dev` were
-- promoted to `main` before someone hand-ran that same conversion on
-- production, the box pin would vanish from the live map (still showing
-- as a plain 'pantry' with no blessing_boxes row) AND the
-- next.config.ts /venue/<id> -> /box/<id> redirect (unconditional, ships
-- on deploy regardless of D1 state) would 308 a real indexed URL into a
-- guaranteed 404 — no /box/<id> page exists until the row is converted.
-- excludeBlessingBoxes() (scripts/refresh/diffEngine.ts) also can't
-- protect this venue from the monthly refresh cron until its row actually
-- carries category='blessing_box', so a stale-category production row is
-- also a live "re-propose Routt as a plain pantry change" risk in that
-- window.
--
-- Does NOT touch 0005 (already applied to staging + local) — this is a
-- separate, later migration carrying only a DATA change, no schema
-- change, following the same "schema in one migration, later data fixups
-- in their own migration" shape nothing else in this repo needed until
-- now (every prior migration was schema-only).
--
-- Idempotent and order-independent after 0005, on ANY database:
--   - The UPDATE's own WHERE clause (id match AND category <> the target)
--     makes re-running it a no-op once already converted — no separate
--     existence check needed, SQLite UPDATE simply matches 0 rows if the
--     venue id is absent (a fresh/empty D1) or already converted.
--   - INSERT OR IGNORE ... SELECT (blessing_boxes.venue_id is its PRIMARY
--     KEY) means a second run never fails on the now-existing row, and the
--     SELECT ... WHERE id = ... source means a database where the venue is
--     entirely absent (a fresh/empty D1) inserts NOTHING — not an orphan
--     blessing_boxes row with no matching venues.id (there is no declared
--     FK here, per 0005's own header, but an orphan row would still be
--     meaningless, so this doesn't create one on a DB that never had the
--     venue to begin with).
--
-- Only this one venue — no practice/seed data, no other rows. D1 runs a
-- migration file as one implicit batch; no explicit BEGIN/COMMIT (every
-- prior migration in this repo already establishes D1 rejects hand-written
-- transaction control).
--
-- lat/lng/address/phone/url/notes are UNTOUCHED — still the real
-- Plentiful-sourced data already on the row; only category flips and the
-- blessing_boxes row is created (empty — no real host info known yet, an
-- admin fills it in later via the edit screen). Matches exactly what was
-- applied by hand to staging D1 2026-09-17.

UPDATE venues
SET category = 'blessing_box',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    updated_by = 'blessing-boxes-slice-1-conversion'
WHERE id = 'plentiful-blessing-box-216-w-routt-plentiful-1454'
  AND category <> 'blessing_box';

INSERT OR IGNORE INTO blessing_boxes (venue_id)
SELECT id FROM venues WHERE id = 'plentiful-blessing-box-216-w-routt-plentiful-1454';
