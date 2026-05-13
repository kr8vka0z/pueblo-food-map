# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
