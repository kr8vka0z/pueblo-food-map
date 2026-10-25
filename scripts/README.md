# scripts/ — runbook

Every script's own header comment is the primary source of truth (what it
reads, what it writes, why it exists) — this file is the map between them:
run order, what's automated vs. by-hand, and the shared dependency pin.
Deeper operational detail lives in [`AGENTS.md`](../AGENTS.md): the
"Automated venue-refresh pipeline" section (guardrails, chunked writes) and
the "Secrets" table (credentials). Local runs are below;
the product-level story (why the pipeline exists, what it fixed) is in
[`README.md`](../README.md)'s "Data sources" section. Read those, not this
file, for the *why* — this file is only the *what runs when*.

## Data pipeline — automated weekly (`refresh-proposals.yml`)

**Runs in CI**, weekly cron (`0 6 * * 1` UTC, Mondays — changed from monthly in #543) + manual `workflow_dispatch`,
orchestrated by `refresh-ingest.ts` — never run directly by a person in
production (`--db-mode remote` writes real D1). Order, each step re-running
the named script UNMODIFIED:

| Step | Script | Reads | Writes |
|---|---|---|---|
| 1a | `scrape-plentiful.py` | `directory.plentiful.org/colorado/pueblo` (live HTTP) | `data/raw/pueblo-pantries.json`, `src/data/pantries-plentiful.ts` |
| 1b | `fetch-osm-grocery.py` | Overpass API (live HTTP) | `data/raw/pueblo-grocery.json` |
| 1c | `ingest-osm-grocery.py` | `data/raw/pueblo-grocery.json` + `public/data/pueblo-county-boundary.geojson` | `src/data/grocery-osm.ts` |
| 1d | `refresh/careAndShare.ts` (inside `refresh-ingest.ts`) | Care and Share's Find Food map API (`api.accessfood.org`, live HTTP, one request every 3.5 s) | nothing on disk in the repo; a contact-free cache in a temp dir per run |
| 2 | `refresh-ingest.ts` itself | current D1 `venues` rows + the freshly-regenerated files above | `change_proposals` rows (one exception: a pure "date-only" proposal auto-applies to `venues.last_verified`) |

Step 2's diff/guardrail/link-health logic isn't inline in `refresh-ingest.ts`
— it's the pure, unit-tested modules in `scripts/refresh/` (`diffEngine.ts`,
`linkHealth.ts`, `proposalSql.ts`, `sqlChunks.ts`, plus `triage.ts` and
`renamePairs.ts` from #543, the Jev triage and rename pairing). None of those run
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

Watch only the Care and Share reader, writing nothing (reads the live API
at its slow pace, diffs against the chosen database, prints every match and
change):

```
npx tsx scripts/refresh-ingest.ts --db-mode local --only care_and_share --dry-run
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

`ci.yml` runs both on every PR; run them locally before pushing a parser change.

```
python3 scripts/scrape-plentiful.py --self-check   # hours-card parser, fixture-based
python3 scripts/test_fetch_osm_grocery.py           # Overpass partial-result guard
```

## Data pipeline — by hand only, never run in CI

Not wired into `refresh-proposals.yml` — each is a one-off or an
infrequent re-run someone triggers deliberately, not part of the weekly
automated diff:

| Script | Purpose | When to re-run |
|---|---|---|
| `geocode-pfp.py` | Geocodes the 10 hand-curated Pueblo Food Project venues against Nominatim | Only if a PFP address changes — last run 2026-05-14 |
| `geocode-osm-missing.py` | Reverse-geocodes OSM venues missing an address (Nominatim, falling back to Mapbox, then raw coordinates) | After an OSM ingest leaves new venues with no address |

## Release and security automation

Run by workflows, not by hand (except the manual cut in AGENTS.md "Release
schedule"). Each has a `.test.mjs` beside it except `section.sh`.

| Script | Purpose | Run by |
|---|---|---|
| `release/prepare.mjs` | Picks the next version, bumps it, and lists the PRs merged since the last release | `release.yml` |
| `release/section.sh` | Extracts one version's CHANGELOG section (the GitHub Release notes; proves the section parses) | `release.yml`, `deploy-prod.yml` |
| `release/check-push-target.sh` | Refuses to push unless `origin` still points at this repo | `release.yml`, and `security/audit-fix.sh` (so `security-fix.yml`) |
| `security/audit-fix.sh` | Patches production-dependency advisories in `package-lock.json` on `dev` | `security-fix.yml` |
| `security/check-lockfile-flags.mjs` | Fails when the lockfile marks a production-reachable package as dev-only | `weekly-security-audit.yml` |

`prepare.mjs` reads PR titles as Conventional Commits; `pr-title.yml` is the
check that enforces that on PRs into `dev`.

## Not part of the data pipeline

Present in this directory but not "venue data ingestion" — listed so an
unfamiliar reader doesn't mistake them for part of the flow above:

| Script | Purpose |
|---|---|
| `seed-admin-db.ts` | Local only: generates SQL that loads the real venue source records into a fresh local D1 (`npm run seed:admin`). Never apply it with `--remote`; remote databases change only through `wrangler d1 migrations apply` |
| `seed-blessing-boxes.ts` | Dev-only: generates throwaway fake blessing-box SQL for staging/dev |
| `load-real-blessing-boxes.ts` | Generates ready-to-apply SQL for Kyle's real blessing-box address list |
| `seed-dev.sql` | Fake venue rows for the staging admin D1 database's UI states |
| `auth-cli.config.ts` | CLI-only Better Auth config for `@better-auth/cli generate`/`migrate` — never imported by the app |
| `check-banned.mjs` | Banned-string lint (old font names, retired Tailwind palettes) — wired into `npm run lint` |
| `check-prerender-serves.sh` | Builds with OpenNext, serves in the local Worker, and requests the prerendered venue pages (must be 200) — `ci.yml` runs it so a `next` / OpenNext bump that 404s them fails its PR |
| `check-design-drift.mjs` | Token parity check between `globals.css` and `DESIGN.md` — `npm run design:drift`, a blocking CI gate |

## Not built: GTFS transit data

Evaluated and dropped (#133, 2026-09-24, Kyle) — the Bus direction button
(`DirectionButtons.tsx`) deep-links straight to Google Maps
(`travelmode=transit`), so nothing in this codebase would consume GTFS data
even if it were ingested. No script here fetches or converts it, and none
is planned.
