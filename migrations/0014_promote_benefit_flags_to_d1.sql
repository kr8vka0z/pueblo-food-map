-- migrations/0014_promote_benefit_flags_to_d1.sql
--
-- Copies src/data/benefit-flags.ts's SNAP/WIC matches into D1's
-- venues.accepts_snap/accepts_wic tri-state columns (#597), so they become
-- admin-editable instead of a code-change-only fix. 49 rows, all OSM
-- grocery/convenience/farm venues (SNAP: 49, WIC: 8 of those 49 — the
-- overlay file's own header comment).
--
-- Each UPDATE is PER-COLUMN NULL-guarded via a CASE, not a blanket
-- `WHERE accepts_snap IS NULL` — accepts_snap and accepts_wic are
-- independent tri-states, so a row where an admin already set one but not
-- the other must only have the untouched column filled. This is Kyle's
-- "admin edits win" precedence (#238, docs/admin/cloudflare-native-admin-
-- spec.md §7 step 1, "NB4"): a non-NULL value already in D1 is an explicit
-- admin edit and is never overwritten by this migration.
--
-- IDEMPOTENT and safe to re-run: once a row's accepts_snap/accepts_wic are
-- non-NULL (because this migration already ran, or an admin edited the row
-- since), the CASE guards leave both columns and updated_at unchanged —
-- a silent no-op. Safe on staging and prod.
--
-- updated_at is bumped ONLY on rows this migration actually changes (same
-- CASE guard as the data columns) — this is what makes the Publish bar
-- appear (updated_at > published_at; AGENTS.md's promotion-checklist
-- section explains why a data migration that should prompt a Publish must
-- set this explicitly, since D1 has no trigger for it).
--
-- Generated from src/data/benefit-flags.ts by a throwaway script (not
-- committed — see the coder session that authored this file). Row count
-- verified to match: 49 UPDATE statements below, 49 entries in the source
-- overlay object.
--
-- After this runs against PRODUCTION, an admin must click Publish
-- (POST /api/admin/publish) — src/data/published-venues.ts is a snapshot
-- regenerated from D1, not read live, so the public SNAP/WIC badges keep
-- reading the old (overlay-only) values until the next publish. See
-- AGENTS.md's "Admin panel" and promotion-checklist sections.

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-10239124452';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-11550915644';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12079476149';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12184485110';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12199987090';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12259768973';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12478967185';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12496998446';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12528946501';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12599529644';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12599529663';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12839229515';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-12849787149';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-13398740836';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4041145706';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4041363143';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4041363163';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4041375005';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4041375052';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4043068526';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-4043068646';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-node-5409829684';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-1079237907';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-224603771';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-264728293';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-439892311';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-439892313';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-466464064';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-499816958';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-505568940';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-535378000';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-535379543';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-535650928';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-535656814';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-535686236';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-536454112';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-544400971';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-547529779';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-591851971';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-659620782';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-682492454';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-682492473';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-946612229';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-946612238';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-946614791';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 1 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-946614803';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-947245256';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-971896407';

UPDATE venues SET
  accepts_snap = CASE WHEN accepts_snap IS NULL THEN 1 ELSE accepts_snap END,
  accepts_wic  = CASE WHEN accepts_wic  IS NULL THEN 0 ELSE accepts_wic  END,
  updated_at   = CASE WHEN accepts_snap IS NULL OR accepts_wic IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
WHERE id = 'osm-way-974172860';
