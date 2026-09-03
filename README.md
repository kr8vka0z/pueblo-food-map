# Pueblo Food Map

A mobile-first, bilingual (EN/ES) web map of free and low-cost food resources
in Pueblo County, Colorado — community gardens, edible landscapes, food
pantries, grocery stores, convenience stores, farms, and meal sites.

Built for and with [Pueblo Food Project](https://pueblofoodproject.org).
Maintained long-term by volunteers and occasional contributors.

**Live:** <https://pueblofoodmap.com>

---

## Who it's for

Pueblo County residents who are food-insecure or seeking community food
resources — including Spanish-speaking residents (full EN/ES UI). Works on
any smartphone browser; no app install required.

---

## Local development

Requirements: Node.js 20 LTS or later.

```bash
git clone https://github.com/kr8vka0z/pueblo-food-map.git
cd pueblo-food-map
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_MAPBOX_TOKEN
npm install
npm run dev
```

Open <http://localhost:3000>. Hot-reloads on save (Turbopack).

### Key scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run test` | Unit tests (vitest, watch mode) |
| `npm run test:ci` | Unit tests, CI mode (single run) |
| `npm run preview` | OpenNext build + local Worker emulator at :8788 |
| `npm run deploy` | OpenNext build + wrangler deploy to production |
| `npm run design:lint` | design.md CLI lint on DESIGN.md (report-only) |
| `npm run design:drift` | Token parity check: globals.css vs DESIGN.md (blocking) |

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup details and branch/commit
conventions.

---

## Folder map

```
src/
  app/             Next.js App Router pages and API route handlers
    page.tsx         Root page (splash gate + map)
    layout.tsx       Root layout (locale cookie read; LocaleProvider)
    report/          Venue issue-report form + POST handler
    suggest/         Suggest-a-venue form + POST handler
    feedback/        General feedback form + POST handler
  components/      React components (map canvas, bottom sheet, search, etc.)
  data/            Static venue data (committed TypeScript modules)
    venues.ts        Aggregated venue list — single import for all components
    grocery-osm.ts   Auto-generated from OSM Overpass (do not edit by hand)
    pantries-plentiful.ts  Auto-generated from Plentiful directory
    benefit-flags.ts Auto-generated SNAP/WIC overlay
    pueblo-bbox.ts   Pueblo County geographic constants
  lib/             Shared utilities (i18n, hours, favorites, distance, etc.)
  types/
    venue.ts         Canonical Venue interface and VenueCategory type

data/
  raw/             Raw source files (OSM JSON, PFP geocodes, etc.)

scripts/           One-off ingestion scripts (run locally; not imported by app)
  ingest-osm-grocery.py   Overpass → src/data/grocery-osm.ts
  scrape-plentiful.py     Plentiful → src/data/pantries-plentiful.ts
  match-benefits.py       USDA FNS + CDPHE → src/data/benefit-flags.ts
  geocode-pfp.py          Nominatim geocoder for PFP venues
```

---

## Stack

- **Next.js 16.2** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Mapbox GL JS v3** + `react-map-gl` v8 (vector tiles, `streets-v12` basemap)
- **vaul** (bottom sheet on mobile)
- **lucide-react** (icons)
- **Cloudflare Turnstile** (bot protection on submission forms)
- **Resend** (transactional email for form submissions)
- **Deployed to Cloudflare Workers** via `@opennextjs/cloudflare`

---

## Deploy and infrastructure

- **CI:** `lint → typecheck → test (with coverage) → audit → build` on every
  PR and push to `main`
  ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- **Deploys:** GitHub Actions
  ([`deploy-prod.yml`](.github/workflows/deploy-prod.yml) /
  [`deploy-dev.yml`](.github/workflows/deploy-dev.yml)), not Cloudflare
  Workers Builds. Push to `main` → production; push to `dev` → staging at
  dev.pueblofoodmap.com. No per-PR preview deploy exists (that was a
  Workers Builds feature; it's no longer connected) — `npm run preview`
  (local Worker emulator) is the pre-merge check.
- **Rollback:** CF dashboard → Workers & Pages → `pueblo-food-map` →
  Deployments → pick a previous build → "Rollback to this deployment".

See [AGENTS.md](AGENTS.md) for token management, environment variables,
preview-deploy URL restrictions, and the full deploy runbook.

---

## Architecture

For the mental model — data-aggregator pattern, MapWrapper state machine,
i18n design, form-route triad, and hosting decisions — see
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## Design system

Visual identity tokens and aesthetic rules live in [DESIGN.md](DESIGN.md).
`globals.css @theme` is the canonical token source; DESIGN.md mirrors those
values and adds prose rationale, Do's/Don'ts, and component guidance for
human and AI contributors. Read DESIGN.md before any UI work.

To verify DESIGN.md is in sync with `globals.css`: `npm run design:drift`.
CI enforces this automatically (blocking gate).

---

## Data sources

| Layer | Source | Refresh |
|---|---|---|
| Gardens + landscapes | Pueblo Food Project CGSP page | Manual |
| Pantries + meal sites | Plentiful public directory (`directory.plentiful.org/colorado/pueblo`) | Automated (see below) |
| Grocery / convenience / farms | OpenStreetMap Overpass API | Automated (see below) |
| SNAP / WIC flags | USDA FNS + CDPHE public data | Re-run `scripts/match-benefits.py` |

PFP garden coordinates geocoded against Nominatim (OpenStreetMap) on
2026-05-14 via `scripts/geocode-pfp.py` — audit trail in
`data/raw/pfp-geocodes.json`.

**Re-running the scrapers by hand does NOT update the live map.** Since the
#237 admin cutover, the public map's data comes from Cloudflare D1 via an
explicit admin Publish click (see ARCHITECTURE.md "Data aggregator
pattern") — `scripts/scrape-plentiful.py` and `scripts/ingest-osm-grocery.py`
still exist and still work exactly as before, but their output
(`src/data/pantries-plentiful.ts`, `src/data/grocery-osm.ts`) is no longer
read by the build. This is why venue data went unverified for four months
(2026-05 to 2026-09): the only remaining path to correct a venue was a human
editing it by hand in `/admin`.

**The real refresh path (as of #133/#234's automated pipeline):**
[`.github/workflows/refresh-proposals.yml`](.github/workflows/refresh-proposals.yml)
runs monthly (and on manual dispatch), re-scrapes Plentiful and OSM, diffs
the result against D1's current venues, and writes one `change_proposals`
row per detected difference — including a link-health pass that flags dead
outbound `url`s. It never writes to `venues` directly; every proposal still
needs a human to review and approve before it reaches the public map (that
review UI is a separate, later piece of work — see
`docs/admin/cloudflare-native-admin-spec.md` §6). See
`scripts/refresh-ingest.ts`'s own file header for the full mechanism, and
AGENTS.md's "Automated venue-refresh pipeline" section for operational
detail (guardrails, credentials, local testing).

---

## License

MIT (code). Venue data licensing is coordinated with Pueblo Food Project,
Care & Share Food Bank of Southern Colorado, and other source organizations.

## Acknowledgments

- Pueblo Food Project — primary stakeholder and PFP garden/landscape data
- OpenStreetMap contributors — base tiles and grocery data
- Plentiful — pantry and meal-site directory data
- Pueblo Transit / Trillium Solutions — GTFS feed (directions, future)
