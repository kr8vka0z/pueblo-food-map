# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [0.1.1](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.0...v0.1.1) (2026-05-15)


### Added

* **data:** ingest Plentiful pantry directory for Pueblo ([#21](https://github.com/kr8vka0z/pueblo-food-map/issues/21)) ([94b731d](https://github.com/kr8vka0z/pueblo-food-map/commit/94b731d7d49073f5a0b50e22562583370fbd6f20))
* **design:** land PR 2 — new layout, custom markers, search, basemap, detail panel ([#22](https://github.com/kr8vka0z/pueblo-food-map/issues/22)) ([d21caca](https://github.com/kr8vka0z/pueblo-food-map/commit/d21cacaa33911f5e37feec598dc24ad32d76271c))
* **design:** PR 3 — Spanish translations, empty states, reduced motion ([#23](https://github.com/kr8vka0z/pueblo-food-map/issues/23)) ([a433e91](https://github.com/kr8vka0z/pueblo-food-map/commit/a433e91244a74ac7fc13b9c63f1cd099a2bfd78d))
* **design:** swap to Inter + Fraunces and add full design-system token set ([#20](https://github.com/kr8vka0z/pueblo-food-map/issues/20)) ([380f7b6](https://github.com/kr8vka0z/pueblo-food-map/commit/380f7b60ebd43714e7b1c4f1f8aaa05c01331761))

## [Unreleased]

### Added

- `scripts/geocode-pfp.py` — reproducible Nominatim geocoder for the ten PFP
  venues. Honors Nominatim's usage policy (custom User-Agent with contact
  email, 1.1s rate limit, Pueblo-county `viewbox` bias) and supports per-id
  manual overrides for addresses Nominatim cannot resolve to a single node.
  Writes a full audit trail to `data/raw/pfp-geocodes.json`.

### Changed

- Replaced the placeholder latitude/longitude on every PFP community garden and
  edible-landscape venue with precise geocodes from Nominatim. Some pins
  shifted by more than four miles, including Bethany Lutheran (4.30 mi),
  JJ Raigoza Park (3.37 mi), and Ray Aguilera Garden (3.27 mi). See
  `data/raw/pfp-geocodes.json` for the matched OSM ids and display names.
- Updated the listed address for La Familia Community Garden from the
  "5th & Hudson" intersection to "814 E 5th St, Pueblo, CO 81001" (the
  actual lot the garden sits on, per PFP).
- Ray Aguilera Community Garden uses a manual coordinate supplied by PFP
  because the garden plot sits south of the OSM Ray Aguilera Park centroid.

## [0.1.0] - 2026-05-12

### Added

- Initial scaffold of the Pueblo Food Access Map proof of concept (Next.js 16
  App Router, TypeScript, Tailwind v4, Leaflet + react-leaflet).
- Static venue data file (`src/data/venues.ts`) seeded with the ten Pueblo
  Food Project community gardens and edible landscapes from
  [pueblofoodproject.org/cgsp](https://pueblofoodproject.org/cgsp/).
- Distance-sorted sidebar listing every venue with a colored category dot,
  name, type, address, and Haversine distance in miles.
- Geolocation request on first load; when granted, the sidebar sorts from the
  user's actual position and a blue "You are here" marker is drawn on the
  map. When denied or unavailable, the sidebar falls back to distance from
  downtown Pueblo and shows a status message explaining why.
- Hover-driven Leaflet tooltips on every venue marker. Mousing over a marker
  reveals name, category, address, hours, contact info, and notes. Click in
  the sidebar to fly the map to that venue and visually emphasize its
  marker.
- Mobile responsive layout (sidebar stacks above map below the `md`
  breakpoint).

### Changed

- Replaced the default Next.js scaffold page with the production map UI.

[Unreleased]: https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kr8vka0z/pueblo-food-map/releases/tag/v0.1.0
