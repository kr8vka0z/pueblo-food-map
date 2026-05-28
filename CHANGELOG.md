# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [0.1.3](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.2...v0.1.3) (2026-05-28)


### Added

* add Cloudflare Workers deploy via OpenNext adapter ([#38](https://github.com/kr8vka0z/pueblo-food-map/issues/38)) ([#49](https://github.com/kr8vka0z/pueblo-food-map/issues/49)) ([189f4e5](https://github.com/kr8vka0z/pueblo-food-map/commit/189f4e56870b046b571d9ba9486133ddc3976096))
* complete Mapbox migration — tests, a11y, docs, Lighthouse re-baseline ([#48](https://github.com/kr8vka0z/pueblo-food-map/issues/48)) ([#59](https://github.com/kr8vka0z/pueblo-food-map/issues/59)) ([e162b44](https://github.com/kr8vka0z/pueblo-food-map/commit/e162b44a3d88179994fc5e776843870714bd952e))
* **i18n:** add EN/ES language toggle ([#68](https://github.com/kr8vka0z/pueblo-food-map/issues/68)) ([#86](https://github.com/kr8vka0z/pueblo-food-map/issues/86)) ([cc0a12c](https://github.com/kr8vka0z/pueblo-food-map/commit/cc0a12c2f49e9b9c425c2784f7d4dc4a1f0ba9dd))
* **map:** add collapsible category color legend ([#72](https://github.com/kr8vka0z/pueblo-food-map/issues/72)) ([#83](https://github.com/kr8vka0z/pueblo-food-map/issues/83)) ([bf2949d](https://github.com/kr8vka0z/pueblo-food-map/commit/bf2949d86cfb417416e79cd866ff3c6af078ebbb))
* **map:** add persistent wordmark that resets map state ([#61](https://github.com/kr8vka0z/pueblo-food-map/issues/61)) ([#89](https://github.com/kr8vka0z/pueblo-food-map/issues/89)) ([498f3b4](https://github.com/kr8vka0z/pueblo-food-map/commit/498f3b4ffa42e5fce711a6e3666add84b546d722))
* **map:** add sponsored by PFP credit link ([#69](https://github.com/kr8vka0z/pueblo-food-map/issues/69)) ([#80](https://github.com/kr8vka0z/pueblo-food-map/issues/80)) ([debf650](https://github.com/kr8vka0z/pueblo-food-map/commit/debf6505ef683023576799f3c54997f7ddfe2714))
* **map:** constrain map view to Pueblo County ([#62](https://github.com/kr8vka0z/pueblo-food-map/issues/62)) ([#87](https://github.com/kr8vka0z/pueblo-food-map/issues/87)) ([bfc3309](https://github.com/kr8vka0z/pueblo-food-map/commit/bfc3309c34aa4fa78f7ef18fb64e125f07a2bfcd))
* **map:** port flyTo / fitBounds / locate flow + reduced-motion guards ([#47](https://github.com/kr8vka0z/pueblo-food-map/issues/47)) ([#58](https://github.com/kr8vka0z/pueblo-food-map/issues/58)) ([e4241bc](https://github.com/kr8vka0z/pueblo-food-map/commit/e4241bcdfa5b5993a06bbb731053fee9a438c4e5))
* **map:** port tooltips, user-location dot, attribution to Mapbox ([#57](https://github.com/kr8vka0z/pueblo-food-map/issues/57)) ([17095d8](https://github.com/kr8vka0z/pueblo-food-map/commit/17095d86498cc370634463b02cc2ff4f29784844)), closes [#46](https://github.com/kr8vka0z/pueblo-food-map/issues/46)
* **map:** port venue markers to Mapbox + Lucide MapPin icon ([#45](https://github.com/kr8vka0z/pueblo-food-map/issues/45)) ([394263e](https://github.com/kr8vka0z/pueblo-food-map/commit/394263eb7c1ba5e56f4c1a2c74be8f33fb60baa3))
* **map:** swap Leaflet for Mapbox GL JS bare basemap ([#44](https://github.com/kr8vka0z/pueblo-food-map/issues/44)) ([#55](https://github.com/kr8vka0z/pueblo-food-map/issues/55)) ([692057f](https://github.com/kr8vka0z/pueblo-food-map/commit/692057f659edb7f76ced0538ad2b9ebdb7478771))
* **report:** venue issue report button + form + email send (closes [#70](https://github.com/kr8vka0z/pueblo-food-map/issues/70)) ([#92](https://github.com/kr8vka0z/pueblo-food-map/issues/92)) ([1b76e3a](https://github.com/kr8vka0z/pueblo-food-map/commit/1b76e3a1cbc2e4b7e07a870a1b2dbda35004072d))
* **search:** add live typeahead results dropdown ([#67](https://github.com/kr8vka0z/pueblo-food-map/issues/67)) ([#90](https://github.com/kr8vka0z/pueblo-food-map/issues/90)) ([edbf70f](https://github.com/kr8vka0z/pueblo-food-map/commit/edbf70f8a65b575ff5ab8f26808f7684efc31b4e))
* **security:** add Cloudflare Turnstile to submission forms (closes [#74](https://github.com/kr8vka0z/pueblo-food-map/issues/74)) ([#94](https://github.com/kr8vka0z/pueblo-food-map/issues/94)) ([0cbcb8e](https://github.com/kr8vka0z/pueblo-food-map/commit/0cbcb8e24c72a96ee3c203c70b4672183fcd3400))
* **suggest:** hamburger menu + suggest-a-venue form + email send (closes [#71](https://github.com/kr8vka0z/pueblo-food-map/issues/71)) ([#93](https://github.com/kr8vka0z/pueblo-food-map/issues/93)) ([b331461](https://github.com/kr8vka0z/pueblo-food-map/commit/b331461bc05f26f59742ccd6405a6854fb19f6f1))
* **venue:** add operator field + PFP attribution in popups ([#63](https://github.com/kr8vka0z/pueblo-food-map/issues/63)) ([#85](https://github.com/kr8vka0z/pueblo-food-map/issues/85)) ([bc58587](https://github.com/kr8vka0z/pueblo-food-map/commit/bc585871a3503092e99cc4f19e2b96c99ad9a9dd))
* **venue:** persistent venue popup header bar ([#64](https://github.com/kr8vka0z/pueblo-food-map/issues/64)) ([#88](https://github.com/kr8vka0z/pueblo-food-map/issues/88)) ([381904c](https://github.com/kr8vka0z/pueblo-food-map/commit/381904c9dcb6d1c9ad4dcd6449cda94723b1bd1d))


### Fixed

* **map:** locate button recenters on every tap ([#60](https://github.com/kr8vka0z/pueblo-food-map/issues/60)) ([#79](https://github.com/kr8vka0z/pueblo-food-map/issues/79)) ([47db6ce](https://github.com/kr8vka0z/pueblo-food-map/commit/47db6ce1b75110bb6eb7bd04186d645c3f6338dc))
* **venue:** today row highlight in hours list ([#66](https://github.com/kr8vka0z/pueblo-food-map/issues/66)) ([#81](https://github.com/kr8vka0z/pueblo-food-map/issues/81)) ([acbaf0b](https://github.com/kr8vka0z/pueblo-food-map/commit/acbaf0bbed9e71930afc079cfb15b7a0b63db057))


### Changed

* **agents:** document Cloudflare Workers deploy + CI flow ([#51](https://github.com/kr8vka0z/pueblo-food-map/issues/51)) ([6ed0779](https://github.com/kr8vka0z/pueblo-food-map/commit/6ed07797d5b0f363f8bd3f3baf05732859ed8ce7))
* **agents:** document Mapbox token management (public + secret tokens) ([#54](https://github.com/kr8vka0z/pueblo-food-map/issues/54)) ([3ab67f4](https://github.com/kr8vka0z/pueblo-food-map/commit/3ab67f49319c858436d1561d387b8f09ca8018f1)), closes [#43](https://github.com/kr8vka0z/pueblo-food-map/issues/43)
* switch production URL references to pueblofoodmap.com ([#52](https://github.com/kr8vka0z/pueblo-food-map/issues/52)) ([c3b55bc](https://github.com/kr8vka0z/pueblo-food-map/commit/c3b55bca49e73cdae8f9320e3c23d465033ada1b)), closes [#41](https://github.com/kr8vka0z/pueblo-food-map/issues/41)

## [0.1.2](https://github.com/kr8vka0z/pueblo-food-map/compare/v0.1.1...v0.1.2) (2026-05-17)


### Added

* **v2:** LocationDeniedBanner component ([#33](https://github.com/kr8vka0z/pueblo-food-map/issues/33)) ([b0a75c8](https://github.com/kr8vka0z/pueblo-food-map/commit/b0a75c804d6421a62a8c21d0bd5d80030b73bc90))
* **v2:** Lucide MapPin pin markers with category color + sage selected ring ([#27](https://github.com/kr8vka0z/pueblo-food-map/issues/27)) ([076097a](https://github.com/kr8vka0z/pueblo-food-map/commit/076097a3f2aa0fcab77cada10aaa1cf6c4b103ed))
* **v2:** searchVenues filter (name + readable category) ([#31](https://github.com/kr8vka0z/pueblo-food-map/issues/31)) ([5ef9059](https://github.com/kr8vka0z/pueblo-food-map/commit/5ef9059e0b431859881f56446035fa3121fcad3f))
* **v2:** vaul-based BottomSheet v2 with peek/quick/full snap points + Dialog.Title fix ([#32](https://github.com/kr8vka0z/pueblo-food-map/issues/32)) ([ef3bfb6](https://github.com/kr8vka0z/pueblo-food-map/commit/ef3bfb6d19b948b612e6a3482c013f3ab2406f7e))


### Fixed

* restore body height so map container can resolve h-full ([#36](https://github.com/kr8vka0z/pueblo-food-map/issues/36)) ([46ceccb](https://github.com/kr8vka0z/pueblo-food-map/commit/46ceccb0251e4f8193b4d737062901d5faa25e3e))


### Changed

* **v2:** demo-readiness checklist ([#35](https://github.com/kr8vka0z/pueblo-food-map/issues/35)) ([4798c51](https://github.com/kr8vka0z/pueblo-food-map/commit/4798c51b236ec4967c7c092c3f8bcb5b0fa1c726))

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
