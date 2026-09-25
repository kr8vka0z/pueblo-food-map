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

Requirements: Node.js 22 (see `.node-version`).

```bash
git clone https://github.com/kr8vka0z/pueblo-food-map.git
cd pueblo-food-map
cp .env.example .env.local   # fill in NEXT_PUBLIC_MAPBOX_TOKEN
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
| `npm run deploy` | Manual OpenNext build + `wrangler deploy` of the production Worker — don't use it; deploys go only through CI (see below) |
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
    layout.tsx       Root layout (metadata, font preload, LocaleProvider)
    report/          Venue issue-report form + POST handler
    suggest/         Suggest-a-venue form + POST handler
    feedback/        General feedback form + POST handler
  components/      React components (map canvas, bottom sheet, search, etc.)
  data/            Static venue data (committed TypeScript modules)
    venues.ts        Public venue list — single import for all components
    published-venues.ts  Snapshot of D1 venues, written by admin Publish (do not edit by hand)
    grocery-osm.ts, pantries-plentiful.ts, pfp-venues.ts
                     Scraper/hand-curated source arrays — not read by the public
                     map since the #237 D1 cutover (seed script, tests, refresh diff)
    pueblo-bbox.ts   Pueblo County geographic constants
  lib/             Shared utilities (i18n, hours, favorites, distance, etc.)
  types/
    venue.ts         Canonical Venue interface and VenueCategory type

data/
  raw/             Raw source files (OSM JSON, PFP geocodes, etc.)

scripts/           Data pipeline, seed, and lint scripts (never imported by the app)
                   — every script is listed in scripts/README.md
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

- **CI:** `lint → design:lint → design:drift → typecheck → test → audit →
  build` on every PR into `main` or `dev`, and every push to `main`
  ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- **AI review:** CodeRabbit reviews human-authored pull requests targeting
  `dev` or `main` using the low-noise settings in [`.coderabbit.yaml`](.coderabbit.yaml).
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
preview-deploy URL restrictions, and the full deploy playbook.

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
| SNAP / WIC flags | USDA FNS + CDPHE public data (matched into D1 by migration `0014`, #597) | Admin-editable in D1 directly |

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
editing it by hand in the admin panel (`/admin/places`).

**The real refresh path (as of #133/#234's automated pipeline):**
[`.github/workflows/refresh-proposals.yml`](.github/workflows/refresh-proposals.yml)
runs weekly (and on manual dispatch), re-scrapes Plentiful and OSM, diffs
the result against D1's current venues, and writes one `change_proposals`
row per detected difference — including a link-health pass that flags dead
outbound `url`s. It writes to `venues` in exactly one bounded case: a
"date-only" proposal (nothing changed but the last-checked date) auto-
applies rather than waiting on a click (Kyle, 2026-09-15). Every other
proposal still needs a human to review and approve it at `/admin/flags`
before it reaches the public map. See
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
