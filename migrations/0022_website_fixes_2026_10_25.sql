-- migrations/0022_website_fixes_2026_10_25.sql
--
-- Venue Data Rebuild, step 0 (atlas-kb "PFM Venue Data Rebuild Plan
-- 2026-10-25", "Confirmed fixes"): loads the pantry fixes from the
-- 2026-10-25 trial into the review queue as PENDING proposals from source
-- 'website' (needs 0020). Nothing here changes `venues`: each one waits for
-- Kyle's Approve or Reject like any refresh proposal. Friendly Harbor and
-- Edible Planet are deliberately absent (plan: "Looked wrong, but no change").
--
-- Each proposal: `before` = the venue's CURRENT values, read at migration
-- time (so the stale-apply guard catches any edit made before approval);
-- `after` = the fix plus last_verified 2026-10-25 (the day it was checked
-- against the cited page); meta = { source_url, summary }. "Not a public
-- pantry" fixes are removals (archive on approve). Details our fields can't
-- hold ("closed to applications", the pet pantry) go in `notes`.
-- diff_hash = computeDiffHash(after, fields_changed) from
-- scripts/refresh/diffEngine.ts, precomputed (SQLite has no SHA-256) and
-- re-checked by src/lib/venueDataRebuild.sql.test.ts.
--
-- The plan's "Care and Share (Pueblo office): phone 719-296-6995" row has no
-- venue of its own: the only Care and Share Pueblo row is the Main Location,
-- which is proposed for removal below, and Senior Towers already shows that
-- number. So no phone proposal is written for it.
--
-- Idempotent and safe on any database: each INSERT skips a venue that is
-- missing, archived or a blessing box, and any venue that already has a
-- proposal from this run_id.

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'remove',
  json_object('before', json_object('id', v.id, 'name', v.name), 'after', NULL, 'fields_changed', json('[]'), 'meta', json('{"source_url":"https://careandshare.org/contact/","summary":"Care and Share''s contact page says this location does not give out food directly to the public. The map should not send people there for food."}')),
  'b4bd86847b0324bb47066b64519b651bdafc6c4d11b1e9de0151e34d1cf64b83', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-care-and-share-food-bank-for-southern-colorado-main-location-4a362e63' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('category', v.category, 'hours_weekly', json(v.hours_weekly), 'last_verified', v.last_verified), 'after', json('{"category":"meal_site","hours_weekly":{"mon":["4:30 PM - 5:00 PM"],"tue":["4:30 PM - 5:00 PM"],"wed":["4:30 PM - 5:00 PM"],"thu":["4:30 PM - 5:00 PM"],"fri":["4:30 PM - 5:00 PM"],"sat":["4:30 PM - 5:00 PM"],"sun":["4:30 PM - 5:00 PM"]},"last_verified":"2026-10-25"}'), 'fields_changed', json('["category","hours_weekly","last_verified"]'), 'meta', json('{"source_url":"https://thepuebloshelter.org/","summary":"The shelter''s website describes a daily community meal at 4:30 PM, not a grocery pantry, and shows no Friday 2-4 PM window. The 5:00 PM end time is kept from the current listing."}')),
  '5271ddec2a4706461add57b28702a8006b18dec348f997c1bd9a19218d4e1f2c', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-the-pueblo-shelter-safeside-recovery-plentiful-4265' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'remove',
  json_object('before', json_object('id', v.id, 'name', v.name), 'after', NULL, 'fields_changed', json('[]'), 'meta', json('{"source_url":"https://careandshare.org/childrens-nutrition/","summary":"Care and Share lists this school as a Send Hunger Packing site: weekend food packs for its own enrolled students, not open to the public."}')),
  'b4bd86847b0324bb47066b64519b651bdafc6c4d11b1e9de0151e34d1cf64b83', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-eva-r-baca-elementary-school-52dc3901' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('hours_weekly', json(v.hours_weekly), 'notes', v.notes, 'last_verified', v.last_verified), 'after', json('{"hours_weekly":{"mon":["1:00 PM - 3:30 PM"],"tue":["1:00 PM - 3:30 PM"],"wed":["1:00 PM - 3:30 PM"],"fri":["1:00 PM - 3:30 PM"]},"notes":"Food pantry by appointment. Currently closed to new applications.","last_verified":"2026-10-25"}'), 'fields_changed', json('["hours_weekly","notes","last_verified"]'), 'meta', json('{"source_url":"https://cfdpueblo.org/food-pantry/","summary":"The pantry list gives pantry hours of Monday, Tuesday, Wednesday and Friday, 1:00-3:30 PM, by appointment, and says it is currently closed to applications. The map showed the office hours (weekdays 8:00-4:30)."}')),
  '7c0aa1d041dbbb1c43cc92ecafc4f7363d4add389c2e591ad3c622a5f69dfb43', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-center-toward-self-reliance-1c29edf8' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('address', v.address, 'hours_weekly', json(v.hours_weekly), 'notes', v.notes, 'last_verified', v.last_verified), 'after', json('{"address":"623 E 4th St, Pueblo, CO 81001","hours_weekly":{"mon":["9:00 AM - 5:00 PM"],"wed":["9:00 AM - 5:00 PM"],"fri":["9:00 AM - 5:00 PM"]},"notes":"Closed the 1st and 3rd Monday of each month.","last_verified":"2026-10-25"}'), 'fields_changed', json('["address","hours_weekly","notes","last_verified"]'), 'meta', json('{"source_url":"https://pueblounited719062.wixsite.com/pueblounited","summary":"Pueblo United''s own site and the cfdpueblo.org pantry list give the address as 623 E 4th St and hours of Monday, Wednesday and Friday, 9 AM-5 PM, closed the 1st and 3rd Mondays. The phone already matches. The map pin is not moved by this change: check it after approving."}')),
  'f0edaf0ad36a7ff499f5395c445ab60e83844552a7ed8cc57ce85cf1c9dad12f', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-pueblo-united-3d8ce244' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('phone', v.phone, 'last_verified', v.last_verified), 'after', json('{"phone":"(719) 542-1411","last_verified":"2026-10-25"}'), 'fields_changed', json('["phone","last_verified"]'), 'meta', json('{"source_url":"https://agapepueblo.com/contact","summary":"The church''s contact page lists this phone number; the map had none."}')),
  '1289cffeefa8db4216b89b5e2a6a7afd6d78a43a444279dacd29ba24714227b5', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-agape-fellowship-church-925bb133' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('phone', v.phone, 'last_verified', v.last_verified), 'after', json('{"phone":"(719) 647-7273","last_verified":"2026-10-25"}'), 'fields_changed', json('["phone","last_verified"]'), 'meta', json('{"source_url":"https://newheightspueblo.org/contact-us","summary":"The church''s contact page lists this phone number; the map had none."}')),
  '2fcb3ff3b9b37e33fafe2004970eff519e364d82844423881526df14e37bc083', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-new-heights-baptist-church-35755919' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('notes', v.notes, 'last_verified', v.last_verified), 'after', json('{"notes":"Bring ID and your own bags. The Colorado Pet Pantry also gives out pet food here on the last Thursday of the month, 11 AM-1 PM.","last_verified":"2026-10-25"}'), 'fields_changed', json('["notes","last_verified"]'), 'meta', json('{"source_url":"https://coloradopetpantry.org/","summary":"foodpantries.org says ID and bags are required, and the Colorado Pet Pantry lists a pet food distribution here on the last Thursday, 11 AM-1 PM."}')),
  'e6ba22c7285dbe25520eeb14cae5326eef7c22a135d84e6fcfa0806d765e14d1', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-lynn-gardens-baptist-church-21831a26' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);

INSERT INTO change_proposals (source, target_venue_id, change_type, proposed_diff, diff_hash, run_id)
SELECT 'website', v.id, 'update',
  json_object('before', json_object('address', v.address, 'last_verified', v.last_verified), 'after', json('{"address":"1925 E. Orman Ave., Suite 148, Pueblo, CO 81004","last_verified":"2026-10-25"}'), 'fields_changed', json('["address","last_verified"]'), 'meta', json('{"source_url":"https://www.veteranscenter.org/locations/","summary":"The center''s locations page gives the address with Suite 148."}')),
  '1e028aad32d255fa969cd09958bb8bb1890079743f861031efaf0c9e4d219a00', 'website-fixes-2026-10-25'
FROM venues v
WHERE v.id = 'plentiful-mt-carmel-veteran-center-of-pueblo-76b970d4' AND v.status != 'archived' AND v.category != 'blessing_box'
  AND NOT EXISTS (SELECT 1 FROM change_proposals c WHERE c.run_id = 'website-fixes-2026-10-25' AND c.target_venue_id = v.id);
