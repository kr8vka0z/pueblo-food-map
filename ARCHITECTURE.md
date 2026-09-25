# Architecture — Pueblo Food Map

> Reader: human engineers and AI coders who need the mental model before
> touching code. For operational tasks (tokens, secrets, deploy, rollback,
> migrations) see [AGENTS.md](AGENTS.md).

This file describes the current design only. Build narratives, superseded
designs and incident write-ups that used to live here were moved on
2026-09-24 to the atlas-kb note "PFM ARCHITECTURE History — 2026-09-24
Trim" (alongside the "PFM AGENTS History — …" notes). Most source files also
carry a header comment with the detailed WHY; this file links to them rather
than repeating them.

---

## What this is

A static, mobile-first civic web map of free and low-cost food resources in
Pueblo County, Colorado. The audience is low-income and food-insecure
residents, many of whom are Spanish-speaking. Venues are edited in a
Cloudflare D1 database through the admin panel and published into a static
TypeScript snapshot the build imports, so the public map makes no runtime
venue fetch (blessing boxes are the one exception — read live from D1).
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
        ├── BottomSheet.tsx  (mobile: vaul bottom sheet)
        ├── DesktopVenueWindow.tsx  (desktop: marker-anchored detail panel)
        ├── DirectionButtons.tsx  (Walk: in-app route + WalkStepper, #555;
        │     Bus/Drive: Google Maps deep links)
        ├── SearchBar / ViewSuggestion / SearchResultsPopover / FilterPanel
        │     (Filters button opens FilterPanel — categories + Open now/SNAP/
        │     WIC, #513. No standing Map/List control, #514: an empty focused
        │     bar offers the other view, a typed one adds "See all N matches
        │     as a list", and the Menu has a List/Map line)
        ├── HamburgerMenu    (drawer: List/Map line, saved places, links,
        │     language; opened by BottomNav at a section)
        ├── ListView         (full-screen nearest-first list, map mode off)
        └── BottomNav        (Near me · Saved · Boxes · Help · Menu — bar below
              2xl (1536px), floating pill at 2xl+; Boxes toggles the
              blessing_box filter, #516; docs/bottom-nav-spec.md)

Next.js App Router (Cloudflare Worker)
  └── src/app/layout.tsx      (metadata, font preload; wraps with LocaleProvider — reads no cookie)
  └── src/app/page.tsx        (Server Component: venue-index JSON-LD, metadata;
        mounts HomePageClient.tsx — splash gate + MapWrapper)
  └── src/app/about, privacy, resources, venues, venue/[id], box/[id] …
        (public pages; each localized body is a client "Content" component)
  └── src/app/api/public/**   (unauthenticated box reads and writes)
  └── src/app/report/[venueId], suggest, feedback  (+ submit/route.ts each)
  └── src/app/admin/**, src/app/api/admin/**  (admin panel — see "Admin panel")
  └── SiteFooter.tsx (slim nav footer on the utility pages)

Data layer (static TS modules, no API calls at render time)
  └── src/data/venues.ts          (public venue list — see "Data aggregator" below)
  └── src/data/published-venues.ts    (D1 snapshot written by admin Publish)
  └── src/data/pfp-venues.ts, grocery-osm.ts, pantries-plentiful.ts
        (source arrays; not read by the public map since the #237 cutover)
  └── src/types/venue.ts          (canonical Venue type)

Lib (selected)
  └── src/lib/i18n.ts, LocaleContext.tsx, useDocumentTitle.ts  (i18n)
  └── src/lib/hours.ts, parseOsmHours.ts   (open-status logic)
  └── src/lib/favorites.ts, distance.ts, searchVenues.ts
  └── src/lib/turnstile.ts, formRateLimit.ts  (form protection)
  └── src/lib/adminDb.ts, adminSession.ts, adminOrigin.ts  (admin gate)
  └── src/lib/publishVenues.ts    (Publish engine)
  └── src/lib/blessingBoxes.ts    (live box reads)

Scripts (never imported by the app) — every one is listed, with run order,
in scripts/README.md
```

---

## Data aggregator pattern

All venue data is served from a single export: `venues` in
`src/data/venues.ts`. Components never import `published-venues.ts` or the
source arrays directly.

```
Cloudflare D1 `venues` (status draft/published, category != blessing_box)
           ↓  admin clicks Publish → POST /api/admin/publish
           ↓  (src/lib/publishVenues.ts: snapshot, validate, commit via a
           ↓   publish-bot PR, then promote drafts in D1)
src/data/published-venues.ts   (literal Venue[] array + publishedAt)
           ↓
export const venues: Venue[]   (src/data/venues.ts — re-exported directly)
```

**D1 is the source of truth; `published-venues.ts` is its build-time
snapshot.** Since the #237 admin cutover the file is regenerated in full by
every Publish (its own header says do not hand-edit). `venues.ts` reads it as
a static ESM import, so the public map does no runtime venue fetch and the
pages stay statically cacheable. The snapshot is ordered by `id`
(`fetchPublishSnapshot`, `publishVenues.ts`). How Publish works: "Admin
panel" below.

**The source arrays no longer feed the map.** `pfp-venues.ts` holds the 10
hand-curated Pueblo Food Project records; `grocery-osm.ts` and
`pantries-plentiful.ts` are still regenerated by the scrapers. Only
`scripts/seed-admin-db.ts` (the one-time #237 D1 seed) and tests import
them now; the refresh pipeline reads the two scraper outputs to diff
against D1 — see "Automated venue-refresh pipeline" below.

**SNAP/WIC acceptance is a plain D1 field, admin-editable, no overlay.**
It used to live only in a static `benefit-flags.ts` file applied as a
runtime overlay so it survived scraper regeneration (#127). Migration
`0014` copied those matches into D1's `accepts_snap`/`accepts_wic` columns
(filling only NULLs), production got the migration and a Publish on
2026-09-25, and the overlay was deleted as dead code (#597) — D1 is now the
sole, permanently admin-editable source for both fields.

**Blessing boxes bypass this entirely** — see "Blessing Boxes" below.

**Canonical type:** `src/types/venue.ts` defines the `Venue` interface and
`VenueCategory` union. Every data source conforms to this type; there is no
source-specific type.

---

## Automated venue-refresh pipeline

**Why it exists:** after the #237 cutover, re-running the scrapers only
rewrote source `.ts` files nothing reads, so the only way to change a live
venue was a hand edit in `/admin` — every `last_verified` sat at 2026-05 for
four months. The fix is a **proposal pipeline, not a direct feed**: it
implements the ingestion half of the auto-refresh design in
`docs/admin/cloudflare-native-admin-spec.md` §6, writing into the
`change_proposals` table (`migrations/0001_init_admin_schema.sql`).

```
scripts/scrape-plentiful.py ─┐
scripts/fetch-osm-grocery.py ┤→ scripts/ingest-osm-grocery.py ─┐
                              │                                 ├→ scripts/refresh-ingest.ts
                        current D1 `venues` rows ───────────────┤   (scripts/refresh/diffEngine.ts,
                                                                 │    scripts/refresh/linkHealth.ts)
                                                                 ↓
                                                    D1 `change_proposals` rows
                                                    (status='pending')
```

Runs weekly in CI (`refresh-proposals.yml`, cron changed monthly→weekly in #543); run order and local use:
`scripts/README.md`; schedule, credentials and chunked-write gotchas:
AGENTS.md "Automated venue-refresh pipeline".

- **`fetch-osm-grocery.py`** is the only thing that talks to Overpass;
  `ingest-osm-grocery.py` only converts its download and is reused unmodified.
- **`diffEngine.ts`** is pure and unit-tested. It diffs each source's fresh
  records against D1's `draft`/`published` rows for that `source_type`,
  comparing only a **source-owned field allowlist**. OSM's `address`,
  `operator` and `hours_weekly` are excluded: they came from a one-off
  enrichment script (`scripts/scrub-osm-venues.ts`, deleted in #596; history
  in commit `c1e4536`/PR #102), so a plain re-run never reproduces them and
  diffing would propose wiping them. Found by running the pipeline end to
  end against local D1; the allowlist's own comment has the specifics.
  **Plentiful owns `hours_irregular` too, since #400** — the scraper emits
  "Once a month" + "4th Tuesday" as a structured `monthly_ordinal` entry (an
  unparseable non-weekly row becomes a prose `other` entry) instead of a
  sentence in `notes`. It's in `DESTRUCTIVE_CLEAR_GUARD` alongside
  `hours_weekly`/`phone` (a scrape that loses a schedule never proposes
  clearing it) and normalized for equality (sorted keys, slots and entries)
  so a re-scrape of an unchanged schedule proposes nothing.
- **Freshness:** a venue whose source-owned fields are unchanged still gets a
  `last_verified` refresh (unless already stamped today). That exact
  "date-only" shape **auto-applies** (Kyle, 2026-09-15): `proposalSql.ts`'s
  `buildProposalWriteStatements()` writes the `venues.last_verified` UPDATE,
  an `audit_log` row, and an already-`approved` proposal row. It uses the
  same `isDateOnlyUpdateProposal()` predicate as `/admin/flags`' bulk-approve
  (`src/lib/adminProposals.ts`), so the two can't disagree on what counts.
  Every other shape is only ever a pending proposal, with one opt-in
  exception — see "Jev triage + rename pairing" below.
- **Jev triage + rename pairing (#543)** — `scripts/refresh/triage.ts` +
  `renamePairs.ts`, run only after every guardrail above. Each non-date-only,
  non-`link_health` proposal gets one batched call to Jev (an LLM triage
  service), which stores a lane on the row (`triage_lane`, migration `0016`):
  updates classify as likely-noise vs. needs-a-human; removes always stay
  needs-a-human; adds get no call. Degrades to untriaged (never fails) on a
  missing key, a 5xx/timeout, or 3 failures in a row. A same-source
  remove+add pair within 100m or matching phone becomes one rename proposal
  instead of two (`buildRenameProposal`); approving it writes
  `venue_id_aliases` so the next run maps the old id forward and the pair
  never re-proposes. **The one exception to "every other shape is only ever
  a pending proposal" above:** `proposalSql.ts`'s
  `buildAiAutoApplyStatements`, gated by `REFRESH_AI_AUTO_APPLY` (off by
  default), writes a `venues` mutation directly from the ingestion job
  itself — actor `refresh-pipeline-ai`, full `audit_log` row — when a
  phone/url change is formatting-only once normalized AND Jev scores it
  "same value" > 0.9. This re-check is deterministic and independent of
  Jev's score, so a miscalibrated triage answer alone can't trigger a write.
  Operational detail (secrets, cost logging, the `0016` schemaReady probe):
  AGENTS.md "Automated venue-refresh pipeline".
- **`linkHealth.ts`** checks each stored `url` (HEAD, falling back to GET)
  and proposes clearing it only on 404/410 — never on 403 (often a bot-block
  of the checker), 429, 5xx or timeout, which are logged only.
- **Guardrails, all fail loud (non-zero exit):** per-source zero-record
  abort; per-source abnormal-drop abort (≥ max(5, 20%) of active rows
  missing); a 150-proposal cap that aborts the whole run. Stricter than §6,
  which writes flagged removal proposals instead — chosen because the job
  runs unattended, and writing nothing beats half-writing.
- **Review:** `/admin/flags` (`src/app/admin/flags/page.tsx`,
  `ProposalsReviewView.tsx`, `api/admin/proposals/[id]/{approve,reject}`,
  #390, plus bulk `approve-date-only`) is the only HUMAN-facing code path
  that turns a real-change proposal into a `venues` mutation — the
  ingestion job's own opt-in auto-apply lane (#543, above) is the one
  machine exception. How it handles the
  supersede race, stale applies and rejection memory: atlas-kb "PFM AGENTS
  History — Venue-Refresh Pipeline", "Change-proposal review queue (#390)".
  Auto-supersede (§6.10a) and rejection memory (§6.10b) stay the ingestion
  job's concern.
- **Hiding a known-dead link (#234):** while a `link_health` finding is still
  `pending`, Publish (`fetchPendingDeadLinks` + `stripDeadLinkUrls`,
  `publishVenues.ts`) drops that exact flagged `url` from the snapshot, which
  covers the card, `/venue/<id>` and JSON-LD with no client JS. It compares
  the venue's *current* `url` to the flagged one, so a hand-fixed URL
  republishes at once. Ceiling: a pending finding alone doesn't light the
  Publish bar (`summarizePublishChanges` counts only venue-row changes), so
  hiding waits for the next Publish for any reason.
- **Alerts (#238 pending-age, #234 per-source staleness)** —
  `src/lib/refreshAlerts.ts`, run daily from the scheduled jobs below:
  emails `issues@pueblofoodmap.com` when a proposal has been `pending` over
  14 days, or a source has written no proposal in 40 days. Every successful
  run writes at least one row per source, so `MAX(created_at)` stands in for
  "last completed run" with no extra table; the file header has that
  reasoning and its `ponytail:` ceiling.

---

## Scheduled jobs

`custom-worker.ts` wraps the OpenNext fetch handler and adds `scheduled()`,
driven by one prod-only 5-minute cron. All the branching lives in
`src/lib/scheduledTasks.ts`'s `runScheduledTasks` (testable, unlike
`custom-worker.ts`, which imports build output — see that file's header):

- **Heartbeat** — pings Healthchecks.io every tick (a dead-man's switch:
  Healthchecks.io alerts when the pings stop).
- **Email retention (#594, 09:00 UTC daily)** — `src/lib/emailRetention.ts`
  blanks the email on `public_submissions` rows and rejected `box_adopters`
  rows after 90 days (rows kept), and deletes `alert_subscriptions` rows
  unsubscribed over 90 days (deleted, not blanked — the file header explains
  the UNIQUE-constraint and resubscribe risks).
- **Refresh alerts (09:30 UTC daily)** — see above; a separate slot so the
  two daily jobs never collide.

Each daily job checks its own time gate on every tick and runs once a day,
so D1 isn't queried 288 times a day. Each job has its own `ctx.waitUntil`,
so a slow or failing job never delays the ping or the other job. Each daily job has a real-SQLite
`.sql.test.ts` as its pre-production proof, because staging has no cron.

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
| `selectedCategories` | `Set<VenueCategory> \| null` | Multi-select category filter (FilterPanel, #513); drives the category-autozoom effect |
| `filterOpenNow / filterSnap / filterWic` | `boolean` | FilterPanel's "Show only" switches (Saved in the bottom bar replaced the old favorites toggle, #513) |
| `filterPanelOpen` | `boolean` | Whether FilterPanel is open (#513) |
| `isDrifted` | `boolean` | User-location dot has left the viewport — shows "Re-center" |
| `isLocating` | `boolean` | Geo request in flight — spinner on BottomNav's "Near me" |
| `bannerVisible` | `boolean` | Location-denied banner after an active re-tap |
| `outsideCountyVisible` | `boolean` | Toast when the position is outside Pueblo County |
| `isPopoverOpen / activeIndex` | `boolean / number` | Typeahead popover ARIA state |
| `windowExpanded` | `boolean` | Desktop venue window expanded state |
| `mapboxMap` | `mapboxgl.Map \| null` | Map instance, from Map.tsx's `onMapReady` |
| `walkingRoute` / `walkingRouteInfo` | GeoJSON / info | Active walking route (Mapbox Directions API) and its distance/time pill |
| `walkingRouteSteps` | `WalkStep[] \| null` | Turn-by-turn steps (pre-localized via `language=`), threaded to the `WalkStepper` (#555) |
| `walkingRouteVenueId` | `string \| null` | Venue the route targets; the Map prop is render-gated on it matching `selectedVenueId` |
| `walkReqSeq` | `ref<number>` | Monotonic counter for in-flight walk fetches: bumped per request and per explicit clear; a result whose captured seq is stale is discarded (latest-*request*-wins, so a same-venue double tap with a moved `userLocation` is caught too). Not bumped on selection change — the render gate above covers that race |
| `walkAwaitingVenueIdRef` | `ref<string \| null>` | Venue whose Walk tap is waiting on a just-triggered location request (#207) |
| `walkLocationHintVenueId` | `string \| null` | Venue whose Walk tap hit a denied/unavailable location (#207) — shows the "share your location" hint |
| `activeStepIndex` | `number` | Turn the stepper shows — one source of truth for the phone RouteStrip, the full card and `DesktopVenueWindow`; reset on every new route, venue switch and clear |
| `focusPoint` / `focusRequestId` | `{lng, lat} \| null` / `number` | The stepper's camera target and its own "fire again" counter (#555) — separate from `recenterRequestId` so a step tap doesn't also re-fire the user-location flyTo |

**Walking directions.** `parseWalkSteps(route)` (exported, pure) turns the
Directions API legs into `WalkStep[]`, dropping any step with no instruction
or a malformed `maneuver.location` — the stepper flies the camera to that
coordinate, so a locationless step would crash it. `WalkStepper`
(`DirectionButtons.tsx`, #555) shows one turn at a time with Back/Next
(disabled at the ends, never hidden) and reuses `WalkStepsList` for its
"All turns" disclosure. `MapWrapper.handleStepChange` is the one place a step
change lands: it sets `activeStepIndex`, moves the camera via
`focusPoint`/`focusRequestId`, and calls `requestStepLocationRefresh`, which
re-reads the user's position without bumping `recenterRequestId` (that would
start a competing flyTo).

**Walk without a location (#207).** Walk never uses `PUEBLO_CENTER` as the
origin — a route from downtown would mislead (Bus/Drive deep links omit
`origin` and let Google use the device's location). When `userLocation` is
null:

```
Walk tapped, userLocation === null
  → handleWalkRoute stashes venue.id in walkAwaitingVenueIdRef
  → calls handleLocateRequest()   (same geo.request() flow "Near me" uses)
  → resume effect watches geo.state, applies decideWalkResume(awaitingVenueId, selectedVenueId, geo.state):
      granted + position     → fetchWalkingRoute(venue, position)   — draws the real route
      denied / unavailable   → setWalkLocationHintVenueId(venue.id) — "share your location" hint, no route
      stale (venue no longer selected) → noop, nothing drawn or shown
```

`decideWalkResume` is exported and pure. The effect also waits out the
transient `{granted, position:null}` state (the Permissions API can fire
before `getCurrentPosition` succeeds) so a real grant isn't read as a denial.
`fetchWalkingRoute` takes `origin` as a parameter so the effect can pass the
just-resolved position without waiting for a re-render.

**Filtering pipeline** (computed in `useMemo`, run on every state change):

1. `allVenues` (stable module-level array) → attach Haversine distances from
   `origin` (user position or Pueblo center).
2. Apply category, open-now, SNAP, WIC, favorites, walking-distance filters.
3. Sort nearest-first.
4. Apply text search (`searchVenues`).
5. Result: `filteredVenues` — the only venue list passed to `Map` and `ListView`.

**Geolocation flow:**

```
User taps "Near me" (BottomNav)
  → handleNearMe() switches to map view if in list view, then
  → handleLocateRequest()
    → stamps userRequestedAtRef
    → increments recenterRequestId  (Map.tsx flyTo fires even if position unchanged)
    → calls geo.request()
  → useEffect watches geo.state
    → clears isLocating when permission resolves
    → shows bannerVisible if permission === 'denied' AND a fresh request was pending
    → shows outsideCountyVisible if position is outside PUEBLO_COUNTY_BBOX
```

**Splash → auto-locate:** `SplashScreen` and `MapWrapper` run separate
`useGeolocation` instances. After "Find food near me", a `useEffect` on
`viewport === 'located'` runs `handleLocateRequest` once so the map centers
on the user without a second tap (#141; see `autoLocateDoneRef`).

**Drift detection:** `handleMoveEnd` checks whether the user-location dot is
inside the viewport shrunk by `DRIFT_PAD_DEG` (0.002°, ~220 m) on every
edge, so "Re-center" doesn't flicker when the dot sits on the edge.

---

## i18n model

EN and ES dictionaries live in `src/lib/i18n.ts` as plain `Record<string, string>`
objects. `t(key, locale, vars?)` looks up the ES dict first, falls back to EN
if a key is missing.

**Locale is client-side only.** `LocaleContext` (`src/lib/LocaleContext.tsx`)
holds the active locale in React state and writes it to the `pfm-locale`
cookie on change. No route reads that cookie on the server: `layout.tsx`
renders `<LocaleProvider>` with no `initialLocale`, so every page's first
render is English (the static public pages are prerendered that way), and
the provider switches to the saved
locale from `document.cookie` in an effect after hydration (#289). A Spanish
visitor therefore sees English briefly on a hard page load. The reason is
#287: a server-side `cookies()` read makes a route dynamic and loses the
static edge caching these pages depend on (see AGENTS.md "Discoverability /
SEO" for the outage that makes this constraint load-bearing).

**Known bilingual limitation — what is and isn't localized.** This is the
one place it's stated; code comments point here.

| Surface | Language |
|---|---|
| Visible page body (every public page, incl. /about and /privacy) | Visitor's locale, via `useLocale()` in each page's client "Content" component (#289) |
| `<title>` | Visitor's locale, corrected client-side after hydration (#589, #605, #610 — below); `/venue/[id]` deliberately keeps its English server title (#287) |
| `<meta>` description, OpenGraph/Twitter tags | English always (#287) |
| JSON-LD (venue schema, /about's FAQPage) | English always (#386) — built server-side with a hardcoded `"en"` |
| URLs | One URL per page for both locales; no `/es` tree or `hreflang` (deferred, #164) |

Crawlers therefore index English metadata. A separate `/es` route tree is the
only way to change that, and it's an SEO decision, not a content one — the
visible content is already bilingual.

**`<title>` (#589; client-side fix #605, self-heal #610):** Next.js Metadata
renders `<title>` once, server-side, always in English
(`buildPageMetadata`/`generateMetadata`, `src/lib/site.ts`). `useDocumentTitle`
(`src/lib/useDocumentTitle.ts`) corrects it for the current locale after
hydration and on a live EN↔ES toggle; every localized page's "Content"
component calls it with a `t()`-composed string. A plain
`document.title = ...` isn't enough on a hard load: Next's streaming-metadata
Suspense chunk can arrive after the hook's effect and overwrite `<title>`'s
DOM node directly (bypassing the setter) — a real timing race, not a fixed
order. So the hook self-heals with a `MutationObserver` on `document.head`,
disconnected on unmount so a page that stays English (`/venue/[id]`) is
never corrected by a stale observer. The hook's header has the full trace.

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
4. D1-backed rate limit (#587) — `src/lib/formRateLimit.ts`'s
   `checkFormRateLimit()`, a thin wrapper over the Blessing Boxes check-in
   path's shared D1 counter (`src/lib/checkinRateLimit.ts`): 5 req/IP/hour
   plus a site-wide 50/hour per form. D1, not an in-process `Map`, because
   Workers run many isolates with no shared memory; the file header has the
   cap reasoning.
5. Server-side field validation (mirrors client-side).
6. Email via Resend to the appropriate `@pueblofoodmap.com` address.

**`/suggest/submit` and `/report/submit` also queue (#258):** after step 5
they insert one pending `public_submissions` row
(`migrations/0002_public_submissions.sql`) before the email — the record an
admin reviews at `/admin/submissions`. The insert has its own try/catch: a D1
failure is logged (`db_write_failed`) and never blocks the email or changes
the response, so the email stays the authoritative success signal.
`/feedback/submit` never queues — general feedback has nothing for an admin
to act on (it does reach D1, for step 4 only).

**Why Turnstile over reCAPTCHA:** the app runs on Cloudflare Workers.
Turnstile is a first-party Cloudflare product with a simpler integration
model and no Google dependency — appropriate for a civic app serving
populations that may distrust Google tracking.

**PII policy:** IP addresses are used only for rate-limiting — never logged or
persisted. Contact emails go to Resend in the email body; the route handlers
do not log them.

---

## Map library — Mapbox GL JS via react-map-gl

The map renders via `mapbox-gl` v3 + `react-map-gl` v8 (import path
`react-map-gl/mapbox`), using the `streets-v12` Mapbox hosted basemap style.
It replaced react-leaflet in May 2026 (#44–#48); the issues and commits
record the swap, not the reason.

**Loading is deliberately staged,** because mapbox-gl dominated mobile
performance:

- **Client-only.** `mapbox-gl` needs `globalThis` and a WebGL canvas, so
  `MapWrapper.tsx` loads `Map.tsx` with `next/dynamic` + `ssr: false`. That
  must stay in a Client Component — `ssr: false` is silently ignored in
  Server Components.
- **Code-split (#202).** `HomePageClient.tsx` also dynamic-imports
  `MapWrapper` and `SplashScreen`, moving ~200KB of synchronous JS (vaul,
  Radix, geolocation hooks, venue data) out of the blocking parse window to
  cut TBT on throttled phones.
- **Deferred (#226).** `next/dynamic` fetches its chunk the moment the
  component first *renders*, so `useDeferredMapLoad`
  (`src/lib/useDeferredMapLoad.ts`) gates whether `<MapCanvas>` renders at
  all. Until then MapWrapper shows `ListView` in the same box (already
  interactive, no layout shift). The map loads on whichever comes first:
  idle time (`requestIdleCallback` with a timeout, or a `setTimeout`
  fallback for Safari) or the first pointerdown/touchstart/scroll/keydown/
  focusin — keyboard events included so assistive-tech users get the same
  early trigger.
- **Held behind the splash (#588).** While the first-visit splash covers the
  screen, the `hold` argument suppresses only the idle branch, so mapbox-gl's
  ~530ms parse doesn't run while nobody can see the map (and Lighthouse's
  never-interacting run stops paying for it). A tap on a splash CTA still
  starts the load at once, in parallel with the geolocation request;
  releasing `hold` is itself a trigger.
- **Deep links load eagerly.** `?venue=<id>` or `/#venue=<id>` passes
  `eager`, so the map loads on first render; the #132 deep-link effect then
  waits for `mapboxMap` before selecting the venue.

**Token scopes:** the public token (`pk.*`, `NEXT_PUBLIC_MAPBOX_TOKEN`) needs
only `styles:read`, `fonts:read`, `tilesets:read`. Narrowing the scope
reduces the blast radius if the token leaks via client bundle inspection.
See [AGENTS.md](AGENTS.md) for rotation procedure and URL restrictions.

---

## Hosting — Cloudflare Workers via OpenNext

The app is a Next.js App Router project compiled for Cloudflare Workers by
`@opennextjs/cloudflare` (`open-next.config.ts`). It moved off Vercel in May
2026 (#42/#53); the reason isn't recorded.

**Deploys run through GitHub Actions only.** Workers Builds is disconnected
(`deploy-prod.yml`'s header explains why the two must never run together).
Push to `main` → `deploy-prod.yml` deploys the top-level `wrangler.jsonc`
Worker (`pueblo-food-map`, pueblofoodmap.com); push to `dev` →
`deploy-dev.yml` deploys the staging Worker at dev.pueblofoodmap.com. Only
`deploy-prod.yml` has a `workflow_dispatch` recovery trigger.

**CI is the gate.** `ci.yml` runs `lint → design:lint → design:drift →
typecheck → test:ci → npm audit → build` on every PR into `main`/`dev` and
every push to `main`, and is a required check on both branches. The deploy
workflows re-run only lint, design:drift and typecheck, since nothing
reaches either branch without that check (changed 2026-09-23: the full
re-run cost ~3 min per deploy and let flaky tests block green changes).

**One scoped exception:** a `publish-bot` PR whose merge-base diff touches
*exactly* `src/data/published-venues.ts` skips lint, design:lint,
design:drift, the full test suite (replaced by a published-data/venue-shape
subset) and `npm audit`; typecheck and build always run. The diff check, not
the branch name, is the safety property — see `ci.yml`'s "Detect data-only
publish-bot PR" step comment.

**`GITHUB_TOKEN` pushes don't trigger workflows.** GitHub won't start a
workflow for a push made with `GITHUB_TOKEN`, so a workflow that merges into
`main` that way lands a commit that never deploys, with no red signal.
That's why Dependabot targets `dev` (#375) and its auto-merge uses a GitHub
App token (`RELEASE_PLEASE_APP_*` secrets, named for a retired workflow), and
why Publish uses the `GITHUB_PUBLISH_TOKEN` PAT. Auto-merge only waits for CI
because the `dev` ruleset requires the same checks as `main` (delete that
ruleset and auto-merge silently becomes merge-on-open). A consequence: a
dependency bump, security bumps included, waits on `dev` until the next
promotion. Any new workflow that pushes to `main` must avoid `GITHUB_TOKEN`. Incident history:
atlas-kb "PFM ARCHITECTURE History — 2026-09-24 Trim".

**Environment variables:** `NEXT_PUBLIC_*` vars are baked into the client
bundle at build time, so they are GitHub Actions repo secrets injected into
the `deploy-prod.yml`/`deploy-dev.yml` build (not Cloudflare dashboard build
variables — that was only true under Workers Builds). Runtime secrets
(`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, …) are `wrangler secret put` on
the Worker and read at request time. Full list: AGENTS.md "Promotion
checklist".

---

## Splash gate and first-visit flow

```
HomePageClient.tsx mounts
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

## Blessing Boxes

Full design: atlas-kb `projects/Pueblo Food Map/Blessing Boxes Build Plan.md`.

- **Boxes are live, not published.** A box is a `venues` row with
  `category: 'blessing_box'` plus a `blessing_boxes` row. The Publish
  snapshot excludes them; the public map reads them at request time from
  `GET /api/public/blessing-boxes` (`loadLiveBoxes()`,
  `src/lib/blessingBoxes.ts`, 60s edge cache), so an admin edit shows
  without a Publish.
- **Every interaction (check-in, photo, adopt) lives in the on-map venue
  card**, never a separate page — REVIEW.md's standing rules own that rule
  (the one exception, `/box/<id>/history`, is a read-only log).
- **Alerts** (`src/lib/boxAlerts.ts`, roles `host`/`adopter`/`giver` in one
  `alert_subscriptions` table): empty/problem → host + adopters; empty/low →
  givers; filled → everyone subscribed. 6h cooldown per subscription, except
  filled (good news skips it, capped at 1/subscription/hour instead).
  Dispatch runs in `ctx.waitUntil`, never blocking the check-in; a Resend
  outage degrades to a console warning.

Migrations, R2 buckets and dedicated secrets: AGENTS.md "Blessing Boxes".

---

## Admin panel

Design spec: `docs/admin/cloudflare-native-admin-spec.md`. Per-slice build
narratives (#253–#259, #390): atlas-kb "PFM AGENTS History — Admin Auth"
and "PFM ARCHITECTURE History — 2026-09-24 Trim".

### The shape every admin surface follows

- **Auth:** Better Auth is the sole gate (magic link + passkey, one-email
  allowlist). **`getAdminDb()` (`src/lib/adminDb.ts`) is the only way to
  reach the `ADMIN_DB` binding** and calls `requireAdminSession()` first, so
  no page or route — including a client-side navigation a layout guard would
  miss — reads admin data without a live session. Mutating `/api/admin/*`
  routes also call `requireAdminOrigin()` (CSRF, `src/lib/adminOrigin.ts`).
  Failures map to a login redirect / 401 (no session) or 403 via
  `src/lib/adminAuthErrors.ts`. Cookie, allowlist and rate-limit gotchas:
  AGENTS.md "Admin authentication".
- **Server Component page owns the gate and the reads; a Client Component
  owns the form; a route handler owns the authoritative write.** Client
  components (`AddVenueForm`, `ArchiveVenueButton`, `PublishPanel`) hold no
  auth.
- **Every mutation is one atomic `db.batch()`: the write plus its own
  `audit_log` row**, plus any dependent write (e.g. approving the
  submission that prompted it). They land together or not at all.
- **Nothing is deleted.** Archive sets `status='archived'`; the row and its
  audit history stay.
- **Destructive actions confirm with native `window.confirm()`** — no modal
  dependency exists or is needed.
- **Public (unauthenticated) routes that touch D1** — the suggest/report
  queue, `/api/public/**` box routes — read `getCloudflareContext().env.ADMIN_DB`
  directly, never `getAdminDb()`.
- Every page except `/admin/login` shares one header (`AdminNav`) with
  pending-count pills.

### Surfaces

- **`/admin` — Dashboard** (`src/app/admin/page.tsx`). A to-do landing page
  that `Promise.all`s several best-effort D1 reads: a `PublishPanel` (only
  when unpublished changes exist — the same component and action
  `/admin/places` uses), `NeedsDecisionPanel` (Suggestions / Data refresh /
  Blessing boxes — capped previews that link out to each full queue; any
  decision needing more than one click links out rather than growing an
  inline form), and two side panels: `BoxHealthList` ("Boxes that need
  help") and `StalePlacesList` ("Places due for a check" — published venues
  with `last_verified` over 12 months old, oldest first).
- **`/admin/places` — venue list** (`VenueListView`). All `venues` rows —
  draft, published, archived — filtered and searched entirely client-side
  (low hundreds of rows). A row is flagged "Unpublished changes"
  (`hasUnpublishedChanges()`, `src/lib/adminVenues.ts`) when it's a draft or
  was edited since its last publish (`updated_at > published_at`). Read-only
  itself; each row links to its edit page.
- **`/admin/venues/new` and `/admin/venues/[id]/edit`** — one form,
  `AddVenueForm`, in two modes (an optional `venueId` switches create →
  edit; same fields, validation and redirect). `POST /api/admin/venues`
  inserts a `status='draft'`, `source_type='manual'`,
  `id = manual-${crypto.randomUUID()}` row; `PATCH /api/admin/venues/[id]`
  updates it; `POST /api/admin/venues/[id]/archive` ("Remove from map",
  `ArchiveVenueButton`, the one `--color-danger` action) archives it.
  - **The server re-validates every field** (`adminVenueValidation.ts`, the
    same validator for create and edit) because SQLite CHECK constraints
    cover only the enums — not lat/lng bounds, the `last_verified` date or
    the `hours_weekly` JSON shape.
  - **Edit can never change `status`** (or `source_type`, `created_*`,
    `published_*`): those columns are absent from the UPDATE — a structural
    guarantee, not a runtime check. `updated_at` is computed once in JS and
    reused for the UPDATE, the audit row and `after_json`, so all three
    agree.
  - **Optimistic concurrency (#265).** PATCH and archive bind the row's
    last-known `updated_at` into `WHERE id = ? AND updated_at = ?` (from the
    form for PATCH, read fresh in-route for archive). A second admin's
    concurrent save gets a 409 instead of a silent overwrite, and every
    dependent write in the batch is `WHERE EXISTS`-gated on that same
    precondition.
  - Archive is idempotent — archiving an archived row still succeeds and
    still writes an audit row. An archived row drops out of the next
    Publish snapshot.
  - `mapVenueRowToFormValues()` (`src/lib/adminVenueForm.ts`) turns a stored
    row into form values; it's outside the `"use client"` form file so the
    Server Component page can call it.
  - **Address → coordinates:** `GET /api/admin/geocode` calls the free US
    Census geocoder server-side (never Mapbox — no key to provision or
    leak). It only fills lat/lng in the form; the create route is unchanged.
  - `AdminVenueRow` and `publishVenues.ts`'s `VenueRow` are deliberately
    separate types (circular-import risk — see `src/types/venue.ts`).
- **Publish** (`PublishPanel` → `POST /api/admin/publish`,
  `src/lib/publishVenues.ts`). The panel shows
  `summarizePublishChanges()`'s three buckets (`newDrafts`,
  `editedSincePublish`, `archived` — `archived` counts only rows that were
  published, since archiving a never-live draft changes nothing public),
  confirms, then maps the response to one of five messages or a generic
  retry. The route snapshots `draft`+`published` rows, validates, commits
  `published-venues.ts` to the `publish-bot` branch, opens/reuses its
  auto-merging PR, and **only then** promotes drafts in D1 — the reverse
  order could mark rows published when the file never shipped. It refuses
  on staging (`isProductionWorker()`, #591) and returns
  `503 publish_not_configured` when `GITHUB_PUBLISH_TOKEN` is unset. The
  button is sage, not brand orange: DESIGN.md reserves orange for the public
  map.
  - **"Published" means "PR open and armed," not "merged" (#598).** If that
    PR's CI then fails, D1 says published while the live site serves the old
    file until the next Publish repairs it. Waiting for the real merge was
    rejected (it would hold a request open across a multi-minute CI run for
    a rare, self-healing case). Instead the Dashboard reads the open
    `publish-bot` PR (`fetchPublishBotPrStatus`, `publishVenues.ts`) and
    shows `PublishBotStatusBanner` (in progress / stuck on a merge conflict /
    stuck on checks after 20 minutes). It reads `mergeable_state` from the
    Pulls API, not the Checks API, because a fine-grained PAT can't read
    check runs at all. It fails soft: skipped with no token (staging), and
    any GitHub error reads as "in progress".
- **`/admin/submissions` — public submissions queue (#259).** Reads every
  pending `public_submissions` row, newest first, as cards
  (`SubmissionsReviewView`). Approving reuses the venue routes rather than a
  parallel pipeline: a `new_venue` card links to
  `/admin/venues/new?submission=<id>` (prefilled by
  `mapSubmissionPayloadToFormValues()`), and a `closure` card links to
  `/admin/venues/<target_venue_id>/edit?submission=<id>` (#270 — a closure
  report can mean "hours changed," not only "gone"). The edit page
  cross-checks the submission's `target_venue_id` before accepting it. The
  optional `submissionId` then rides the create or archive route's own
  `db.batch()`, so the venue change and the approval land together.
  Reject is its own route with no `audit_log` row (it changes no venue).
  Each row's JSON `payload` is parsed on its own (`parseSubmissionRow`), so
  one bad row degrades to a still-rejectable "couldn't read details" card.
  The payload mapper's category fallback and notes folding are explained in
  `src/lib/adminVenueForm.ts`.
- **`/admin/flags` — refresh proposals (#390).** See "Automated
  venue-refresh pipeline" above.
- **`/admin/boxes` — Blessing Boxes tab.** `AdminBoxesMap` (a small
  dedicated `react-map-gl` component, not the public `Map.tsx`) with pins
  colored by status, "Needs help now" / "Gone quiet" lists, an 8-week
  `BoxReportsChart` (plain divs, no chart library;
  `bucketCheckinsByWeek()`), and `AllBoxesTable` (including removed boxes —
  `removed_on` is a display flag, never a query filter). It and the
  Dashboard's side panel share `loadBoxHealthEntries()`
  (`src/lib/adminBoxes.ts`) and one status function (`computeBoxHealth`,
  `src/lib/boxHealth.ts`), so they can't disagree about a box. "Places due
  for a check" is Dashboard-only.
- **`/admin/box-photos`, `/admin/box-adopters`** — the photo and
  adoption-request queues the Dashboard's Blessing boxes group links to.
