-- scripts/admin-preview/seed-preview.sql — made-up rows for the LOCAL admin preview only (never staging, never
-- production; start.sh only ever runs it with `wrangler d1 execute --local --persist-to` the preview's own
-- store). Not a migration: it sits outside migrations/, so no migration tool picks it up.
-- Loaded by start.sh after scripts/seed-dev.sql (which gives the 'test-' places) and the generated
-- live-venues.sql (gen-live-venues.ts), then seed-session.sh adds the made-up admin's sign-in rows.
-- Every name says "Preview" or "Test", emails are example.org / example.com, phones are 719-555-01xx,
-- IPs are documentation ranges (203.0.113.x, 198.51.100.x). Dates are relative to "now" so box health,
-- the 8-week chart and the 30-day Activity window always have something in them.
--
-- Runs once per start into an EMPTY store (start.sh recreates it), so it deletes nothing first. Text ids start
-- with 'pv-'; integer ids use the reserved range 900000-900999 (those tables have AUTOINCREMENT ids, so a text
-- prefix isn't possible). WHY fixed ids: selfcheck.sh and the image keys in start.sh point at known rows, and
-- the range stays clear of seed-dev.sql's low ids.
-- Proposal 900099 is SACRIFICIAL: selfcheck.sh rejects it to prove an admin write passes the origin check.

-- ── Places: one extra draft and one archived-after-publish (counts as "removed" on the Publish bar) ──
INSERT INTO venues (id, name, category, lat, lng, address, hours_weekly, accepts_snap, accepts_wic, phone, email, url, notes, operator, source, last_verified, status, source_type, outside_county, created_at, created_by, updated_at, updated_by, published_at, published_by) VALUES
  ('pv-draft-pantry', 'Preview Eastside Pantry (made up)', 'pantry', 38.2655, -104.5901, '1500 E 8th St, Pueblo, CO 81001', '{"wed":["10:00-13:00"]}', 1, 0, '719-555-0141', NULL, NULL, 'Made-up draft for the admin preview.', 'Preview Helpers', 'preview-seed', date('now','-3 days'), 'draft', 'manual', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), 'dana@example.org', NULL, NULL),
  ('pv-archived-market', 'Preview Corner Market (made up, closed)', 'grocery', 38.2442, -104.6150, '900 S Santa Fe Ave, Pueblo, CO 81006', NULL, 1, 1, '719-555-0142', NULL, NULL, 'Made-up place archived after its last publish.', NULL, 'preview-seed', date('now','-40 days'), 'archived', 'manual', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now','-90 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-16 days'), 'dana@example.org');

-- ── Blessing boxes: two of each health status (OK, Low, Empty, Problem, Quiet) plus one removed ──
INSERT INTO venues (id, name, category, lat, lng, address, notes, source, last_verified, status, source_type, outside_county, created_by, updated_by) VALUES
  ('pv-box-ok-1',      'Preview Box — Elm Street Church',   'blessing_box', 38.2701, -104.6203, '101 Elm St, Pueblo, CO 81004',        'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-ok-2',      'Preview Box — Library Corner',      'blessing_box', 38.2588, -104.6077, '220 W 5th St, Pueblo, CO 81003',      'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-low-1',     'Preview Box — Mesa Park',           'blessing_box', 38.2433, -104.6312, '330 Mesa Ave, Pueblo, CO 81004',      'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-low-2',     'Preview Box — Bluebird Lane',       'blessing_box', 38.2899, -104.6011, '45 Bluebird Ln, Pueblo, CO 81008',    'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-empty-1',   'Preview Box — Fire Station 9',      'blessing_box', 38.2312, -104.6055, '900 Lakeview Ave, Pueblo, CO 81005',  'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-empty-2',   'Preview Box — Union Depot Walk',    'blessing_box', 38.2667, -104.6155, '12 Union Ave, Pueblo, CO 81003',      'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-problem-1', 'Preview Box — Riverside Trailhead', 'blessing_box', 38.2522, -104.5933, '600 Riverwalk Dr, Pueblo, CO 81003',  'Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-problem-2', 'Preview Box — Bessemer Grocery',    'blessing_box', 38.2398, -104.6201, '1200 E Abriendo Ave, Pueblo, CO 81004','Made-up box.', 'preview-seed', date('now','-10 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-quiet-1',   'Preview Box — Old Mill Road',       'blessing_box', 38.3011, -104.5822, '77 Old Mill Rd, Pueblo, CO 81008',    'Made-up box.', 'preview-seed', date('now','-50 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-quiet-2',   'Preview Box — New School Yard',     'blessing_box', 38.2755, -104.6455, '450 Prairie Ave, Pueblo, CO 81005',   'Made-up box, no reports yet.', 'preview-seed', date('now','-5 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org'),
  ('pv-box-removed',   'Preview Box — Taken Down',          'blessing_box', 38.2600, -104.6000, '5 Gone St, Pueblo, CO 81001',         'Made-up box, no longer in service.', 'preview-seed', date('now','-90 days'), 'published', 'manual', 0, 'dana@example.org', 'dana@example.org');

INSERT INTO blessing_boxes (venue_id, host_name, host_note, host_contact, most_needed, installed_on, removed_on) VALUES
  ('pv-box-ok-1',      'Elm Street Church (made up)', 'Take what you need, leave what you can.', 'host.one@example.org, 719-555-0151', 'canned protein, diapers', date('now','-200 days'), NULL),
  ('pv-box-ok-2',      'Library Friends (made up)',   'Books welcome too.',                       'host.two@example.org',               'cereal, peanut butter',  date('now','-150 days'), NULL),
  ('pv-box-low-1',     'Mesa Neighbors (made up)',    NULL,                                       '719-555-0153',                       'hygiene items',          date('now','-120 days'), NULL),
  ('pv-box-low-2',     'Bluebird Block Club (made up)', 'Stocked Sundays.',                       'host.four@example.org',              NULL,                     date('now','-100 days'), NULL),
  ('pv-box-empty-1',   'Station 9 Crew (made up)',    NULL,                                       'host.five@example.org',              'canned food',            date('now','-300 days'), NULL),
  ('pv-box-empty-2',   'Depot Walkers (made up)',     NULL,                                       NULL,                                 NULL,                     date('now','-80 days'),  NULL),
  ('pv-box-problem-1', 'Trail Friends (made up)',     'Please keep the door latched.',            'host.seven@example.org',             NULL,                     date('now','-60 days'),  NULL),
  ('pv-box-problem-2', 'Bessemer Grocery (made up)',  NULL,                                       '719-555-0158',                       'bread',                  date('now','-60 days'),  NULL),
  ('pv-box-quiet-1',   'Old Mill Family (made up)',   NULL,                                       NULL,                                 NULL,                     date('now','-400 days'), NULL),
  ('pv-box-quiet-2',   'School PTA (made up)',        'New this month.',                          'pta@example.org',                    NULL,                     date('now','-5 days'),   NULL),
  ('pv-box-removed',   'Former Host (made up)',       NULL,                                       NULL,                                 NULL,                     date('now','-500 days'), date('now','-20 days'));

-- Check-ins: the NEWEST visible one per box sets its status; older ones fill the 8-week chart and the Dashboard.
INSERT INTO box_checkins (id, venue_id, kind, note, visibility, hidden_by, hidden_at, needs, created_at) VALUES
  (900101, 'pv-box-ok-1',      'filled',  'Restocked with canned soup (made up).', 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
  (900102, 'pv-box-ok-1',      'took',    NULL, 'visible', NULL, NULL, '["canned_food","diapers"]', strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days')),
  (900103, 'pv-box-ok-1',      'empty',   NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-11 days')),
  (900104, 'pv-box-ok-2',      'took',    'Thank you!', 'visible', NULL, NULL, '["bread","fresh_food"]', strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
  (900105, 'pv-box-ok-2',      'filled',  NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days')),
  (900106, 'pv-box-low-1',     'filled',  NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days')),
  (900107, 'pv-box-low-1',     'low',     NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  (900108, 'pv-box-low-2',     'low',     NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
  (900109, 'pv-box-empty-1',   'filled',  NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-25 days')),
  (900110, 'pv-box-empty-1',   'empty',   NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  (900111, 'pv-box-empty-2',   'took',    NULL, 'visible', NULL, NULL, '["hygiene","pet_food"]', strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days')),
  (900112, 'pv-box-empty-2',   'empty',   NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
  (900113, 'pv-box-problem-1', 'problem', 'The door hinge is broken (made up).', 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
  (900114, 'pv-box-problem-2', 'problem', 'Someone left expired milk (made up).', 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days')),
  (900115, 'pv-box-problem-2', 'problem', 'Graffiti on the side (made up, fixed).', 'hidden', 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),
  (900116, 'pv-box-quiet-1',   'filled',  NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days')),
  (900117, 'pv-box-ok-1',      'filled',  NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-35 days')),
  (900118, 'pv-box-ok-2',      'took',    NULL, 'visible', NULL, NULL, '["canned_food"]', strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days')),
  (900119, 'pv-box-low-2',     'filled',  NULL, 'visible', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-48 days')),
  (900120, 'pv-box-empty-1',   'took',    NULL, 'visible', NULL, NULL, '["drinks","warm_clothing"]', strftime('%Y-%m-%dT%H:%M:%fZ','now','-52 days'));

-- Photos: two waiting for review, one reported by visitors (flagged), two approved. Placeholder JPEGs go to local R2.
INSERT INTO box_photos (id, venue_id, checkin_id, r2_key, status, width, height, bytes, flag_count, reviewed_by, reviewed_at, review_reason, created_at) VALUES
  (900201, 'pv-box-ok-2',      900104, 'box-photos/pv-box-ok-2/preview-pending-1.jpg',  'pending',  800, 600, 20000, 0, NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
  (900202, 'pv-box-low-1',     NULL,   'box-photos/pv-box-low-1/preview-pending-2.jpg', 'pending',  800, 600, 20000, 0, NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  (900203, 'pv-box-problem-1', 900113, 'box-photos/pv-box-problem-1/preview-flagged.jpg','flagged', 800, 600, 20000, 2, 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days')),
  (900204, 'pv-box-ok-1',      900101, 'box-photos/pv-box-ok-1/preview-approved-1.jpg', 'approved', 800, 600, 20000, 0, 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
  (900205, 'pv-box-empty-1',   NULL,   'box-photos/pv-box-empty-1/preview-approved-2.jpg','approved', 800, 600, 20000, 0, 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-21 days'));

-- Sponsors: one request with a confirmed email, one not yet confirmed, two approved, one rejected.
INSERT INTO box_adopters (id, venue_id, display_name, email, note, status, email_confirmed_at, confirm_token, reviewed_by, reviewed_at, review_reason, created_at, lang) VALUES
  (900401, 'pv-box-low-2',   'Preview Garden Club',   'garden.club@example.org', 'We can restock every other week (made up).', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'pv-tok-adopt-1', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'en'),
  (900402, 'pv-box-empty-1', 'Familia Ejemplo',        'familia@example.org',     NULL, 'pending', NULL, 'pv-tok-adopt-2', NULL, NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'es'),
  (900403, 'pv-box-ok-1',    'Preview Scout Troop 12', 'troop12@example.org',     NULL, 'approved', strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days'), 'pv-tok-adopt-3', 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-29 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-31 days'), 'en'),
  (900404, 'pv-box-ok-1',    'The Rivera Family (made up)', 'rivera@example.org', NULL, 'approved', strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 days'), 'pv-tok-adopt-4', 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days'), NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-11 days'), 'en'),
  (900405, 'pv-box-ok-2',    'Spam Name',              'spam@example.com',        NULL, 'rejected', strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), 'pv-tok-adopt-5', 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-14 days'), 'Not a real sponsor', strftime('%Y-%m-%dT%H:%M:%fZ','now','-15 days'), 'en');

-- Email alerts: host alerts on two boxes, plus visitor ("giver") and sponsor subscriptions.
INSERT INTO alert_subscriptions (id, role, venue_id, email, adopter_id, confirmed_at, confirm_token, unsubscribe_token, unsubscribed_at, last_alerted_at, created_at, lang) VALUES
  (900501, 'host',    'pv-box-ok-1',    'host.one@example.org',    NULL,   strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), 'pv-tok-c1', 'pv-tok-u1', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'), 'en'),
  (900502, 'host',    'pv-box-ok-1',    'church.office@example.org', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'),  'pv-tok-c2', 'pv-tok-u2', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'), 'en'),
  (900503, 'host',    'pv-box-empty-1', 'host.five@example.org',   NULL,   strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), 'pv-tok-c3', 'pv-tok-u3', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 days'), 'en'),
  (900504, 'giver',   'pv-box-empty-1', 'neighbor.a@example.org',  NULL,   strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days'), 'pv-tok-c4', 'pv-tok-u4', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days'), 'en'),
  (900505, 'giver',   'pv-box-low-1',   'vecino.b@example.org',    NULL,   NULL,                                              'pv-tok-c5', 'pv-tok-u5', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'es'),
  (900506, 'adopter', 'pv-box-ok-1',    'troop12@example.org',     900403, strftime('%Y-%m-%dT%H:%M:%fZ','now','-29 days'), 'pv-tok-c6', 'pv-tok-u6', NULL, NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-29 days'), 'en');

INSERT INTO box_events (id, venue_id, kind, detail, created_at) VALUES
  (900601, 'pv-box-quiet-2', 'added',   'Made-up box added for the preview.', strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
  (900602, 'pv-box-removed', 'removed', 'Made-up box taken down.',            strftime('%Y-%m-%dT%H:%M:%fZ','now','-20 days'));

-- ── Data-refresh proposals (pending) — one of every kind ProposalCard draws ──
INSERT INTO change_proposals (id, source, target_venue_id, change_type, proposed_diff, diff_hash, run_id, anomaly, status, created_at, triage_lane, triage_json, triage_model, triage_at) VALUES
  -- field update, triaged "likely noise"
  (900001, 'osm', 'test-downtown-grocery-01', 'update',
   '{"before":{"phone":"719-555-0103"},"after":{"phone":"(719) 555-0103","last_verified":"2026-11-10"},"fields_changed":["phone","last_verified"]}',
   'pv-h1', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'),
   'likely_noise', '{"answers":{"same_value":{"noul":0.94}}}', 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- field update (hours), never triaged -> "Needs a human"
  (900002, 'plentiful', 'test-community-pantry-01', 'update',
   '{"before":{"hours_weekly":"{\"tue\":[\"09:00-12:00\"],\"thu\":[\"09:00-12:00\"]}"},"after":{"hours_weekly":"{\"tue\":[\"09:00-13:00\"],\"thu\":[\"09:00-12:00\"],\"sat\":[\"10:00-12:00\"]}","last_verified":"2026-11-10"},"fields_changed":["hours_weekly","last_verified"]}',
   'pv-h2', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- date-only updates (the bulk "approve date-only" button counts these)
  (900003, 'osm', 'test-corner-store-01', 'update',
   '{"before":{"last_verified":"2026-07-18"},"after":{"last_verified":"2026-11-10"},"fields_changed":["last_verified"]}',
   'pv-h3', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'auto_apply_candidate', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  (900004, 'plentiful', 'test-soup-kitchen-01', 'update',
   '{"before":{"last_verified":"2026-07-18"},"after":{"last_verified":"2026-11-10"},"fields_changed":["last_verified"]}',
   'pv-h4', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'likely_noise', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- new places (no venue row yet -> "Review as new place")
  (900005, 'osm', 'osm-node-pv-1001', 'add',
   '{"before":null,"after":{"id":"osm-node-pv-1001","name":"Preview Northside Market (made up)","category":"grocery","lat":38.2950,"lng":-104.6100,"address":"2900 N Elizabeth St, Pueblo, CO 81008","phone":"719-555-0161","url":"https://example.org/northside","hours_weekly":{"mon":["08:00-20:00"],"sat":["09:00-18:00"]},"last_verified":"2026-11-10"},"fields_changed":["id","name","category","lat","lng","address","phone","url","hours_weekly","last_verified"]}',
   'pv-h5', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'needs_human', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  (900006, 'plentiful', 'plentiful-pv-2002', 'add',
   '{"before":null,"after":{"id":"plentiful-pv-2002","name":"Preview Saturday Pantry (made up)","category":"pantry","lat":38.2380,"lng":-104.6420,"address":"1700 W Northern Ave, Pueblo, CO 81005","hours_weekly":{"sat":["09:00-11:00"]},"last_verified":"2026-11-10"},"fields_changed":["id","name","category","lat","lng","address","hours_weekly","last_verified"]}',
   'pv-h6', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), NULL, NULL, NULL, NULL),
  -- restore (an "add" for a place we archived)
  (900007, 'osm', 'test-riverside-farm-01', 'add',
   '{"before":null,"after":{"id":"test-riverside-farm-01","name":"Test Riverside Farm","category":"farm","lat":38.2378,"lng":-104.5678,"address":"780 Arkansas Riverwalk, Pueblo, CO 81003","last_verified":"2026-11-10"},"fields_changed":["id","name","category","lat","lng","address","last_verified"]}',
   'pv-h7', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'needs_human', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- removal / closure, with Jev's guess
  (900008, 'osm', 'test-quick-stop-01', 'remove',
   '{"before":{"name":"Test Quick Stop"},"after":null,"fields_changed":[]}',
   'pv-h8', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'needs_human',
   '{"answers":{"remove_reason":{"choice":"gone","probabilities":{"gone":0.72,"temporarily_missing":0.18,"renamed_or_moved":0.06,"unclear":0.04}}}}', 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- removal from the venue's own website, with a written reason
  (900009, 'website', 'test-fresh-market-01', 'remove',
   '{"before":{"name":"Test Fresh Market"},"after":null,"fields_changed":[],"meta":{"summary":"The market''s website says it closed for good on Oct 31 (made up).","source_url":"https://example.org/fresh-market/news"}}',
   'pv-h9', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), 'likely_noise', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
  -- rename / move
  (900010, 'plentiful', 'test-family-meal-site-01', 'update',
   '{"before":{"name":"Test Family Meal Site"},"after":{"name":"Test Family Meal Site at Grace Hall","last_verified":"2026-11-10"},"fields_changed":["name","last_verified"],"meta":{"rename":{"from_id":"plentiful-pv-old-77","to_id":"plentiful-pv-new-78"}}}',
   'pv-h10', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'renamed_or_moved', '{"answers":{"same_place":{"noul":0.91}}}', 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- broken link
  (900011, 'link_health', 'test-downtown-grocery-01', 'update',
   '{"before":{"url":"https://example.test/downtown-grocery"},"after":{"url":null},"fields_changed":["url"],"meta":{"http_status":404,"checked_at":"2026-11-09T06:00:00.000Z"}}',
   'pv-h11', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), NULL, NULL, NULL, NULL),
  -- Care and Share: unsure which listing this is (always "Needs a human")
  (900012, 'care_and_share', 'test-neighborhood-pantry-01', 'update',
   '{"before":{"phone":"719-555-0109"},"after":{"phone":"719-555-0119","last_verified":"2026-11-10"},"fields_changed":["phone","last_verified"],"meta":{"match":{"upstream_id":"cas-pv-3001","name":"Neighborhood Pantry of Pueblo (made up)","address":"1200 Bonforte Blvd, Pueblo, CO 81001","distance_m":40,"name_score":0.86,"same_phone":false}}}',
   'pv-h12', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'likely_noise', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- Care and Share: listed twice
  (900013, 'care_and_share', 'test-food-bank-annex-01', 'update',
   '{"before":{"last_verified":"2026-07-18"},"after":{"last_verified":"2026-11-10"},"fields_changed":["last_verified"],"meta":{"match":{"upstream_ids":["cas-pv-4001","cas-pv-4002"],"listings":[{"upstream_id":"cas-pv-4001","name":"Food Bank Annex (made up)","address":"1801 E 4th St, Pueblo, CO 81001","distance_m":0,"name_score":0.97,"same_phone":true},{"upstream_id":"cas-pv-4002","name":"Annex Pantry East (made up)","address":"1805 E 4th St, Pueblo, CO 81001","distance_m":25,"name_score":0.71}]}}}',
   'pv-h13', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- Care and Share: hours it couldn't read, in their own words
  (900014, 'care_and_share', 'test-community-pantry-01', 'update',
   '{"before":{"last_verified":"2026-07-18"},"after":{"last_verified":"2026-11-10"},"fields_changed":["last_verified"],"meta":{"needs_review":["two different times on one day","\"by appointment\""],"schedule_text":"Tuesdays 9am-noon and 4-6pm\nThursdays by appointment (made up)"}}',
   'pv-h14', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- Care and Share: first-time link plus a date bump
  (900015, 'care_and_share', 'test-taqueria-01', 'update',
   '{"before":{"phone":"719-555-0101"},"after":{"phone":"719-555-0111","last_verified":"2026-11-10"},"fields_changed":["phone","last_verified"],"meta":{"new_alias":{"upstream_id":"cas-pv-5001","name":"Taqueria Test (made up)","address":"101 N Main St, Pueblo, CO 81003","distance_m":5,"name_score":0.9,"same_phone":true}}}',
   'pv-h15', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'likely_noise', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  -- Venue website: hours change that would overwrite something the venue told us (pin)
  (900016, 'website', 'test-soup-kitchen-01', 'update',
   '{"before":{"phone":"719-555-0108"},"after":{"phone":"719-555-0118","last_verified":"2026-11-10"},"fields_changed":["phone","last_verified"],"meta":{"summary":"The contact page lists a new phone number (made up).","source_url":"https://example.org/soup-kitchen/contact","pins":[{"field":"phone","pinned_at":"2026-10-01T15:00:00.000Z","note":"made-up manager Pat, by phone","age_days":43,"stale":false}]}}',
   'pv-h16', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'needs_human', NULL, 'jev-preview', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
  -- SNAP and WIC list checks (scripts/refresh/benefitLists.ts), in the exact shape it writes:
  -- the tick in column form (0/1/null), meta.benefit_list, and needs_review on the two cards for a person.
  -- "listed": USDA's list has this store, the map says no
  (900017, 'usda_snap', 'test-corner-store-01', 'update',
   '{"before":{"last_verified":"2026-07-18","accepts_snap":0},"after":{"last_verified":"2026-11-13","accepts_snap":1},"fields_changed":["accepts_snap","last_verified"],"meta":{"fetched_at":"2026-11-13T07:00:00.000Z","benefit_list":{"field":"accepts_snap","finding":"listed","entry":{"name":"Test Corner Store 4410 (made up)","address":"822 E Abriendo Ave, Pueblo, CO 81004","name_score":1,"same_street":true,"distance_m":12}}}}',
   'pv-h17', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- "maybe": only an uncertain match (same street number, different name), map says no
  (900020, 'usda_snap', 'test-gas-and-grab-01', 'update',
   '{"before":{"last_verified":"2026-07-18","accepts_snap":null},"after":{"last_verified":"2026-11-13","accepts_snap":1},"fields_changed":["accepts_snap","last_verified"],"meta":{"fetched_at":"2026-11-13T07:00:00.000Z","benefit_list":{"field":"accepts_snap","finding":"maybe_listed","entry":{"name":"Northern Fuel Mart 2207 (made up)","address":"3300 W Northern Ave, Pueblo, CO 81005","name_score":0,"same_street":true,"distance_m":31}},"needs_review":["not sure this is the same place"],"match":{"upstream_id":"usda-pv-7001"}}}',
   'pv-h20', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- "not on the list": the map says yes, USDA's list has nothing; changes no field
  (900021, 'usda_snap', 'test-value-grocery-01', 'update',
   '{"before":{"last_verified":"2026-07-18"},"after":{"last_verified":"2026-11-13"},"fields_changed":["last_verified"],"meta":{"fetched_at":"2026-11-13T07:00:00.000Z","benefit_list":{"field":"accepts_snap","finding":"not_listed"},"needs_review":["not on the list"]}}',
   'pv-h21', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- WIC "listed": Colorado WIC's map has this store (no coordinates there, so no distance)
  (900018, 'cdphe_wic', 'test-fresh-market-01', 'update',
   '{"before":{"last_verified":"2026-07-18","accepts_wic":0},"after":{"last_verified":"2026-11-13","accepts_wic":1},"fields_changed":["accepts_wic","last_verified"],"meta":{"fetched_at":"2026-11-13T07:00:00.000Z","benefit_list":{"field":"accepts_wic","finding":"listed","entry":{"name":"TEST FRESH MARKET #12 (MADE UP)","address":"2400 N ELIZABETH ST, PUEBLO, CO 81003","name_score":1,"same_street":true,"distance_m":null}}}}',
   'pv-h18', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- second rename / move (OpenStreetMap), untriaged: a rename is still "Likely rename"
  (900019, 'osm', 'test-edible-park-01', 'update',
   '{"before":{"name":"Test Edible Park","address":"700 Goodnight Ave, Pueblo, CO 81004"},"after":{"name":"Test Edible Park North","address":"720 Goodnight Ave, Pueblo, CO 81004","last_verified":"2026-11-10"},"fields_changed":["name","address","last_verified"],"meta":{"rename":{"from_id":"osm-way-pv-500","to_id":"osm-way-pv-501"}}}',
   'pv-h19', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL),
  -- one already approved (not shown in the queue; makes the Activity entry read "Approved data refresh")
  (900090, 'osm', 'test-heritage-farm-01', 'update',
   '{"before":{"phone":"719-555-0112"},"after":{"phone":"719-555-0122","last_verified":"2026-11-01"},"fields_changed":["phone","last_verified"]}',
   'pv-h90', 'preview-run-0', 0, 'approved', strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days'), NULL, NULL, NULL, NULL),
  -- SACRIFICIAL: selfcheck.sh rejects this one; re-seeding brings it back
  (900099, 'osm', 'test-victory-garden-01', 'update',
   '{"before":{"last_verified":"2026-07-18"},"after":{"last_verified":"2026-11-10"},"fields_changed":["last_verified"]}',
   'pv-h99', 'preview-run-1', 0, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), NULL, NULL, NULL, NULL);
-- The "maybe" SNAP card's store has an unknown tick (most real ones do), so the card shows "Not known".
UPDATE venues SET accepts_snap = NULL WHERE id = 'test-gas-and-grab-01';
UPDATE change_proposals SET reviewed_by = 'dana@example.org', reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), applied_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days') WHERE id = 900090;

-- A detail the venue told us (shown next to the website proposal above and on the edit page).
INSERT INTO venue_observations (id, venue_id, field, source, value, fetched_at, is_pin, pinned_by, pin_note, accepted_at, accepted_by) VALUES
  (900701, 'test-soup-kitchen-01', 'phone', 'venue_direct', '"719-555-0108"', '2026-10-01T15:00:00.000Z', 1, 'dana@example.org', 'made-up manager Pat, by phone', '2026-10-01T15:00:00.000Z', 'dana@example.org');

-- ── Public suggestions and problem reports ──
INSERT INTO public_submissions (id, kind, payload, target_venue_id, submitter_email, status, created_at) VALUES
  (900301, 'new_venue', '{"venueName":"Preview Church Food Closet (made up)","address":"321 Pine St, Pueblo, CO 81004","category":"pantry","hours":"Fridays 1-3pm","contact":"719-555-0171","acceptsSnap":false,"acceptsWic":false,"notes":"Bring a bag.","submitterEmail":"helper.c@example.org"}', NULL, 'helper.c@example.org', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days')),
  (900302, 'new_venue', '{"venueName":"Preview Weekend Meals (made up)","address":"88 Grand Ave, Pueblo, CO 81003","category":"meal_site","acceptsSnap":false,"acceptsWic":false,"submitterEmail":"helper.d@example.org"}', NULL, 'helper.d@example.org', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days')),
  (900303, 'closure', '{"venueId":"test-heritage-farm-01","venueName":"Test Heritage Farm","venueAddress":"5600 Overton Rd, Pueblo, CO 81006","issueType":"closed","description":"The gate has a sign saying they closed for the season (made up).","contactEmail":"neighbor.e@example.org"}', 'test-heritage-farm-01', 'neighbor.e@example.org', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days')),
  (900304, 'closure', '{"venueId":"test-taqueria-01","venueName":"Test Taqueria","venueAddress":"101 N Main St, Pueblo, CO 81003","issueType":"hours","description":"They close at 6 on Fridays now (made up)."}', 'test-taqueria-01', NULL, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days')),
  (900305, 'closure', '{"venueId":"test-urban-farm-01","venueName":"Test Urban Farm","venueAddress":"1450 Greenhorn Rd, Pueblo, CO 81005","issueType":"contact","description":"The phone number goes to a fax machine (made up).","contactEmail":"neighbor.f@example.org"}', 'test-urban-farm-01', 'neighbor.f@example.org', 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days'));

-- ── Events: draft, published (one with a flyer), cancelled, archived ──
INSERT INTO events (id, name, name_es, host, host_es, description, description_es, what_to_bring, cancel_note, cancel_note_es, starts_at, ends_at, lat, lng, address, venue_id, venue_name, link_url, link_label, flyer_key, flyer_width, flyer_height, flyer_alt, flyer_alt_es, status, created_at, created_by, updated_at, updated_by, published_at) VALUES
  ('pv-evt-supper', 'Preview Community Supper (made up)', 'Cena comunitaria de prueba', 'Preview Helpers', 'Ayudantes de prueba', 'A free hot meal for anyone who comes. Made-up event for the preview.', 'Una comida caliente gratis. Evento inventado.', 'Nothing, just come hungry.', NULL, NULL,
   strftime('%Y-%m-%dT23:00:00.000Z','now','+6 days'), strftime('%Y-%m-%dT01:00:00.000Z','now','+7 days'), 38.2634, -104.6045, '90 W 8th St, Pueblo, CO 81003', 'test-soup-kitchen-01', 'Test Soup Kitchen', 'https://example.org/supper', 'rsvp',
   'pv-evt-supper/00000000-0000-4000-8000-000000000001.jpg', 800, 1000, 'Flyer: Community Supper, Thursday 5pm (placeholder image)', 'Volante de prueba', 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-8 days')),
  ('pv-evt-produce', 'Preview Free Produce Day (made up)', NULL, 'Preview Farm Collective', NULL, 'Fresh vegetables, first come first served. Made-up event.', NULL, 'Your own bags', NULL, NULL,
   strftime('%Y-%m-%dT16:00:00.000Z','now','+12 days'), strftime('%Y-%m-%dT19:00:00.000Z','now','+12 days'), 38.2412, -104.5921, '1450 Greenhorn Rd, Pueblo, CO 81005', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 days')),
  ('pv-evt-draft-1', 'Preview Coat Drive (draft, made up)', NULL, 'Preview Helpers', NULL, 'Draft: details still being worked out.', NULL, NULL, NULL, NULL,
   strftime('%Y-%m-%dT17:00:00.000Z','now','+20 days'), strftime('%Y-%m-%dT20:00:00.000Z','now','+20 days'), 38.2551, -104.6089, '300 S Union Ave, Pueblo, CO 81003', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, 'draft', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'dana@example.org', NULL),
  ('pv-evt-draft-2', 'Preview Cooking Class (draft, made up)', NULL, 'Preview Kitchen', NULL, 'Draft: learn three meals from pantry staples.', NULL, NULL, NULL, NULL,
   strftime('%Y-%m-%dT00:00:00.000Z','now','+15 days'), strftime('%Y-%m-%dT02:00:00.000Z','now','+15 days'), 38.2489, -104.6203, '215 W 4th St, Pueblo, CO 81003', 'test-community-pantry-01', 'Test Community Pantry', 'https://example.org/class', 'signup',
   NULL, NULL, NULL, NULL, NULL, 'draft', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'dana@example.org', NULL),
  ('pv-evt-cancelled', 'Preview Park Picnic (cancelled, made up)', NULL, 'Preview Parks Crew', NULL, 'A picnic lunch in the park.', NULL, NULL, 'Cancelled because of the snow forecast (made up).', 'Cancelado por la nieve.',
   strftime('%Y-%m-%dT18:00:00.000Z','now','+3 days'), strftime('%Y-%m-%dT20:00:00.000Z','now','+3 days'), 38.2503, -104.6301, '700 Goodnight Ave, Pueblo, CO 81004', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, 'cancelled', strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 days')),
  ('pv-evt-cancelled-2', 'Preview Bake Sale (cancelled, made up)', NULL, 'Preview School PTA', NULL, 'Bake sale for the pantry.', NULL, NULL, 'Moved to spring (made up).', NULL,
   strftime('%Y-%m-%dT17:00:00.000Z','now','+9 days'), strftime('%Y-%m-%dT19:00:00.000Z','now','+9 days'), 38.2811, -104.6412, '450 Baxter Rd, Pueblo, CO 81005', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, 'cancelled', strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days')),
  ('pv-evt-archived-1', 'Preview Harvest Festival (archived, made up)', NULL, 'Preview Farm Collective', NULL, 'Last month''s festival.', NULL, NULL, NULL, NULL,
   strftime('%Y-%m-%dT16:00:00.000Z','now','-30 days'), strftime('%Y-%m-%dT21:00:00.000Z','now','-30 days'), 38.2412, -104.5921, '1450 Greenhorn Rd, Pueblo, CO 81005', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, 'archived', strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-25 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days')),
  ('pv-evt-archived-2', 'Preview Summer Lunch (archived, made up)', NULL, 'Preview Helpers', NULL, 'Summer lunch program wrap-up.', NULL, NULL, NULL, NULL,
   strftime('%Y-%m-%dT17:00:00.000Z','now','-60 days'), strftime('%Y-%m-%dT19:00:00.000Z','now','-60 days'), 38.2634, -104.6045, '90 W 8th St, Pueblo, CO 81003', NULL, NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, 'archived', strftime('%Y-%m-%dT%H:%M:%fZ','now','-70 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-55 days'), 'dana@example.org', strftime('%Y-%m-%dT%H:%M:%fZ','now','-70 days'));

-- Events sent in by the public (one with a flyer).
INSERT INTO event_submissions (id, payload, submitter_name, submitter_email, flyer_key, flyer_width, flyer_height, status, created_at, review_token) VALUES
  ('pv-esub-1', json_object('name','Preview Diaper Giveaway (sent in, made up)','host','Preview Moms Group','description','Free diapers, sizes 1 to 6, while they last.','whatToBring','Proof of nothing, all welcome','startsAt',strftime('%Y-%m-%dT17:00:00.000Z','now','+10 days'),'endsAt',strftime('%Y-%m-%dT19:00:00.000Z','now','+10 days'),'venueName','Preview Moms Center','address','55 Main St, Pueblo, CO 81003','linkUrl','https://example.org/diapers','linkLabel','website','lat',38.2660,'lng',-104.6100),
   'Rosa Example', 'rosa@example.org', 'pending.submissions/00000000-0000-4000-8000-000000000002.jpg', 800, 1000, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days'), 'pv-review-token-1'),
  ('pv-esub-2', json_object('name','Preview Soup Swap (sent in, made up)','host','Preview Neighbors','description','Bring a pot of soup, take a different one home.','whatToBring',NULL,'startsAt',strftime('%Y-%m-%dT00:30:00.000Z','now','+8 days'),'endsAt',strftime('%Y-%m-%dT02:00:00.000Z','now','+8 days'),'venueName',NULL,'address','400 Lake Ave, Pueblo, CO 81004','linkUrl',NULL,'linkLabel','website','lat',NULL,'lng',NULL),
   'Lee Sample', 'lee@example.com', NULL, NULL, NULL, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 days'), 'pv-review-token-2'),
  ('pv-esub-old', json_object('name','Preview Old Submission (made up)','host','Someone','description','Already handled.','whatToBring',NULL,'startsAt',strftime('%Y-%m-%dT17:00:00.000Z','now','-3 days'),'endsAt',strftime('%Y-%m-%dT18:00:00.000Z','now','-3 days'),'venueName',NULL,'address','1 Main St, Pueblo, CO 81003','linkUrl',NULL,'linkLabel','website','lat',NULL,'lng',NULL),
   'Old Sender', 'old.sender@example.org', NULL, NULL, NULL, 'converted', strftime('%Y-%m-%dT%H:%M:%fZ','now','-9 days'), 'pv-review-token-3');

-- ── Activity log: three sign-in sessions over a week, automatic changes, an unrecorded change, failures ──
INSERT INTO auth_events (id, event, email, user_id, session_id, method, ip, user_agent, city, region, country, detail_json, created_at) VALUES
  (900801, 'sign_in',        'dana@example.org',     'pv-user-dana', 'pv-sess-a', 'email_code', '203.0.113.24',  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', 'Pueblo', 'Colorado', 'US', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 hours')),
  (900802, 'sign_in',        'dana@example.org',     'pv-user-dana', 'pv-sess-b', 'passkey',    '203.0.113.24',  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36', 'Pueblo', 'Colorado', 'US', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-4 hours')),
  (900803, 'passkey_added',  'dana@example.org',     'pv-user-dana', 'pv-sess-b', 'passkey',    '203.0.113.24',  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36', 'Pueblo', 'Colorado', 'US', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-3 hours')),
  (900804, 'sign_out',       'dana@example.org',     'pv-user-dana', 'pv-sess-b', NULL,         '203.0.113.24',  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36', 'Pueblo', 'Colorado', 'US', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-1 hours')),
  (900805, 'sign_in',        'sam@example.org',      'pv-user-sam',  'pv-sess-c', 'email_code', '198.51.100.7',  'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36', 'Colorado Springs', 'Colorado', 'US', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','-2 hours')),
  (900806, 'sign_in_failed', 'stranger@example.com', NULL,           NULL,        'email_code', '198.51.100.99', 'curl/8.0', 'Denver', 'Colorado', 'US', '{"reason":"not_allowlisted"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 days','-5 hours')),
  (900807, 'sign_in_failed', 'dana@example.org',     NULL,           NULL,        'email_code', '203.0.113.24',  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', 'Pueblo', 'Colorado', 'US', '{"reason":"INVALID_OTP"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-3 hours','-5 minutes')),
  (900808, 'passkey_removed','sam@example.org',      'pv-user-sam',  'pv-sess-c', 'passkey',    '198.51.100.7',  'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36', 'Colorado Springs', 'Colorado', 'US', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','-1 hours'));

INSERT INTO audit_log (id, actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id) VALUES
  -- session A (today)
  (900901, 'dana@example.org', 'venue', 'test-downtown-grocery-01', 'update', '{"phone":"719-555-0103","notes":"Seed data for dev environment testing."}', '{"phone":"719-555-0103","notes":"Open late on Fridays (made up)."}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 hours','-40 minutes'), 'pv-sess-a'),
  (900902, 'dana@example.org', 'box_photo', '900204', 'update', '{"status":"pending"}', '{"status":"approved"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 hours','-30 minutes'), 'pv-sess-a'),
  (900903, 'dana@example.org', 'event', 'pv-evt-draft-1', 'create', NULL, '{"name":"Preview Coat Drive (draft, made up)","status":"draft"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 hours','-20 minutes'), 'pv-sess-a'),
  (900904, 'dana@example.org', 'box_host_alert', 'pv-box-ok-1', 'update', NULL, '{"email":"church.office@example.org"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 hours','-10 minutes'), 'pv-sess-a'),
  -- session B (2 days ago)
  (900905, 'dana@example.org', 'venue', 'pv-draft-pantry', 'create', NULL, '{"name":"Preview Eastside Pantry (made up)","status":"draft"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-3 hours','-30 minutes'), 'pv-sess-b'),
  (900906, 'dana@example.org', 'box_adopter', '900404', 'update', '{"status":"pending"}', '{"status":"approved"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-3 hours','-20 minutes'), 'pv-sess-b'),
  (900907, 'dana@example.org', 'box_checkin', '900115', 'update', '{"visibility":"visible"}', '{"visibility":"hidden"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-3 hours','-10 minutes'), 'pv-sess-b'),
  (900908, 'dana@example.org', 'event', 'pv-evt-cancelled', 'update', '{"name":"Preview Park Picnic (cancelled, made up)","status":"published"}', '{"name":"Preview Park Picnic (cancelled, made up)","status":"cancelled"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-2 hours'), 'pv-sess-b'),
  (900909, 'dana@example.org', 'venue', 'pv-archived-market', 'archive', '{"status":"published"}', '{"status":"archived"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days','-1 hours','-30 minutes'), 'pv-sess-b'),
  -- session C (6 days ago, a second made-up admin)
  (900910, 'sam@example.org', 'venue', 'test-heritage-farm-01', 'update', '{"phone":"719-555-0112"}', '{"phone":"719-555-0122"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','-1 hours','-50 minutes'), 'pv-sess-c'),
  (900911, 'sam@example.org', 'venue', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','-1 hours','-30 minutes'), 'publish', NULL, '{"promotedCount":2,"editedCount":3,"archivedCount":1}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','-1 hours','-30 minutes'), 'pv-sess-c'),
  (900912, 'sam@example.org', 'event_submission', 'pv-esub-old', 'update', '{"status":"pending"}', '{"status":"converted"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-6 days','-1 hours','-10 minutes'), 'pv-sess-c'),
  -- automatic (no @ in the actor)
  (900913, 'refresh-pipeline', 'venue', 'test-corner-store-01', 'update', '{"last_verified":"2026-07-01"}', '{"last_verified":"2026-07-18"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days'), NULL),
  (900914, 'refresh-pipeline', 'venue', 'test-soup-kitchen-01', 'update', '{"last_verified":"2026-07-01"}', '{"last_verified":"2026-07-18"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-4 days','+2 minutes'), NULL),
  -- a change with no recorded sign-in
  (900915, 'dana@example.org', 'venue', 'test-urban-farm-01', 'update', '{"operator":"Test Farm Co"}', '{"operator":"Test Farm Collective"}', strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 days'), NULL);
