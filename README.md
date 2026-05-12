# Pueblo Food Access Map

A mobile-first web map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, grocery stores — with walking + bus directions powered by Pueblo Transit GTFS data.

Built for [Pueblo Food Project](https://pueblofoodproject.org). Proof of concept targeting the 2026-06-09 PFP team meeting.

## Status

Phase 1 — initial scaffold. Currently renders the 10 PFP community gardens and edible landscapes from [pueblofoodproject.org/cgsp](https://pueblofoodproject.org/cgsp/) on a Leaflet + OpenStreetMap base.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Leaflet + react-leaflet (OpenStreetMap base tiles)
- Static venue data committed in `src/data/venues.ts`

## Roadmap

See the project PRD in the Pueblo Food Project research vault for the full plan. Short version:

1. Base map with PFP gardens — **done**
2. Add 40+ Pueblo pantries from Plentiful directory (`directory.plentiful.org/colorado/pueblo`)
3. Add ~77 grocery / convenience / farm venues from OpenStreetMap Overpass API
4. Category filters and venue detail panels
5. Address input → walking + bus route via OpenTripPlanner + Pueblo Transit GTFS (`data.trilliumtransit.com/gtfs/pueblo-co-us/pueblo-co-us.zip`)
6. Deploy preview URL for PFP team feedback by 2026-06-08
7. Live demo + implementation plan at 2026-06-09 PFP meeting

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

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
