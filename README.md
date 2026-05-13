# Pueblo Food Access Map

A mobile-first web map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, grocery stores — with walking + bus directions powered by Pueblo Transit GTFS data.

Built for [Pueblo Food Project](https://pueblofoodproject.org). Proof of concept targeting the 2026-06-09 PFP team meeting.

## Status

Phase 1, in progress. The map renders 74 markers — 10 PFP community gardens and edible landscapes from [pueblofoodproject.org/cgsp](https://pueblofoodproject.org/cgsp/) plus 64 grocery, convenience, and farm venues ingested from OpenStreetMap — on a Leaflet + OpenStreetMap base, with a distance-sorted sidebar, hover tooltips, and a "fly to nearest" geolocation flow.

> ⚠️ **PFP garden coordinates are placeholders.** The 10 PFP venues currently use rough latitude/longitude values guessed from each street address, and most of them do not match the listed addresses on the map. They need to be re-geocoded against a real address service (e.g. Nominatim) before the live demo on 2026-06-09. The OpenStreetMap venues are correct.

## Live preview

- Production: <https://pueblo-food-map.vercel.app> — auto-deploys on every merge to `main`.
- Every pull request gets its own preview URL via the Vercel ↔ GitHub integration; the link is posted as a status check on the PR.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Leaflet + react-leaflet (OpenStreetMap base tiles)
- Static venue data committed in `src/data/venues.ts`

## Roadmap

See the project PRD in the Pueblo Food Project research vault for the full plan. Short version:

1. Base map with 10 PFP gardens + edible landscapes — scaffold **done**; coordinates need real geocoding.
2. Ingest grocery / convenience / farm venues from OpenStreetMap Overpass API — **done** (64 venues).
3. Re-geocode the PFP venues against a real address service so pins land at the right buildings.
4. Add 40+ Pueblo pantries from Plentiful directory (`directory.plentiful.org/colorado/pueblo`).
5. Category filters and venue detail panels.
6. Address input → walking + bus route via OpenTripPlanner + Pueblo Transit GTFS (`data.trilliumtransit.com/gtfs/pueblo-co-us/pueblo-co-us.zip`).
7. Live demo + implementation plan at the 2026-06-09 PFP meeting.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The dev server uses Turbopack and hot-reloads on save.

## Project infrastructure

- **CI:** `lint → typecheck → build` runs on every PR and on every push to `main` via [`.github/workflows/ci.yml`](.github/workflows/ci.yml). The job name "Lint, typecheck, build" is the required status check on `main`.
- **Preview deploys:** Vercel builds a preview environment for every pull request and rebuilds production on every merge to `main`.
- **Dependency updates:** [Dependabot](.github/dependabot.yml) opens weekly PRs for npm packages and GitHub Actions, with non-breaking updates grouped into single PRs. ESLint major-version bumps are currently gated until `eslint-plugin-react` ships ESLint 10 support.
- **Code review:** every human-authored pull request is reviewed by the [Claude Code GitHub Action](.github/workflows/claude-code-review.yml); mention `@claude` in a comment to ask follow-up questions.
- **Branch protection:** `main` requires a passing CI status check, a linear history, an up-to-date branch, and resolved conversations on every PR.

## Data sources

| Layer | Source | Refresh |
|---|---|---|
| Gardens + landscapes | Pueblo Food Project CGSP page | Manual, currently |
| Pantries | Plentiful public directory | Scheduled scrape (not yet wired) |
| Grocery / convenience / farms | OpenStreetMap Overpass API | Scheduled query (not yet wired) |
| Bus routes + stops + schedules | Pueblo Transit GTFS via Trillium | Nightly fetch (not yet wired) |

## License

MIT (code). Venue data licensing pending coordination with Pueblo Food Project, Care & Share Food Bank of Southern Colorado, and other source organizations.

## Acknowledgments

- Pueblo Food Project — primary stakeholder + data source for gardens and landscapes
- Pueblo Transit — GTFS feed
- Trillium Solutions — GTFS hosting
- OpenStreetMap contributors — base tiles + grocery data
- Plentiful — pantry directory data
