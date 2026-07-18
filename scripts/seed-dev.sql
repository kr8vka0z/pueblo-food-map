-- scripts/seed-dev.sql
--
-- Fake, obviously-test venue data for the STAGING admin D1 database
-- (pueblo-food-map-admin-staging, wrangler.jsonc env.staging.ADMIN_DB) —
-- never applied against the production database (pueblo-food-map-admin).
-- Every id is prefixed 'test-' and every name is prefixed "Test " so no
-- row can be mistaken for a real venue in an admin screenshot or export.
--
-- WHY these 20 rows: dev.pueblofoodmap.com's /admin surface (VenueListView,
-- PublishPanel, SubmissionsReviewView) needs something to render — an empty
-- table shows every "0 venues" / "up to date" empty state and exercises
-- none of the real UI. 15 'published' + 3 'draft' + 2 'archived' covers the
-- three states VenueListView filters on; every category in the schema's
-- CHECK constraint (migrations/0001_init_admin_schema.sql) appears at least
-- twice. Coordinates are scattered near PUEBLO_CENTER (src/data/pueblo-
-- bbox.ts, 38.2544/-104.6091), well inside PUEBLO_COUNTY_BBOX, so nothing
-- here would ever trip the outside_county flag.
--
-- RE-RUNNABLE: deletes every prior 'test-%' row before inserting, so this
-- file can be re-applied after a schema change or to refresh stale seed
-- data without manual cleanup first. Scoped by id prefix (not a bare
-- DELETE FROM venues) so it never touches a real row if one is ever
-- created on staging by hand.
--
-- APPLY:
--   npx wrangler d1 execute pueblo-food-map-admin-staging --remote --env staging --file=scripts/seed-dev.sql
--
-- VERIFY:
--   npx wrangler d1 execute pueblo-food-map-admin-staging --remote --env staging \
--     --command "SELECT status, COUNT(*) FROM venues WHERE id LIKE 'test-%' GROUP BY status;"

DELETE FROM venues WHERE id LIKE 'test-%';

INSERT INTO venues (
  id, name, category, lat, lng, address, hours_weekly,
  accepts_snap, accepts_wic, phone, email, url, notes, operator,
  source, last_verified, status, source_type, outside_county,
  created_by, updated_by, published_at, published_by
) VALUES
  ('test-taqueria-01', 'Test Taqueria', 'meal_site', 38.2601, -104.6112, '101 N Main St, Pueblo, CO 81003', '{"mon":["11:00-19:00"],"tue":["11:00-19:00"],"wed":["11:00-19:00"],"thu":["11:00-19:00"],"fri":["11:00-20:00"]}', 1, 0, '719-555-0101', NULL, NULL, 'Seed data for dev environment testing.', 'Test Operator LLC', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-community-pantry-01', 'Test Community Pantry', 'pantry', 38.2489, -104.6203, '215 W 4th St, Pueblo, CO 81003', '{"tue":["09:00-12:00"],"thu":["09:00-12:00"]}', 1, 1, '719-555-0102', 'pantry@example.test', NULL, 'Seed data for dev environment testing.', 'Test Community Services', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-downtown-grocery-01', 'Test Downtown Grocery', 'grocery', 38.2551, -104.6089, '300 S Union Ave, Pueblo, CO 81003', NULL, 1, 1, '719-555-0103', NULL, 'https://example.test/downtown-grocery', 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-corner-store-01', 'Test Corner Store', 'convenience', 38.2678, -104.5987, '822 E Abriendo Ave, Pueblo, CO 81004', NULL, 0, 0, NULL, NULL, NULL, 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-urban-farm-01', 'Test Urban Farm', 'farm', 38.2412, -104.5921, '1450 Greenhorn Rd, Pueblo, CO 81005', NULL, NULL, NULL, '719-555-0105', NULL, NULL, 'Seed data for dev environment testing.', 'Test Farm Collective', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-community-garden-01', 'Test Community Garden', 'garden', 38.2725, -104.6154, '512 Elizabeth St, Pueblo, CO 81004', NULL, NULL, NULL, NULL, NULL, NULL, 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-edible-park-01', 'Test Edible Park', 'edible_landscape', 38.2503, -104.6301, '700 Goodnight Ave, Pueblo, CO 81004', NULL, NULL, NULL, NULL, NULL, NULL, 'Seed data for dev environment testing.', 'Test Parks Dept', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-soup-kitchen-01', 'Test Soup Kitchen', 'meal_site', 38.2634, -104.6045, '90 W 8th St, Pueblo, CO 81003', '{"mon":["17:00-19:00"],"wed":["17:00-19:00"],"fri":["17:00-19:00"]}', 1, 0, '719-555-0108', NULL, NULL, 'Seed data for dev environment testing.', 'Test Faith Mission', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-neighborhood-pantry-01', 'Test Neighborhood Pantry', 'pantry', 38.2367, -104.6178, '1200 Bonforte Blvd, Pueblo, CO 81001', NULL, 1, 1, '719-555-0109', NULL, NULL, 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-fresh-market-01', 'Test Fresh Market', 'grocery', 38.2842, -104.6267, '2400 N Elizabeth St, Pueblo, CO 81003', NULL, 1, 0, NULL, NULL, 'https://example.test/fresh-market', 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-quick-stop-01', 'Test Quick Stop', 'convenience', 38.2298, -104.5876, '3010 E Northern Ave, Pueblo, CO 81001', NULL, 0, 0, NULL, NULL, NULL, 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-heritage-farm-01', 'Test Heritage Farm', 'farm', 38.2951, -104.5734, '5600 Overton Rd, Pueblo, CO 81006', NULL, NULL, NULL, '719-555-0112', NULL, NULL, 'Seed data for dev environment testing.', 'Test Family Farms', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-victory-garden-01', 'Test Victory Garden', 'garden', 38.2213, -104.6089, '410 W Northern Ave, Pueblo, CO 81004', NULL, NULL, NULL, NULL, NULL, NULL, 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-fruit-tree-grove-01', 'Test Fruit Tree Grove', 'edible_landscape', 38.2469, -104.5945, '89 Riverwalk Way, Pueblo, CO 81003', NULL, NULL, NULL, NULL, NULL, NULL, 'Seed data for dev environment testing.', 'Test Parks Dept', 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-family-meal-site-01', 'Test Family Meal Site', 'meal_site', 38.2586, -104.6234, '640 W 13th St, Pueblo, CO 81003', '{"sat":["12:00-14:00"]}', 1, 1, NULL, NULL, NULL, 'Seed data for dev environment testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'published', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', '2026-07-18T00:00:00.000Z', 'seed-dev@pueblofoodmap.com'),
  ('test-food-bank-annex-01', 'Test Food Bank Annex', 'pantry', 38.2645, -104.5812, '1801 E 4th St, Pueblo, CO 81001', NULL, 1, 1, '719-555-0116', NULL, NULL, 'Seed data for dev environment testing. Draft — not yet reviewed.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'draft', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', NULL, NULL),
  ('test-value-grocery-01', 'Test Value Grocery', 'grocery', 38.2732, -104.5990, '1990 Prairie Ave, Pueblo, CO 81003', NULL, 1, 0, NULL, NULL, NULL, 'Seed data for dev environment testing. Draft — not yet reviewed.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'draft', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', NULL, NULL),
  ('test-gas-and-grab-01', 'Test Gas & Grab', 'convenience', 38.2189, -104.6301, '3300 W Northern Ave, Pueblo, CO 81005', NULL, 0, 0, NULL, NULL, NULL, 'Seed data for dev environment testing. Draft — not yet reviewed.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'draft', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', NULL, NULL),
  ('test-riverside-farm-01', 'Test Riverside Farm', 'farm', 38.2378, -104.5678, '780 Arkansas Riverwalk, Pueblo, CO 81006', NULL, NULL, NULL, NULL, NULL, NULL, 'Seed data for dev environment testing. Archived — closed, superseded by real data during testing.', NULL, 'seed:scripts/seed-dev.sql', '2026-07-18', 'archived', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', NULL, NULL),
  ('test-school-garden-01', 'Test School Garden', 'garden', 38.2811, -104.6412, '450 Baxter Rd, Pueblo, CO 81005', NULL, NULL, NULL, NULL, NULL, NULL, 'Seed data for dev environment testing. Archived — closed, superseded by real data during testing.', 'Test District 60', 'seed:scripts/seed-dev.sql', '2026-07-18', 'archived', 'manual', 0, 'seed-dev@pueblofoodmap.com', 'seed-dev@pueblofoodmap.com', NULL, NULL);
