-- migrations/0013_strip_plentiful_meta_notes.sql
--
-- Cleans up 34 venues.notes rows Plentiful's scraper wrote before
-- scripts/scrape-plentiful.py stopped copying the page's <meta
-- name="description"> into notes (fix/venue-page-phone-notes, same PR).
-- That meta description is Plentiful's own SEO summary, English-only, and
-- just restates fields the app already shows elsewhere ("{name}. in
-- Pueblo, CO." plus an optional "Phone: (...)." and/or "Hours and
-- directions available.") — pure filler that leaked onto /venue/<id>
-- untranslated, most visibly in Spanish mode.
--
-- `notes` is NOT a refresh-pipeline source-owned field (see
-- scripts/refresh/diffEngine.ts's SOURCE_OWNED_FIELDS) — the scraper fix
-- alone never touches these already-scraped D1 rows, hence this one-time
-- data migration. Each UPDATE strips ONLY the known boilerplate clauses and
-- keeps anything else verbatim — most rows have nothing left and go to
-- NULL, but a few (e.g. Lynn Gardens Baptist Church) carry a real
-- recurrence sentence appended after the boilerplate ("Open the 2nd
-- Thursday, 4th Thursday of each month, 11:00 AM – 12:45 PM.") which this
-- migration KEEPS — issue #400 covers localizing that sentence later, not
-- this migration.
--
-- Every statement is GUARDED on `id = ... AND notes = '<exact current
-- text>'`, generated from src/data/published-venues.ts by a throwaway
-- script (not committed — see the coder session that authored this file).
-- IDEMPOTENT and safe to re-run: once a row's notes no longer match the
-- captured-at-generation-time text (because this migration already ran, or
-- an admin hand-edited the row since), its guard fails and that UPDATE is a
-- silent no-op. Safe on staging and prod. Data-only — no schema change.
--
-- Verify after applying: `SELECT id, notes FROM venues WHERE notes LIKE
-- '%in Pueblo, CO.%';` should return zero rows (aside from any venue an
-- admin has since given new notes containing that literal phrase by
-- coincidence).
--
-- After this runs against PRODUCTION, an admin must click Publish
-- (POST /api/admin/publish) — src/data/published-venues.ts is a snapshot
-- regenerated from D1, not read live, so the public page keeps showing the
-- old notes until the next publish (see AGENTS.md's "Admin panel" section).

UPDATE venues SET notes = NULL WHERE id = 'plentiful-agape-fellowship-church-925bb133' AND notes = 'Agape Fellowship Church. in Pueblo, CO. Hours and directions available.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-assistance-league-pueblo-services-7754e3e3' AND notes = 'Assistance League-Pueblo Services. in Pueblo, CO. Phone: (719) 544-1528.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-bessemer-mobile-food-pantry-58874d63' AND notes = 'Bessemer Mobile Food Pantry. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-bgcc-pueblo-pantry-plentiful-4069' AND notes = 'BGCC Pueblo Pantry. in Pueblo, CO. Phone: (719) 470-1004.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-care-and-share-food-bank-for-southern-colorado-main-location-4a362e63' AND notes = 'Care and Share Food Bank for Southern Colorado - Main Location. in Pueblo, CO. Hours and directions available.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-center-toward-self-reliance-1c29edf8' AND notes = 'Center Toward Self-Reliance. in Pueblo, CO. Phone: (719) 546-1271.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-colorado-division-of-housing-food-distribution-center-5448eb74' AND notes = 'Colorado Division Of Housing - Food Distribution Center. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-compassion-care-pueblo-caba5d25' AND notes = 'Compassion Care- Pueblo. in Pueblo, CO. Phone: (719) 423-9138.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-cornerstone-assembly-of-god-pueblo-e68b65ea' AND notes = 'Cornerstone Assembly of God Pueblo. in Pueblo, CO. Phone: (719) 542-4133.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-edible-planet-food-distribution-center-71b7a0fe' AND notes = 'Edible Planet - Food Distribution Center. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-eva-r-baca-elementary-school-52dc3901' AND notes = 'Eva R Baca Elementary School. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-first-congregational-united-church-of-christ-pueblo-plentiful-4247' AND notes = 'First Congregational United Church of Christ- Pueblo. in Pueblo, CO. Phone: (719) 544-1892.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-foodbank-of-eastside-neighbor-s-council-fde35382' AND notes = 'Foodbank of Eastside Neighbor''s Council. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-full-force-ministries-food-pantry-cf58c38d' AND notes = 'Full Force Ministries Food Pantry. in Pueblo, CO.';
UPDATE venues SET notes = 'Open the 2nd Thursday, 4th Thursday of each month, 11:00 AM – 12:45 PM.' WHERE id = 'plentiful-lynn-gardens-baptist-church-21831a26' AND notes = 'Lynn Gardens Baptist Church. in Pueblo, CO. Hours and directions available. Open the 2nd Thursday, 4th Thursday of each month, 11:00 AM – 12:45 PM.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-minnequa-vfw-post-3641-f69cfb98' AND notes = 'Minnequa VFW Post 3641. in Pueblo, CO. Phone: (719) 406-5247. Hours and directions available.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-mt-carmel-veteran-center-of-pueblo-76b970d4' AND notes = 'Mt Carmel Veteran Center of Pueblo. in Pueblo, CO. Phone: (719) 309-4719.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-new-heights-baptist-church-35755919' AND notes = 'New Heights Baptist Church. in Pueblo, CO. Hours and directions available.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-praise-assembly-of-god-food-pantry-2118f856' AND notes = 'Praise Assembly of God - Food Pantry. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-pueblo-community-college-mobile-pantry-stop-e0de86e7' AND notes = 'Pueblo Community College - Mobile Pantry Stop. in Pueblo, CO. Hours and directions available.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-pueblo-community-college-school-pantry-cdc32119' AND notes = 'Pueblo Community College - School Pantry. in Pueblo, CO. Hours and directions available.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-pueblo-community-soup-kitchen-plentiful-3195' AND notes = 'Pueblo Community Soup Kitchen. in Pueblo, CO. Phone: (719) 545-6540.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-pueblo-cooperative-care-center-plentiful-3140' AND notes = 'Pueblo Cooperative Care Center. in Pueblo, CO. Phone: (719) 543-7484.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-pueblo-county-usda-food-distribution-plentiful-3149' AND notes = 'Pueblo County USDA Food Distribution. in Pueblo, CO. Phone: (719) 583-6199.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-pueblo-united-3d8ce244' AND notes = 'Pueblo United. in Pueblo, CO. Phone: (719) 696-8586.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-rmser-empowerment-center-plentiful-3072' AND notes = 'RMSER Empowerment Center. in Pueblo, CO. Phone: (800) 748-2074.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-salvation-army-pueblo-plentiful-3190' AND notes = 'Salvation Army- Pueblo. in Pueblo, CO. Phone: (719) 543-3656.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-senior-resource-development-agency-pueblo-inc-plentiful-3197' AND notes = 'Senior Resource Development Agency, Pueblo Inc.. in Pueblo, CO. Phone: (719) 543-0100.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-senior-towers-mobile-market-19a75a56' AND notes = 'Senior Towers - Mobile Market. in Pueblo, CO. Phone: (719) 296-6995.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-st-anne-s-catholic-church-37512aae' AND notes = 'St. Anne''s Catholic Church. in Pueblo, CO.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-steel-city-fellowship-2d4c6ff3' AND notes = 'Steel City Fellowship. in Pueblo, CO. Phone: (719) 350-5001.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-the-avenue-church-plentiful-3200' AND notes = 'The Avenue Church. in Pueblo, CO. Phone: (719) 561-1512.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-the-pueblo-shelter-safeside-recovery-plentiful-4265' AND notes = 'The Pueblo Shelter/SafeSide Recovery. in Pueblo, CO. Phone: (719) 924-8413.';
UPDATE venues SET notes = NULL WHERE id = 'plentiful-victory-life-ministries-a24917c0' AND notes = 'Victory Life Ministries. in Pueblo, CO.';
