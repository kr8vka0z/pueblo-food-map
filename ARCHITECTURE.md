# Architecture — Pueblo Food Map

> Reader: human engineers and AI coders who need the mental model before
> touching code. For operational tasks (token management, deploy, rollback)
> see [AGENTS.md](AGENTS.md).

---

## What this is

A static, mobile-first civic web map of free and low-cost food resources in
Pueblo County, Colorado. The audience is low-income and food-insecure
residents, many of whom are Spanish-speaking. Venue data is served from
static TypeScript modules committed to the repo — no backend database.
Visual identity is codified in [DESIGN.md](DESIGN.md) (agent-facing token
mirror and aesthetic guide; `globals.css @theme` is the canonical token source).

---

## Components at a glance

```
Browser
  └── SplashScreen (first-visit gate, z-9000 overlay)
  └── MapWrapper   (all state + interaction logic)
        ├── Map.tsx          (Mapbox GL canvas; SSR-skipped via dynamic import)
        ├── VenueMarker.tsx  (Lucide MapPin button inside each Mapbox Marker)
        ├── BottomSheet.tsx  (mobile: vaul v2 bottom sheet)
        ├── DesktopVenueWindow.tsx  (desktop: marker-anchored detail panel)
        ├── SearchBar / SearchResultsPopover / CategoryDropdown
        ├── LocateButton     (geolocate + drift / re-center)
        ├── HamburgerMenu    (saved places, help links, language, view toggle)
        └── ListView         (full-screen nearest-first list, map mode off)

Shared utility components
  └── src/components/SiteFooter.tsx  (slim nav footer on utility pages: /about, /privacy, /suggest, /feedback)

Next.js App Router (Cloudflare Worker, SSR)
  └── src/app/layout.tsx      (reads pfm-locale cookie; wraps with LocaleProvider)
  └── src/app/page.tsx        (splash gate; mounts MapWrapper)
  └── src/app/about/page.tsx  (mission, vision, origin story, venue sourcing — #155)
  └── src/app/report/[venueId]/page.tsx + submit/route.ts
  └── src/app/suggest/page.tsx + submit/route.ts
  └── src/app/feedback/page.tsx + submit/route.ts

  └── DirectionButtons.tsx  (Walk / Bus / Drive buttons; Walk triggers in-app route + collapsible turn-by-turn step list + "Open in Google Maps" walk handoff; Bus/Drive open Google Maps)

Data layer (static TS modules, no API calls at render time)
  └── src/data/venues.ts          (aggregator — see "Data aggregator" below)
  └── src/data/grocery-osm.ts     (OSM Overpass, auto-generated)
  └── src/data/pantries-plentiful.ts  (Plentiful directory, auto-generated)
  └── src/data/benefit-flags.ts   (SNAP/WIC overlay, auto-generated)
  └── src/types/venue.ts          (canonical Venue type)

Lib
  └── src/lib/i18n.ts             (EN/ES dictionaries + t() shim)
  └── src/lib/LocaleContext.tsx   (React context; cookie persistence)
  └── src/lib/hours.ts            (open-status logic)
  └── src/lib/parseOsmHours.ts    (OSM opening_hours string → WeeklyHours)
  └── src/lib/turnstile.ts        (Cloudflare Turnstile server-side verify)
  └── src/lib/favorites.ts        (localStorage favorites store)
  └── src/lib/distance.ts         (Haversine distance)
  └── src/lib/searchVenues.ts     (text search over filtered venue list)

Scripts (run locally; never imported by the app)
  └── scripts/ingest-osm-grocery.py   (Overpass → grocery-osm.ts)
  └── scripts/scrape-plentiful.py     (Plentiful → pantries-plentiful.ts)
  └── scripts/match-benefits.py       (USDA FNS + CDPHE → benefit-flags.ts)
  └── scripts/geocode-pfp.py          (Nominatim geocoder for PFP venues)
```

---

## Data aggregator pattern

All venue data is served from a single export: `venues` in
`src/data/venues.ts`. Components never import from `grocery-osm.ts` or
`pantries-plentiful.ts` directly.

The aggregator merges three source arrays, then applies SNAP/WIC flags as a
separate overlay:

```
pfpVenues          (hand-curated, PFP CGSP page)
groceryOsmVenues   (auto-generated from OSM Overpass query)
plentifulPantries  (auto-generated from Plentiful directory scrape)
           ↓
venues = [...pfpVenues, ...groceryOsmVenues, ...plentifulPantries]
           ↓ .map()
           + benefitFlags overlay (keyed by id; sourced from USDA FNS + CDPHE)
           ↓
export const venues: Venue[]
```

**Why PFP first:** hand-curated venues carry richer metadata (notes,
partnerships, operator field). Ordering PFP first means any future
de-duplication pass will prefer the richer record.

**Why benefit flags are separate:** the auto-generated OSM and Plentiful data
is regenerated periodically by re-running the scripts. Storing SNAP/WIC
acceptance inline would lose the flags every time the data is regenerated.
The `benefit-flags.ts` overlay survives regeneration because it is keyed by
stable venue `id` and merged on top at aggregation time (see issue #127).

**Canonical type:** `src/types/venue.ts` defines the `Venue` interface and
`VenueCategory` union. Every data source conforms to this type; there is no
source-specific type.

---

## Viewport / selection state machine (MapWrapper)

All interactive state lives in `MapWrapper` (`src/components/MapWrapper.tsx`).
`Map.tsx` is a controlled component — it receives props and fires callbacks;
it holds no business logic.

Key state atoms and their roles:

| State | Type | Purpose |
|---|---|---|
| `selectedVenueId` | `string \| null` | Which venue card is open |
| `viewport` | `'located' \| 'pueblo-center'` | Splash exit mode; determines initial map center |
| `viewMode` | `'map' \| 'list'` | Map canvas vs. full-screen list |
| `query` | `string` | Text search input |
| `selectedCategories` | `Set<VenueCategory> \| null` | Multi-select category filter |
| `activeCategoryFilter` | `VenueCategory \| null` | Single-select from category dropdown; syncs into `selectedCategories` and triggers autozoom |
| `filterOpenNow / filterSnap / filterWic / filterFavorites` | `boolean` | Boolean filter toggles |
| `isDrifted` | `boolean` | True when user-location dot has left the visible viewport — shows "Re-center" button |
| `isLocating` | `boolean` | True while a geo request is in-flight — shows spinner in LocateButton |
| `bannerVisible` | `boolean` | Location-denied banner after an active re-tap |
| `outsideCountyVisible` | `boolean` | Toast when resolved position is outside Pueblo County |
| `isPopoverOpen / activeIndex` | `boolean / number` | Typeahead popover ARIA state |
| `sheetFullyExpanded` | `boolean` | Bottom sheet snap; hides SponsorCredit when true |
| `windowExpanded` | `boolean` | Desktop venue window expanded state |
| `mapboxMap` | `mapboxgl.Map \| null` | Map instance; received via `onMapReady` callback from Map.tsx |
| `walkingRoute` | `WalkingRouteGeoJSON \| null` | Active walking route GeoJSON (Mapbox Directions API) — passed to Map.tsx as a prop |
| `walkingRouteInfo` | `WalkingRouteInfo \| null` | Distance + time text for the route info pill overlay |
| `walkingRouteSteps` | `WalkStep[] \| null` | Turn-by-turn steps from Mapbox (pre-localized via `language=` param); threaded to DirectionButtons for the collapsible step list |
| `walkingRouteVenueId` | `string \| null` | Which venue the current route targets; used to auto-clear when selection changes |
| `walkReqSeq` | `ref<number>` | Monotonic sequence counter for in-flight walk fetches. Incremented at the start of each `handleWalkRoute` call (non-toggle path), and on every explicit clear (toggle-off, `handleClearWalkingRoute`). On resolution the fetch's captured `seq` snapshot is compared to the current counter; if they differ the result is discarded (latest-REQUEST-wins, not latest-resolve-wins). Keys on a monotonic int rather than `venue.id` so same-venue double-taps with a changed `userLocation` are also caught. NOT bumped in the `selectedVenueId`-change effect — the render-gate on the Map `walkingRoute` prop (`walkingRouteVenueId === selectedVenueId ? walkingRoute : null`) is the safety net for selection-switch races, preserving the seq so a same-task select+walk-for-new-venue can succeed |

**Walking route step parsing:**
`parseWalkSteps(route)` is an exported pure function in `MapWrapper.tsx`. It converts the raw Mapbox Directions API legs/steps array to `WalkStep[]`, with defensive optional-chaining on `maneuver?.instruction` so a malformed step is dropped (not thrown). Exported for unit testing without mounting MapWrapper (mirrors `buildWalkingRouteUrl` pattern).

**Filtering pipeline** (computed in `useMemo`, run on every state change):

1. `allVenues` (stable module-level array) → attach Haversine distances from
   `origin` (user position or Pueblo center).
2. Apply category, open-now, SNAP, WIC, favorites, walking-distance filters.
3. Sort nearest-first.
4. Apply text search (`searchVenues`).
5. Result: `filteredVenues` — the only venue list passed to `Map` and `ListView`.

**Geolocation flow:**

```
User taps LocateButton
  → handleLocateRequest()
    → stamps userRequestedAtRef
    → increments recenterRequestId  (Map.tsx flyTo fires even if position unchanged)
    → calls geo.request()
  → useEffect watches geo.state
    → clears isLocating when permission resolves
    → shows bannerVisible if permission === 'denied' AND a fresh request was pending
    → shows outsideCountyVisible if position is outside PUEBLO_COUNTY_BBOX
```

**Splash → auto-locate:**
`SplashScreen` and `MapWrapper` run separate `useGeolocation` instances.
When the user picks "Find food near me" on the splash, the map starts with
no position. A `useEffect` on `viewport === 'located'` runs `handleLocateRequest`
once on mount so the map centers on the user without a second tap (see issue
#141 and the comment at `autoLocateDoneRef`).

**Drift detection:**
`handleMoveEnd` (called from `Map.tsx` `onMoveEnd` prop after each camera
move) checks whether the user-location dot is inside the current viewport
bounds, shrunk by `DRIFT_PAD_DEG` on every edge. The 0.002° buffer (~220 m)
prevents the "Re-center" button from flickering when the dot is exactly at
the edge.

---

## i18n model

EN and ES dictionaries live in `src/lib/i18n.ts` as plain `Record<string, string>`
objects. `t(key, locale, vars?)` looks up the ES dict first, falls back to EN
if a key is missing.

**Locale persistence:** `LocaleContext` (`src/lib/LocaleContext.tsx`) holds the
active locale in React state and writes it to the `pfm-locale` cookie on
change. `layout.tsx` reads the cookie server-side so the initial SSR render
uses the user's preference — avoiding an EN flash for Spanish-language users.

**Translation notes:**
- Mexican / Latin American Spanish throughout (not Castilian).
- US government program names (SNAP, WIC) are not translated.
- Keys marked `[CHECK]` in the ES dictionary need review by a native
  Mexican-Spanish speaker for regional naturalness.

---

## Form-route triad

Three user-submission flows share the same structure:

```
/report/[venueId]/page.tsx   → ReportForm   → POST /report/submit
/suggest/page.tsx            → SuggestForm  → POST /suggest/submit
/feedback/page.tsx           → FeedbackForm → POST /feedback/submit
```

Each route handler (`src/app/*/submit/route.ts`) runs the same pipeline:

1. Content-Type guard
2. **Cloudflare Turnstile** verification — rejects bots before any further
   processing. The client widget (`@marsidev/react-turnstile`) renders inside
   the form; its response token is submitted with the form data.
3. Honeypot check — a hidden `website` field; bots fill it, humans don't.
   Returns a fake `{ok: true}` to bots (silent drop, no signal).
4. IP-based rate limit — in-process sliding window, 5 req/IP/hour.
   Resets on Worker cold-start; sufficient for v1 volume.
5. Server-side field validation (mirrors client-side).
6. Email via Resend to the appropriate `@pueblofoodmap.com` address.

**Why Turnstile over reCAPTCHA:** the app runs on Cloudflare Workers.
Turnstile is a first-party Cloudflare product with a simpler integration
model and no Google dependency — appropriate for a civic app serving
populations that may distrust Google tracking.

**PII policy:** IP addresses are used only for rate-limiting — never logged or
persisted. Contact emails go to Resend in the email body; the route handlers
do not log them.

**Note — rate limiter duplication:** the rate-limit code is currently
duplicated across all three submit routes. A refactor to extract it to
`src/lib/rateLimit.ts` is tracked separately; inline docs for those blocks
should follow after that change lands.

---

## Map library — Mapbox GL JS via react-map-gl

The map renders via `mapbox-gl` v3 + `react-map-gl` v8 (import path
`react-map-gl/mapbox`), using the `streets-v12` Mapbox hosted basemap style.

**Why Mapbox over Leaflet:** the app was migrated from react-leaflet to
react-map-gl / Mapbox GL JS (README: "Phase 2 complete (Mapbox migration)").
The commit that performed this migration is not present in the current
shallow git history. See open questions below.

**SSR exclusion and TBT reduction:** `mapbox-gl` calls `globalThis` and
requires a WebGL canvas; it cannot run server-side. `MapWrapper.tsx` uses
`next/dynamic` with `ssr: false` to load `Map.tsx` only on the client. This
dynamic import must stay in a Client Component (`"use client"`) — `ssr: false`
is silently ignored in Server Components per the Next.js lazy-loading docs.

**Page-level code-splitting (#202):** `page.tsx` also dynamically imports
`MapWrapper` and `SplashScreen` (both with `ssr: false`). WHY: the page
returns `null` during SSR (hydration-safe), so `ssr: false` has no effect on
server output — it moves ~200KB of synchronous client JS (vaul bottom sheet,
Radix UI, geolocation hooks, venue data) from the blocking initial parse/exec
window into async chunks, reducing TBT on throttled mobile. Mapbox GL JS
(1.7MB) was already async via the nested dynamic in MapWrapper; this change
eliminates the remaining sync JS that dominated TBT after Mapbox.

**Token scopes:** the public token (`pk.*`, `NEXT_PUBLIC_MAPBOX_TOKEN`) needs
only `styles:read`, `fonts:read`, `tilesets:read`. Narrowing the scope
reduces the blast radius if the token leaks via client bundle inspection.
See [AGENTS.md](AGENTS.md) for rotation procedure and URL restrictions.

---

## Hosting — Cloudflare Workers via OpenNext

The app is a Next.js App Router project compiled for Cloudflare Workers by
`@opennextjs/cloudflare`. The adapter (`open-next.config.ts`) translates
the App Router output (server components, route handlers, edge runtime) into
a Workers-compatible bundle.

**Why Cloudflare Workers over Vercel:** the project migrated off Vercel to
Cloudflare Workers Builds. The reason for this migration is not in the
current shallow git history; see open questions below.

**CI/CD:** Cloudflare Workers Builds is connected to the GitHub repo via the
CF dashboard — there is no GitHub Actions YAML for deploys. GitHub Actions
runs `lint → typecheck → build` only (`.github/workflows/ci.yml`). A green
CI run is necessary but not sufficient: Cloudflare Workers Builds is a
separate system with its own build logs.

**Route handlers as Workers:** Next.js route handlers (`submit/route.ts`)
compile to Worker fetch handlers. The in-process rate-limit `Map` is in
Worker memory — it resets on cold-start, which is acceptable for v1 volume.

**Environment variables:** `NEXT_PUBLIC_*` vars are baked into the client
bundle at build time — set them as **build variables** (Settings → Build →
Build variables) before triggering a build. Workers Builds has one shared
build-variable set and a single `production` environment; there is no separate
Preview environment (that's a Cloudflare Pages concept). Runtime secrets
(`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) are set separately under Settings
→ Variables and Secrets.

See [AGENTS.md](AGENTS.md) for deploy, rollback, env-var management, and
Mapbox token management.

---

## Splash gate and first-visit flow

```
page.tsx mounts
  → reads localStorage key 'pfm.splash.seen.v2'
  → if not set:  show SplashScreen overlay (z-9000) above the live map
  → if set:      skip to interactive map
  → if ?venue=<id> in URL: skip splash, open deep-linked venue

SplashScreen CTA "Find food near me"
  → requests geolocation
  → on grant: dismissSplash('located') → sets GATE_KEY, passes viewport='located' to MapWrapper
  → on deny:  dismissSplash('pueblo-center')

"Show welcome screen" hamburger menu item (#99)
  → re-shows splash overlay WITHOUT clearing GATE_KEY
  → user returns to map with same state on re-dismiss
```

The map is always mounted under the splash so the basemap loads in
parallel. While the splash is visible, `main` receives `inert` and
`aria-hidden` so keyboard and screen-reader users cannot reach the map.

---

## Open questions

These could not be confirmed from the current git history or code comments.
They need an answer from the author before they can be documented as facts.

- **Why Mapbox over Leaflet (specific reason)?** The README notes "Phase 2 complete
  (Mapbox migration)" but the migration commit is not in the shallow worktree
  history. Likely reasons: vector tiles, smoother animations, better mobile
  performance — but this should not be asserted without confirmation.

- **Why Cloudflare Workers over Vercel (specific reason)?** The project
  description notes a migration from Vercel, confirmed in the project memory
  entry (2026-06-17), but the reason is not in the current code or visible
  history. Possible reasons: cost, Workers-native Turnstile, edge runtime
  semantics — unconfirmed.
