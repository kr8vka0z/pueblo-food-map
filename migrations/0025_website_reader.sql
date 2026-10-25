-- migrations/0025_website_reader.sql
--
-- Venue Data Rebuild step 3 (atlas-kb "PFM Venue Data Rebuild Plan
-- 2026-10-25"): the venue website reader (scripts/refresh/website.ts).
--
-- 1. page_fingerprints: one row per page the reader only re-reads with
--    Gemini when its text changes (the Pueblo Food Project gardens page).
--    sha256 of the page's normalized visible text, written in the same batch
--    as that run's proposals, so a failed write leaves the old fingerprint
--    and the next run reads the page again.
--
-- 2. A seeded rejection for Friendly Harbor's known-stale website value.
--    The venue told us (feedback form, 2026-10-12; pinned by 0021) its
--    public pantry is the LAST WEDNESDAY; its own website still says the
--    last Friday, 1-3 PM. The plan says that value must never reach Kyle's
--    queue. The reader drops any field whose value matches a rejected
--    website proposal for the same venue (rejectedFieldValues in
--    website.ts: field-level, so the Friday stays silent even bundled with
--    another change), so one rejected row holding exactly what the reader
--    produces does it — with no new mechanism. Any OTHER value from the
--    site (e.g. "2nd Tuesday") still goes to review, with the pin beside it.
--    `after.hours_irregular` is the reader's canonical form (canonicalIrregular),
--    and diff_hash = computeDiffHash(after, fields_changed) for that exact
--    proposal, precomputed (SQLite has no SHA-256) and re-checked by
--    src/lib/websiteReader.sql.test.ts. run_id 'venue-pin-seeds-0025' keeps
--    the row out of the automatic switch's count (src/lib/sourceSwitch.ts).
--    Production id only, like 0021's pin: staging's copy of Friendly Harbor
--    has a different id.
--
-- Idempotent (IF NOT EXISTS / NOT EXISTS). Apply only via
-- `wrangler d1 migrations apply`.

CREATE TABLE IF NOT EXISTS page_fingerprints (
  url        TEXT PRIMARY KEY,
  sha256     TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, status, reviewed_by, reviewed_at)
SELECT 'website', v.id, 'update',
  json_object(
    'before', json_object('hours_irregular', v.hours_irregular, 'last_verified', v.last_verified),
    'after', json_object('hours_irregular', '[{"ordinal":"last","recurrence":"monthly_ordinal","slots":["13:00-15:00"],"weekday":"fri"}]', 'last_verified', '2026-10-12'),
    'fields_changed', json('["hours_irregular","last_verified"]'),
    'meta', json('{"source_url":"https://friendlyharborpueblo.org/","summary":"Seeded rejection: the website says the last Friday, but the venue told us on 2026-10-12 it is the last Wednesday (pinned). Keeps the stale website value out of the queue."}')
  ),
  'c1091557ae1be784f48526e8ce944420d45eaa4593373135d6c019fe13d480b6',
  'venue-pin-seeds-0025', 'rejected', 'migration-0025', '2026-10-12T00:00:00.000Z'
FROM venues v
WHERE v.id = 'manual-f3d3712c-caf1-40a0-a3cd-b3dc38e14c00'
  AND NOT EXISTS (
    SELECT 1 FROM change_proposals c WHERE c.run_id = 'venue-pin-seeds-0025' AND c.target_venue_id = v.id
  );
