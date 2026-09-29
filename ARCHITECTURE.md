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
        ├── DesktopSidePanel.tsx  (desktop: fixed right-hand panel shell —
        │     inset/size/chrome, Escape, focus-to-heading + focus-return,
        │     #682. Content is ONE of: DesktopVenueWindow (venue/box card —
        │     no longer marker-anchored; the map pans the pin clear of the
        │     panel instead, #682 8a) or HamburgerMenuContent (Saved list /
        │     Menu, #682 8b) — MapWrapper's `sidePanelView` union picks which,
        │     mutually exclusive on desktop only)
        ├── DirectionButtons.tsx  (Walk: in-app route + WalkStepper, #555;
        │     Bus/Drive: Google Maps deep links)
        ├── SearchBar / ViewSuggestion / SearchResultsPopover / FilterPanel
        │     (Filters button opens FilterPanel — categories + Open now/SNAP/
        │     WIC, #513. No standing Map/List control, #514: an empty focused
        │     bar offers the other view, a typed one adds "See all N matches
        │     as a list", and the Menu has a List/Map line)
        ├── HamburgerMenu    (shell: mobile full-height sheet, or desktop
        │     dropdown on non-map pages via PageNav — position, backdrop,
        │     focus trap/return, Escape, scroll lock. Renders
        │     HamburgerMenuContent — List/Map line, saved places, links,
        │     language — split out by #682 8b so the SAME content also
        │     renders inside DesktopSidePanel on the map page's desktop
        │     layout, above. Opened by BottomNav at a section)
        ├── ListView         (full-screen nearest-first list, map mode off)
        └── BottomNav        (Near me · Saved · Boxes · Help · Menu — bar below
              2xl (1536px), floating pill at 2xl+; Boxes toggles the
              blessing_box filter, #516; docs/bottom-nav-spec.md)

Next.js App Router (Cloudflare Worker)
  └── src/app/(site)/  — a route group (URL-invisible, #689 PR 1), holding every
        public and admin route below. Its OWN root layout, alongside the SECOND
        one at src/app/es/ (#689 PR 2) — Next.js requires multiple root layouts
        to give an /es page a server-rendered `<html lang="es">`.
    └── layout.tsx      (metadata/viewport from src/lib/site.ts's ROOT_METADATA/
          ROOT_VIEWPORT; renders <RootShell lang="en"> — font preload, WebSite
          JSON-LD, LocaleProvider — reads no cookie, ServiceWorkerRegister →
          public/sw.js, see "Offline / installable app", #130 — and Analytics)
    └── not-found.tsx   (branded 404 for an explicit notFound() call inside this
          route tree — venue/[id], box/[id], report/[venueId])
    └── forbidden.tsx   (branded 403 for next/navigation's forbidden(), admin/page.tsx)
    └── page.tsx        (Server Component: venue-index JSON-LD, metadata;
          mounts HomePageClient.tsx — splash gate + MapWrapper)
    └── about, privacy, resources, venues, venue/[id], box/[id] …
          (public pages; each localized body is a client "Content" component)
    └── report/[venueId], suggest, feedback  (+ submit/route.ts each)
    └── admin/**  (admin panel — see "Admin panel")
  └── src/app/es/  — the /es tree's own root layout (#689 PR 2). Thin wrapper
        pages for the five mirrored routes (page.tsx, about/, resources/,
        venues/, venue/[id]/) each pass locale: "es" to buildPageMetadata and
        the venueSchema.ts builders, and render the SAME client "Content"
        components as their (site)/ counterparts — no page logic duplicated.
        No es/not-found.tsx: dynamicParams=false on es/venue/[id] means an
        unknown id 404s at Next's ROUTING level, before that page's own
        notFound() call ever runs — there is no in-tree notFound() call
        anywhere under /es to catch. Unmatched /es/* URLs (including an
        unknown venue id) fall through to the EN app/global-not-found.tsx —
        an accepted tradeoff; see "i18n model" below for why a catch-all
        route meant to fix that measured worse, not better.
  └── src/components/RootShell.tsx — the shared <html>/<body> shell (font
        preload, WebSite JSON-LD, LocaleProvider, Analytics, SW register)
        (site)/layout.tsx, es/layout.tsx and global-not-found.tsx (below) all
        render, parameterized by `lang` (#689 PR 1; PR 2's es/layout.tsx
        reuses it with lang="es", which also locks LocaleProvider to Spanish)
  └── src/app/global-not-found.tsx — 404 for a URL that matches no route at
        all (required once (site)/ became a route group with no top-level
        app/layout.tsx to compose a 404 from; `experimental.globalNotFound` in
        next.config.ts). Reuses RootShell + ROOT_METADATA/ROOT_VIEWPORT since
        it has no parent layout to inherit them from.
  └── src/app/manifest.ts, robots.ts, sitemap.ts, favicon.ico, apple-icon.png,
        globals.css — stay at the src/app/ root, outside (site)/: special
        metadata files and globals.css need no layout, and global-not-found.tsx
        needs the same globals.css import.
  └── src/app/api/**   (route handlers — no layout, so route groups don't
        apply; api/public/** is unauthenticated box reads and writes,
        api/admin/** backs the admin panel)
  └── SiteFooter.tsx (slim nav footer on every public page but the map — the crawl path to /venues)

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
  └── src/lib/adminOwner.ts, authEvents.ts, activityLog.ts  (owner-only Activity log, #679)
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
  same `isDateOnlyUpdateProposal()` predicate as the Places tab's
  `ToReviewSummaryBox`'s bulk-approve (`src/lib/adminProposals.ts` — #674
  folded the standalone `/admin/flags` queue that used to own this button
  into Places), so the two can't disagree on what counts.
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
- **Review:** the Places tab (`src/app/(site)/admin/places/page.tsx`,
  `VenueListView.tsx`'s "To review" column, `ProposalCard.tsx`,
  `api/admin/proposals/[id]/{approve,reject}`, #390, plus bulk
  `approve-date-only`) — originally a standalone `/admin/flags` queue
  (`ProposalsReviewView.tsx`), folded into Places by #674, which now
  redirects there — is the only HUMAN-facing code path that turns a
  real-change proposal into a `venues` mutation — the ingestion job's own
  opt-in auto-apply lane (#543, above) is the one machine exception. How it
  handles the
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

**Locale (the switchable client toggle) vs. tree (the route you're served
from) are two different things** — #689 PR 2 made this split explicit.
`LocaleContext` (`src/lib/LocaleContext.tsx`) holds the active `locale` in
React state and writes it to the `pfm-locale` cookie on change; it also
exposes a separate `tree` field, fixed for the provider's lifetime at
whichever root layout served the page. On the EN tree (`src/app/(site)/`,
no `initialLocale` passed to `LocaleProvider`), the provider still starts at
`"en"` and switches to the saved cookie's locale in an effect after
hydration (#289) — a Spanish visitor sees English briefly on a hard page
load there, for the same reason as before (#287: a server-side `cookies()`
read would make the route dynamic and lose the static edge caching these
pages depend on — see AGENTS.md "Discoverability / SEO" for the outage that
makes this constraint load-bearing). `localizedHref`
(`src/lib/localizedHref.ts`) always keys off `tree`, never `locale` — an EN
page whose locale cookie says "es" still links within the EN tree, so a
visitor never half-migrates.

**Two route trees, not one — what's mirrored and what isn't.** This is the
one place it's stated; code comments point here.

The five in-scope routes (`/`, `/venues`, `/venue/[id]`, `/resources`,
`/about`) are **mirrored**: each has a full `/es` twin with its own root
layout (`src/app/es/layout.tsx`, `lang="es"`, `LocaleProvider
initialLocale="es"` — which also LOCKS the tree, so a stale `pfm-locale=en`
cookie can never flip an `/es` page back to English post-hydration).

| Surface, on a MIRRORED page | Language |
|---|---|
| `<html lang>` | Server-rendered, matches the tree — `"en"` or `"es"` (#689 PR 2; two root layouts, `RootShell` shared) |
| Visible page body | Matches the tree — the SAME client "Content" component (`useLocale()`, #289) renders under whichever provider is active |
| `<title>`, `<meta>` description, OpenGraph/Twitter | Server-rendered, matches the tree (`buildPageMetadata`'s `locale`/`mirrored` options, `src/lib/site.ts`); `hreflang` alternates (`en`/`es`/`x-default` → EN) point at the counterpart URL |
| JSON-LD (venue schema, WebSite, `/about`'s FAQPage) | Matches the tree — every builder in `src/lib/venueSchema.ts` takes an optional `locale` (defaults `"en"`), sets `inLanguage` and `/es` URLs. Supersedes the old #386 "always English" rule |
| URLs | English slugs under `/es` (`/es/venues`, `/es/venue/<id>`) — not translated |

Non-mirrored pages (`/suggest`, `/feedback`, `/privacy`, `/report/*`,
`/box/*`, `/boxes/activity`, `/alerts/*`, `/admin/*`, `/api/*` — #689 "Out"
scope) keep the PRE-#689 behavior exactly: single URL, English-only
`<title>`/metadata/JSON-LD, visible body follows the client-side locale
toggle only, `<title>` corrected client-side after hydration (#589, #605,
#610 — below). `/venue/[id]` and `/es/venue/[id]` both deliberately keep
their SSR `<title>` as the venue's proper name — nothing to translate
(#287's original reasoning still applies there, just per-tree now).

**Unmatched /es/* URLs render the ENGLISH 404, not a Spanish one** — an
accepted tradeoff (#689 PR 2 follow-up, round 2). There is no `es/not-found.tsx`
and no `es/[...rest]` catch-all: an es/venue/[id] id outside
`generateStaticParams` 404s at Next's ROUTING level (dynamicParams=false),
before that page's own `notFound()` call ever runs, so no in-tree
`notFound()` exists anywhere under `/es` to catch — both files were tried
and removed. The catch-all's own 404 response measured WORSE on low-end
phones than the prerendered `app/global-not-found.tsx` it replaced:
`notFound()` thrown from a genuinely dynamic, per-request route ships
Next's own blank `__next_error__` shell (no CSS, no-store, fetched fresh
every time), not the instant, cacheable, fully-branded English fallback.
Every unmatched `/es/*` URL — a bad venue id or a wholly made-up path —
now falls through to that same English `global-not-found.tsx`, same as
any unmatched EN-tree URL.

**`<title>` on a NON-mirrored page (#589; client-side fix #605, self-heal
#610):** Next.js Metadata renders `<title>` once, server-side, always in
English (`buildPageMetadata`/`generateMetadata`, `src/lib/site.ts`).
`useDocumentTitle` (`src/lib/useDocumentTitle.ts`) corrects it for the
current locale after hydration and on a live EN↔ES toggle; every localized
page's "Content" component calls it with a `t()`-composed string. A plain
`document.title = ...` isn't enough on a hard load: Next's streaming-metadata
Suspense chunk can arrive after the hook's effect and overwrite `<title>`'s
DOM node directly (bypassing the setter) — a real timing race, not a fixed
order. So the hook self-heals with a `MutationObserver` on `document.head`,
disconnected on unmount so a page that stays English (`/venue/[id]`) is
never corrected by a stale observer. The hook's header has the full trace.
**On a mirrored page** the server `<title>` is already correct for its tree
(English on `(site)/`, Spanish on `es/`), so `useDocumentTitle` is called
with `skip: tree === "es"` (#689 PR 2) — a true no-op there, not a
harmless-but-wasted re-write of the same string.

**Translation notes:**
- Mexican / Latin American Spanish throughout (not Castilian).
- US government program names (SNAP, WIC) are not translated.
- Keys marked `[CHECK]` in the ES dictionary need review by a native
  Mexican-Spanish speaker for regional naturalness.

---

## Crawlability and indexing

The SEO/AEO plan (`docs/seo-aeo-plan.md`, Phase 0) is the source for this section.
The rules it sets:

- **Every venue page must be reachable through server-rendered links**, not only
  through the sitemap. `/` has a visually hidden `<nav>` (skip-link style) that
  links to `/venues`, `/resources`, `/about` and the three hub pages below
  (the `/es` page has a Spanish twin). `SiteFooter` links to `/venues`,
  `/resources` and the three hubs on every other public page, including
  `/venue/<id>`. `/venues` links to every venue and to the three hubs. The map's own links only exist after JS runs.
- **`/venue/<id>`** has a visible breadcrumb (Map › All places › name) plus a
  matching `BreadcrumbList` JSON-LD (`buildVenueBreadcrumbJsonLd`). The page's
  ODbL credit comes from `SiteFooter`.
- **The sitemap is build-time data only**: the static routes plus the published
  venues. `src/__tests__/seo.test.ts` fails if a static sitemap URL has no
  `page.tsx`. That's how the old `/boxes` entry 404'd unnoticed. Blessing
  Boxes aren't in it: `/box/<id>` is a `noindex` redirect shell into the map
  card. Boxes come back through the planned read-only `/blessing-boxes` list
  (REVIEW.md). Every mirrored route's entry carries `alternates.languages`
  pointing at its `/es` (or EN) counterpart, and the counterpart itself is a
  SEPARATE full entry — not just a cross-reference (#689 PR 2, `src/app/sitemap.ts`).
- **Only `pueblofoodmap.com` is indexable.** `custom-worker.ts` adds
  `X-Robots-Tag: noindex, nofollow` to every response on any other host
  (dev., *.workers.dev), via `src/lib/indexingHost.ts`. This is deliberately a
  header, not a robots.txt `Disallow`: a crawler must be able to fetch a page
  to see its noindex and drop it. `deploy-prod.yml`'s smoke test fails if the
  canonical host ever sends the header, or if workers.dev stops sending it.

- **`/llms.txt`** is a hand-written static file, `public/llms.txt` (llmstxt.org
  format). Cloudflare Workers Static Assets serves it before the Worker runs
  (`text/plain; charset=utf-8`, no route or middleware involved, same as
  `sw.js`), and `deploy-prod.yml` smoke-tests it. It carries no counts, so it
  can't go stale; update it by hand when a public page is added or renamed.
- **AI crawler policy** lives in `src/app/robots.ts` (WHY in its header):
  answer/search bots are allowed, training-only crawlers are blocked.

### Answer-first venue pages (SEO/AEO plan Phase 2, `src/lib/venueSummary.ts`)

`buildVenueSummary(venue, locale, options?)` assembles a venue's answer-first
paragraph — what it is (with "free" wording only for `FREE_CATEGORIES`), its
hours in words, SNAP/WIC only when confirmed `true`, and "Last verified" —
from verified `Venue` fields only, entirely at build time (no `new Date()`,
no client-only `Intl`). It's called from **both** sides of the render: the
server (`buildVenueJsonLd`'s `description`, `venuePageMetadataFields`'s meta
description) and the client (`VenueContent`'s on-page paragraph, at the
page's own current `locale`) — the same function, so the three can never
drift apart. `{ includeAddress: false }` drops the street address from the
sentence (VenueContent passes this — the address is already shown in the
header just above); the default (`true`, used by meta/JSON-LD) keeps it.

- **City parsing** (`parseVenueCityCore`/`parseVenueCity`): pulls the city
  out of a free-text address for the page `<title>`
  (`"{Name} – {category} in {City}, CO"`, ladder-shortened to fit ≤ 70
  rendered chars, never truncating the name) and the no-address sentence.
  The core returns `string | null`; `buildVenueJsonLd`'s `addressLocality`
  uses the core directly and OMITS the field on `null` rather than emit
  fallback prose ("Pueblo County") as a structured-data city name.
- **Postal code** (`extractPostalCode`, venueSchema.ts): takes the LAST
  5-digit group in the address, not the first — a leading 5-digit house
  number (e.g. "37137 US 50 Bus...") would otherwise win over the real zip.
- **OSM placeholder guard** (`PLACEHOLDER_ADDRESS`): a venue whose
  `address` is literally "Address not in OpenStreetMap" (an OSM import gap)
  never shows that string in the summary, `<meta description>`, or JSON-LD
  `streetAddress` — same guard BottomSheet.tsx/DesktopVenueWindow.tsx's map
  cards already apply (their own fallback is raw lat/lng; a sentence falls
  back to the parsed city instead).
- **`sameAs`** is emitted only when a venue's `url` is unique among
  published venues (`URL_COUNTS`, computed once at module load) — 10
  gardens/edible landscapes share one Pueblo Food Project program-page URL,
  which is not any single venue's own identity.
- **Nearby** (`nearbyVenues`): the 3–5 nearest same-category published
  venues by haversine distance (`src/lib/distance.ts`), computed in the
  server `venue/[id]/page.tsx` (both EN and ES) and passed to `VenueContent`
  as a prop — adds no client JS.

---

### Hub pages (SEO/AEO plan Phase 3, #709)

`/food-pantries`, `/snap-wic-stores` and `/community-gardens`, each with an `/es`
twin (`localizedHref`'s `MIRRORED_STATIC` lists them). They are the pages meant to
rank for the queries people type ("food pantry Pueblo", "SNAP stores Pueblo").
`/blessing-boxes` (PR B, below) is the fourth, and the one dynamic exception.

- **Server components with a `locale` prop**, not the `/venues` client-component
  pattern: `src/components/HubPages.tsx` exports `FoodPantriesHub`,
  `SnapWicHub` and `CommunityGardensHub`. The six `page.tsx` files are thin
  wrappers (`buildPageMetadata` with `mirrored: true` on BOTH trees, then the hub
  with a fixed locale), so the routes stay static and add no client JS beyond
  the existing `PageNav`/`SiteFooter` chrome.
- **List logic is pure** (`src/lib/hubPages.ts`): pantries sorted by name; SNAP/WIC
  places by strict `=== true` with counts computed from the filtered list;
  gardens then edible landscapes; `allFree()` gates "free" wording on
  `FREE_CATEGORIES`; `hubAddress()` hides the OSM placeholder; `hubHours()` is
  `buildHoursSentence` (venueSummary.ts). A place with no hours says
  "Hours not listed. Check before you go." — never invented hours.
- **JSON-LD** is the house builders fed the exact rendered list:
  `buildVenueListJsonLd` (ItemList) on every hub, and `FaqSection` builds the
  FAQPage from the same items array it renders, so the schema text can't drift
  from the visible text. `/resources` gets the same `FaqSection` through
  `ResourcesFaq`, passed to the client `ResourcesContent` as its `faq` prop. The
  official source URLs and fetch dates for those answers are in the header of
  `src/components/ResourcesFaq.tsx`.
- **Sitemap and smoke test:** each hub has EN + ES entries with alternates;
  `deploy-prod.yml` checks all eight (incl. `/blessing-boxes`) for 200 and the `/es` ones for `<html lang="es">`.
- **`/blessing-boxes` (+ `/es`) is the dynamic one.** Boxes live only in D1, and
  admin edits must show immediately, so both page files set
  `export const dynamic = "force-dynamic"` (route-segment config; it affects only
  those two routes — the build's route table shows them as ƒ and nothing else
  changed). `src/lib/blessingBoxesHubData.ts` reads D1 through `getCloudflareContext().env.ADMIN_DB` +
  `loadLiveBoxesForHub` (the boxes query + visible check-ins for `status`; same
  SQL and mapper as `loadLiveBoxes`, minus its photo/adopter/needs reads; never
  `getAdminDb`, never host contact), wrapped in React `cache()` so
  `generateMetadata` and the page share one load per request. On a
  D1 error it returns `degraded: true`: the page shows an honest message with a
  map link (never "0 boxes"), no JSON-LD, and the metadata adds
  `robots: { index: false, follow: true }`. Each box links to the map card at
  `/?venue=<id>` (`/es?venue=<id>`). Read-only per REVIEW.md: no check-in,
  photo, adopt or alert controls. No page caching (OpenNext's incremental cache
  can't revalidate); the cost is 2 D1 reads (~30 box rows, then their check-ins) per page
  view, and the upgrade path is an edge-cached read like `src/lib/edgeCache.ts`.

## Form-route triad

Three user-submission flows share the same structure:

```
/report/[venueId]/page.tsx   → ReportForm   → POST /report/submit
/suggest/page.tsx            → SuggestForm  → POST /suggest/submit
/feedback/page.tsx           → FeedbackForm → POST /feedback/submit
```

Each route handler (`src/app/(site)/*/submit/route.ts`) runs the same pipeline:

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
admin reviews on the Places tab (#675 folded the standalone
`/admin/submissions` queue in; see "Admin panel" below). The insert has its own try/catch: a D1
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

## Offline / installable app (#130)

The map can be installed to a phone's home screen and keeps working with no
connection — minus the map itself (Mapbox tiles are out of scope).

**Pieces.**
- `src/app/manifest.ts` → `/manifest.webmanifest` (name, `short_name` "Food
  Map", `start_url` `/`, standalone, bone-50 colours tied to `ROOT_VIEWPORT`'s
  (`src/lib/site.ts`) `themeColor` by `manifest.test.ts`). Icons in
  `public/icons/` plus `src/app/apple-icon.png` are PNGs drawn from the OG
  image's pin mark.
- `public/sw.js` — hand-written service worker, no Workbox. Served as a plain
  static file (never bundled); `public/_headers` sends `Cache-Control:
  no-cache` so each deploy's copy reaches visitors.
- `src/components/ServiceWorkerRegister.tsx` (mounted in `layout.tsx`) —
  registers `/sw.js` in production builds only, after `load` and then browser
  idle, so it never competes with first paint. In dev it unregisters any
  worker left over from a local `next start`.
- Offline notice — `useMapUI`'s map-unavailable fallback (#165) now carries a
  reason. WebGL missing → "Map unavailable" (unchanged). WebGL fine but
  `navigator.onLine` false at mount → list view with "Map needs a connection.
  The list still works." Checked once on mount only: going offline mid-session
  leaves a working map alone, and coming back online needs a reload.

**What's cached** (one cache, `pfm-<CACHE_VERSION>`):

| Request | Strategy |
|---|---|
| `/`, `/venues`, `/resources` — navigations only | Network-first; the cached copy is served only when the network fails. Keyed by path, so `/?venue=x` shares `/`'s entry. |
| `/_next/static/*`, `/fonts/*`, `/icons/*`, `/manifest.webmanifest` | Stale-while-revalidate. The hashed `/_next/static` files are `immutable` in the HTTP cache, so the revalidate step is normally served from disk rather than the network. |
| Any other same-origin page navigation (e.g. `/about`, `/venue/<id>`) | Network-only — never cached itself. On a network failure it falls back to the precached `/` shell rather than the browser's own offline error page (below), never to the requested page's real content. |
| `/api/*`, `/admin*`, `/alerts*` (subscription token in `?t=`), `/box/*` (live D1), anything cross-origin (Mapbox, analytics, Turnstile), any non-GET | Never touched, never falls back — straight to the network. |

**Same-session offline navigation (#130 follow-up).** A `next/link` tap (BottomNav's "Help", the Menu drawer's links) is a client-side transition, not a page load: Next fetches an RSC payload first, which the router itself falls back to a real browser navigation for when that fetch fails (its own console warning: "Failed to fetch RSC payload ... Falling back to browser navigation"). That fallback navigation used to have nowhere to land when the target page was never visited/cached offline (e.g. tapping "About" for the first time with no connection) — the browser showed its native offline error page instead of the app. Fixed by giving every other same-origin navigation a shell-fallback (table above): the visitor lands on the cached `/` map shell — a working app, not a dead end — rather than the target page's real content, since that was never fetched. `src/__tests__/serviceWorkerShellFallback.test.ts` covers the new classification and fallback function.

**Install-time precache.** On a first visit every request happens before the
worker controls the page, so none of it passes through the worker. `install`
therefore fetches the three shell pages itself and caches every
`/_next/static` and `/fonts` URL their HTML references. The venue dataset is
compiled into those pages and bundles (`src/data/published-venues.ts`), so
the list and the in-map venue card work offline. Live blessing-box status
(`/api/public/blessing-boxes`) does not — `useBoxVenues` already treats a
failed fetch as "no boxes". `/venue/<id>` detail pages and other routes are
not cached.

**Bust the cache:** bump `CACHE_VERSION` in `public/sw.js`. The new worker
installs on visitors' next page load, takes over immediately (`skipWaiting` +
`clients.claim`), and deletes every older `pfm-*` cache on activate. Ordinary
deploys don't need a bump for correctness: shell pages are network-first,
and new hashed assets are new URLs. Storage is another matter. A previous
deploy's `/_next/static` entries are never evicted until the version bumps,
so the cache grows by roughly one shell's worth of chunks per deploy a
visitor sees. ponytail: bump `CACHE_VERSION` every few releases. The upgrade
path is pruning `/_next/static` entries that the freshly fetched shell HTML
no longer references.

**Disable it:** set `KILL_SWITCH = true` in `public/sw.js` and deploy. On
visitors' next page load the replacement worker deletes every `pfm-*` cache,
answers no requests, and unregisters itself. Removing
`<ServiceWorkerRegister />` alone is NOT enough — a worker that is already
installed keeps running until something replaces it. To clear one browser
by hand: DevTools → Application → Service workers → Unregister, then Storage
→ Clear site data.

**Verified** with Playwright Chromium against `npm run build && npm run
start`: the manifest is valid (no installability errors), the worker is
registered and controls the page, and after one online visit an offline
reload of `/` shows the list with the offline notice and no page errors.
The venue card opens, and `/venues` and `/resources` load offline.

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
  (the read-only exceptions are the `/box/<id>/history` log and the
  planned `/blessing-boxes` list).
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

- **Auth:** Better Auth is the sole gate (a 6-digit email code typed on the
  sign-in page, #684, + passkey; one-email allowlist). **`getAdminDb()` (`src/lib/adminDb.ts`) is the only way to
  reach the `ADMIN_DB` binding** and calls `requireAdminSession()` first, so
  no page or route — including a client-side navigation a layout guard would
  miss — reads admin data without a live session. Mutating `/api/admin/*`
  routes also call `requireAdminOrigin()` (CSRF, `src/lib/adminOrigin.ts`).
  Failures map to a login redirect / 401 (no session) or 403 via
  `src/lib/adminAuthErrors.ts` (for admin *pages* the status is 200, see
  "Admin page speed" below). Cookie, allowlist and rate-limit gotchas:
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
  pending-count pills. Its **Activity** item is rendered only for the owner
  (`identity.isOwner`, see `/admin/activity` below).
- **Admin page speed.** Every admin page is a dynamic server render: one
  session read (`getAdminDb()`), then its D1 reads. Each D1 call is a round
  trip to the WNAM primary, so a page's reads run in one `Promise.all`, never
  one `await` after another (the venue edit page's only real dependencies are
  the venue row and the suggestion lookup). The Dashboard's Cloudflare and
  PostHog calls start in that same `Promise.all`. `admin/loading.tsx` shows the
  header (`AdminNavSkeleton`) plus "Loading…" during client navigation (it also wraps `/admin/login`).
  Because that shell streams before the page's session check, a first
  full-page request to a guarded admin URL answers 200 (noindex) and redirects
  or renders forbidden/not-found on the client instead of a 307/403/404 (this
  includes an unknown venue id on the edit page). It carries no admin data.

### Surfaces

- **`/admin/activity` — Activity log, owner only** (#679). Every admin
  sign-in, failed attempt and action, newest first, grouped by day, then by
  sign-in. `getAdminDb()` sets `identity.isOwner` from the `ADMIN_OWNER_EMAIL`
  var (`src/lib/adminOwner.ts`, fails toward Kyle); anyone else gets a 404
  before anything is read. Two sources (`src/lib/activityLog.ts`):
  `auth_events` (migration `0017`) — written by Better Auth hooks in
  `src/lib/authEvents.ts` (`session.create.after` for sign-ins; a plugin's
  path hooks for sign-out, a sign-in code requested for a non-allowlisted
  email, a wrong/expired/used-up code, a failed passkey, passkey added/removed;
  never blocks a sign-in, never stores a token) — and `audit_log`, whose
  `session_id` ties each action to its sign-in. Actor without an `@`
  (`refresh-pipeline`, `refresh-pipeline-ai`) → an "Automatic" group; human rows from before `0017`
  → a per-person "before sign-ins were recorded" group. Filters are a GET
  form (person, activity type, date range in America/Denver, place/box
  name); paging is "Show older" (`?until=`, 300 rows per source). Both tables
  are kept permanently — the 90-day email cleanup never touches them.

- **`/admin` — Dashboard** (`src/app/(site)/admin/page.tsx`, overhauled #680). A
  greeting + a 7/30/90-day period switch (`?period=`, server-rendered
  `<Link>`s, no client JS) that every period-scoped number on the page
  reads from and compares against the previous period of the same length
  (`src/lib/boxStats.ts`'s `filterByPeriod`/`filterByPreviousPeriod`;
  `src/lib/cfAnalytics.ts`'s equivalent split for Cloudflare's numbers).
  Below that: a `PublishPanel` (only when unpublished changes exist and this
  isn't staging — same "Test site" banner gate `/admin/places` uses), a
  `DashboardNeedsStrip` (four link cards: places to review, waiting to
  publish, box photos & sponsor requests, boxes empty or low — two of the
  four are temporary combined-count fallbacks until #674/#675 and #677 fold
  their own queues into other tabs), a **Visitors** section reading
  Cloudflare's GraphQL Analytics API server-side (`cfAnalytics.ts` — the
  ONLY source of unique-visitor numbers in this app; PostHog is
  memory-only and counts every page load as a new visitor — AGENTS.md's
  "PostHog" section), a **Blessing boxes** numbers section reusing
  `boxStats.ts` (the
  same math the public Boxes page uses), and a **Map data health** section
  (published-place counts, `StalePlacesList`'s data at a 90-day/3-month
  threshold, the latest automated data-refresh run, and box problem-report
  counts). `KpiCard`/`BarList`/`DailyBars` render every number as plain
  SVG/CSS — no chart library. A Cloudflare API failure or missing token
  degrades ONLY the Visitors section to "unavailable right now"; every
  other section renders from D1 regardless.
- **`/admin/places` — venue list** (`VenueListView`). All `venues` rows —
  draft, published, archived — filtered and searched entirely client-side
  (low hundreds of rows). Each row shows ONE status (#673, replacing an old
  status column + a separate, frequently-disagreeing "Unpublished changes"
  column): **Draft** / **Live** / **Live · edits waiting** / **Removed**,
  computed by `displayStatusOf()` (`src/lib/adminVenues.ts`) from the row
  plus its matching `src/data/published-venues.ts` entry (what the public
  map is actually serving) — a diff on any field EXCEPT `last_verified`
  (a "last checked" bump alone never flags a place), never true for a
  blessing box (boxes are live without publishing) or on staging (which can
  never Publish — `isProductionWorker()`, `publishVenues.ts`). A status key
  above the table explains all four in plain language. Read-only itself;
  each row's NAME is the link to its edit page (#672) — an archived row's
  name stays plain text (editing an archived venue 409s). A "Live · edits
  waiting" place's edit page shows a "Waiting to publish" box: every
  differing field's on-map-now → after-publish values, and who changed it
  (`diffPublishedFields()` / `attributeFieldChange()`, same file — the
  latter reads `audit_log` since the last publish, correlating an approved
  `change_proposals` row's `applied_at` to name a Data Refresh approval
  distinctly from a plain hand-edit). On staging, a banner replaces the
  Publish panel outright ("Test site: publishing is turned off here") and no
  place can ever read "edits waiting."
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
- **Public submissions queue (#259) — folded into the Places tab by #675.**
  `/admin/submissions` now just redirects to
  `/admin/places?show=review&from=public`. The Places page reads every
  pending `public_submissions` row, newest first, groups a `closure` report
  onto its reported venue's own row (any status, including archived — a
  report against a since-removed place still shows) and a `new_venue`
  suggestion as its own "Suggested new place" row, both tagged "Public" —
  see "Refresh proposals" below for the parallel `change_proposals`
  mechanism this mirrors. Both source's items render on the venue edit
  page's "Suggestions to review" box (`SuggestionsBox`, now a discriminated
  `ReviewItem[]` — a `change_proposals` item renders `ProposalCard`, a
  `public_submissions` item renders `SubmissionCard`). A closure card's
  actions are **Mark done** (`POST /api/admin/submissions/<id>/done` — the
  admin already fixed the venue via a save or an archive elsewhere; writes
  one `audit_log` row) and Reject (its own route, no `audit_log` row — it
  changes no venue). A `new_venue` card still links to
  `/admin/venues/new?submission=<id>` (prefilled by
  `mapSubmissionPayloadToFormValues()`); the optional `submissionId` rides
  the create route's own `db.batch()` so the venue insert and the approval
  land together. A `closure` report that says the place is really gone
  still uses the pre-existing `?submission=<id>` edit-page banner +
  `ArchiveVenueButton` remove-and-resolve batch (#270), unchanged. Each row's
  JSON `payload` is parsed on its own (`parseSubmissionRow`,
  `src/lib/publicSubmissions.ts`), so one bad row degrades to a
  still-rejectable "couldn't read details" card. The payload mapper's
  category fallback and notes folding are explained in
  `src/lib/adminVenueForm.ts`.
- **Refresh proposals (#390) — folded into the Places tab by #674.**
  `/admin/flags` now just redirects to `/admin/places?show=review`. See
  "Automated venue-refresh pipeline" above.
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
- **Photo review and sponsor requests — folded into the Blessing Boxes tab
  by #677.** `/admin/box-photos` and `/admin/box-adopters` now just
  redirect to `/admin/boxes?show=review`. Every pending/flagged photo and
  pending sponsor request shows on its box's own row in `AllBoxesTable`'s
  "To review" column, with a `BoxesToReviewBox` summary above the table, and
  resolves from that box's own edit page (`BoxReviewBox.tsx`, using the same
  `PhotoReviewCard`/`SponsorRequestCard` components).
