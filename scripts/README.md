# scripts/ — runbook

Every script's own header comment is the primary source of truth (what it
reads, what it writes, why it exists) — this file is the map between them:
run order, what's automated vs. by-hand, and the shared dependency pin.
Deeper operational detail (guardrails, credentials, alerts) lives in
[`AGENTS.md`](../AGENTS.md)'s "Automated venue-refresh pipeline" section;
the product-level story (why the pipeline exists, what it fixed) is in
[`README.md`](../README.md)'s "Data sources" section. Read those, not this
file, for the *why* — this file is only the *what runs when*.

## Data pipeline — automated monthly (`refresh-proposals.yml`)

**Runs in CI**, monthly cron (`0 6 1 * *` UTC) + manual `workflow_dispatch`,
orchestrated by `refresh-ingest.ts` — never run directly by a person in
production (`--db-mode remote` writes real D1). Order, each step re-running
the named script UNMODIFIED:

| Step | Script | Reads | Writes |
|---|---|---|---|
| 1a | `scrape-plentiful.py` | `directory.plentiful.org/colorado/pueblo` (live HTTP) | `data/raw/pueblo-pantries.json`, `src/data/pantries-plentiful.ts` |
| 1b | `fetch-osm-grocery.py` | Overpass API (live HTTP) | `data/raw/pueblo-grocery.json` |
| 1c | `ingest-osm-grocery.py` | `data/raw/pueblo-grocery.json` + `public/data/pueblo-county-boundary.geojson` | `src/data/grocery-osm.ts` |
| 2 | `refresh-ingest.ts` itself | current D1 `venues` rows + the freshly-regenerated files above | `change_proposals` rows (one exception: a pure "date-only" proposal auto-applies to `venues.last_verified`) |

Step 2's diff/guardrail/link-health logic isn't inline in `refresh-ingest.ts`
— it's the pure, unit-tested modules in `scripts/refresh/` (`diffEngine.ts`,
`linkHealth.ts`, `proposalSql.ts`, `sqlChunks.ts`). None of those run
standalone; `refresh-ingest.ts` is the only entry point that imports them.

`fetch-osm-grocery.py` → `ingest-osm-grocery.py` is a fixed pair: the first
is the only thing in this repo that actually talks to Overpass (its own
header explains the gap it fills — `ingest-osm-grocery.py` only ever
converted an already-downloaded dump), the second's `INCLUDE_EXTS`/tag
mapping expects exactly the shape the first writes.

Run locally the same way CI does (targets Miniflare's local D1, not
production):

```
npx tsx scripts/refresh-ingest.ts --db-mode local
```

`--db-mode <local|staging|remote>` picks the DATABASE, not just a flag —
`remote` is production, only ever run by the real workflow. Full rationale
and the staging/local database-name mapping: `refresh-ingest.ts`'s own file
header, and AGENTS.md's "Automated venue-refresh pipeline" bullet on
`--db-mode`.

### Dependencies

- **Python:** `python3` + `beautifulsoup4==4.14.3` — pinned to match what
  `refresh-proposals.yml` installs (`pip install beautifulsoup4==4.14.3`).
  No `requirements.txt` for this one dependency (ponytail rung 2/3, per
  `scrape-plentiful.py`'s own note) — install it by hand before running
  `scrape-plentiful.py` or the ingest pair locally.
- **Node:** `npx tsx` (a pinned devDependency — `npm ci` first).

### Self-checks (no network, run after touching the parsers)

```
python3 scripts/scrape-plentiful.py --self-check   # hours-card parser, fixture-based
python3 scripts/test_fetch_osm_grocery.py           # Overpass partial-result guard
```

## Data pipeline — by hand only, never run in CI

Not wired into `refresh-proposals.yml` — each is a one-off or an
infrequent re-run someone triggers deliberately, not part of the monthly
automated diff:

| Script | Purpose | When to re-run |
|---|---|---|
| `match-benefits.py` | Matches OSM grocery/convenience venues against USDA SNAP + CDPHE WIC data by proximity/name → `accepts_snap`/`accepts_wic` flags | When the USDA/CDPHE source files in `data/raw/` are refreshed by hand (see the script's own header for the ArcGIS query URLs) |
| `geocode-pfp.py` | Geocodes the 10 hand-curated Pueblo Food Project venues against Nominatim | Only if a PFP address changes — last run 2026-05-14 |
| `geocode-osm-missing.py` | Reverse-geocodes OSM venues missing an address (Nominatim, falling back to Mapbox, then raw coordinates) | After an OSM ingest leaves new venues with no address |

## Not part of the data pipeline

Present in this directory but not "venue data ingestion" — listed so an
unfamiliar reader doesn't mistake them for part of the flow above:

| Script | Purpose |
|---|---|
| `seed-admin-db.ts` | One-time: generates the SQL that seeded all current venues into D1 on the #237 admin cutover (`npm run seed:admin`) |
| `seed-blessing-boxes.ts` | Dev-only: generates throwaway fake blessing-box SQL for staging/dev |
| `load-real-blessing-boxes.ts` | Generates ready-to-apply SQL for Kyle's real blessing-box address list |
| `seed-dev.sql` | Fake venue rows for the staging admin D1 database's UI states |
| `auth-cli.config.ts` | CLI-only Better Auth config for `@better-auth/cli generate`/`migrate` — never imported by the app |
| `check-banned.mjs` | Banned-string lint (old font names, retired Tailwind palettes) — wired into `npm run lint` |
| `check-design-drift.mjs` | Token parity check between `globals.css` and `DESIGN.md` — `npm run design:drift`, a blocking CI gate |

## Not built: GTFS transit data

Evaluated and dropped (#133, 2026-09-24, Kyle) — the Bus direction button
(`DirectionButtons.tsx`) deep-links straight to Google Maps
(`travelmode=transit`), so nothing in this codebase would consume GTFS data
even if it were ingested. No script here fetches or converts it, and none
is planned.
