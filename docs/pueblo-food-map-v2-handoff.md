---
project: Pueblo Food Map v2
penpot_file: https://penpot.boyd.fo/#/workspace?team-id=2e5cd59a-bdf4-800b-8008-02d7c8f83a21&file-id=25209d43-a6ec-4b99-88e0-dbc65b21039a
generated: 2026-05-16
updated: 2026-05-17
tier: 4
flavor: Civic Editorial (custom hybrid — Editorial #7 + Civic #12)
brand_url: https://pueblofoodproject.org
---

# Design Handoff — Pueblo Food Map v2

This sidecar accompanies the v2 redesign in Penpot. The coding agent reads this BEFORE writing code; the Penpot PNG export confirms visual intent, but this file carries the truth: navigation wires, state variants, deferred items, and tier/flavor constraints that must hold across every component.

## Page-slug map

| Slug | Page name | Purpose |
| --- | --- | --- |
| 00-cover | 00 Cover | Demo cover page; thumbnails link to current viewport boards |
| 01-ds | 01 Design System | Color & Type swatches; all design tokens live here |
| 06-mobile | 06 v2 - Mobile | All Mobile v2 boards (splash + map + sheet states + location denied + empty search) |
| 07-desktop | 07 v2 - Desktop | All Desktop v2 boards (splash + map + window states + location denied + empty search) |

v1 viewport pages (`02 Mobile`, `03 Tablet`, `04 Desktop`, `05 States`) are renamed `Archive - …` and excluded from this handoff. Tablet v2 deferred to a post-demo iteration.

## Tier

- **Tier 4 — Web App.** The Mapbox migration (Phase 2, PRs #44–#48) replaces Leaflet with `mapbox-gl` + `react-map-gl`. Mapbox GL JS is a WebGL-based vector map engine whose minified bundle weight (~600 KB pre-compression) substantially exceeds the Tier 3 800 KB total-page ceiling. The 800 KB ceiling is officially retired; this project is reclassified as Tier 4 / Web App.
- **Map library:** `mapbox-gl` + `react-map-gl` (react-map-gl v8). Basemap style: `mapbox://styles/mapbox/streets-v12` (demo). Custom Studio brand basemap is a post-demo polish pass.
- **Operational performance target:** Lighthouse Performance score ≥ 85 on mobile (accepts higher bundle size in exchange for vector-map smoothness). Actual as of 2026-05-17: mobile 98, desktop 100 — well above threshold.
- **Sub-budget targets (updated for Tier 4):**
  - JS bundle: no hard KB ceiling; Lighthouse perf ≥ 85 mobile is the gate
  - CSS: ≤ 30 KB (unchanged)
  - Images (excluding map tiles): ≤ 200 KB (unchanged)
  - Font files: 2 variable fonts ≤ 35 KB each (unchanged)
  - Third-party tags: ≤ 2 (1 Mapbox tile provider + 1 self-hosted analytics)

## Flavor

**Civic Editorial** — custom hybrid combining Editorial (#7) display signature with Civic / govtech (#12) body / contrast / color rule. Documented hybrid because the catalog has no exact match for "civic mission with editorial display type and pre-locked PFP brand colors."

- **Display font:** Fraunces (variable, weights 300-900). Self-host as variable woff2.
- **Body font:** Public Sans (variable, weights 100-900). Self-host as variable woff2. Replaces v1's Inter (banned by skill).
- **Color rule:** PFP brand navy `#190F3F` + bone neutral (`color.bone.50`, `color.bone.100`) + orange `#F7943C` (primary CTA) + yellow reserved for support badges only + sage palette for calm / supporting states + per-category swatches via `color.cat.*` tokens.
- **Body text contrast:** WCAG AAA (7:1). Use `color.ink.700` or darker on `color.bone.50` backgrounds.

**Banned by name** (do not use, even as a "neutral fallback"):
- Fonts: Inter, Inter Tight, Roboto, Arial, Source Sans Pro, system-ui-only
- Colors: gray-500 (`#6B7280`), blue-50 (`#EFF6FF`), blue-500 (`#3B82F6`), unmodified Tailwind palette tokens

## Design tokens (already in Penpot file)

Names + roles. Hex values are in the Penpot Design System page (`01 Design System`).

**Brand:** `color.brand.navy`, `color.brand.orange`, `color.brand.yellow`

**Neutrals (bone):** `color.bone.50`, `color.bone.100`, `color.bone.200`, `color.bone.300` — warm off-whites for backgrounds and surfaces.

**Text (ink):** `color.ink.400`, `color.ink.500`, `color.ink.700`, `color.ink.900` — warm dark grays. AAA contrast for body uses `ink.700`+.

**Supporting (sage):** `color.sage.50`, `color.sage.100`, `color.sage.500`, `color.sage.600`, `color.sage.700` — calm green for badges (SNAP/WIC pills), "open today" success states, selected-pin ring.

**Clay (warm accent):** `color.clay.100`, `color.clay.500`, `color.clay.700` — used sparingly.

**Semantic:** `color.semantic.success`, `color.semantic.warning`, `color.semantic.danger`.

**Category swatches:** `color.cat.pantry`, `color.cat.grocery`, `color.cat.convenience`, `color.cat.farm`, `color.cat.garden`, `color.cat.landscape`, `color.cat.meal` — one swatch per of the 7 venue categories.

**Border radius:** `radius.sm`, `radius.md`, `radius.lg`, `radius.xl`, `radius.full`.

When coding, override the Tailwind palette in `tailwind.config.js` so these tokens replace every default gray/blue. No `gray-500`, no `blue-500` allowed anywhere in the build.

## Per-board specs

### Mobile · 375 x 812 · splash

- Page: `06 v2 - Mobile`
- Purpose: First-visit entry. Explains the app + lists categories + asks for location permission.
- **Behavior (code-side):** First visit only. Set `localStorage.getItem('pfm.splash.seen')` after first dismissal; subsequent visits land directly on the map.
- Wiring:
  - `primary-cta` ("Find food near me"): click → request `navigator.geolocation.getCurrentPosition`. On grant → navigate to map centered on user location. On denial → navigate to map (Pueblo center) with the "Location denied" banner.
  - `secondary-cta` ("Show the Pueblo map"): click → navigate to map (Pueblo center) without requesting permission.
- State variants:
  - default: this board
  - loading: (deferred — splash is static; geolocation prompt is the only loading state, browser-handled)
  - empty: n/a
  - error: handled by "location denied" board
  - offline: render the splash from cached HTML shell; CTAs become "Show the Pueblo map" only
- Data sources: none (static content)
- Props: none
- Accessibility: WCAG AAA contrast on body text. Primary CTA orange `#F7943C` with navy text passes AAA (high luminance contrast). Secondary CTA needs `aria-label="Show the Pueblo map without using my location"`. Microcopy below CTAs explains location use — required for trust on civic apps.
- Anti-pattern guardrails enforced: no decorative imagery, no centered hero + 3-card grid, no banned fonts, no banned colors, both CTAs wired (not stubs).
- Stubs: none

### Mobile · 375 x 812 · map (located)

- Page: `06 v2 - Mobile`
- Purpose: Default map screen after geolocation success.
- Wiring:
  - `locate-btn` (top-right circle): click → "Location denied" board (in real code, re-request geolocation and surface success/failure)
  - `bottom-sheet-peek` (bottom 88px peek): click → expand to `sheet-quick`
- State variants:
  - default: this board (sheet at peek snap point)
  - loading: skeleton tile area + spinner overlay
  - empty: not applicable (map always shows tiles)
  - error: "Network error" code state — show banner over map: "Map tiles unavailable. Refresh to retry."
  - offline: service worker cache renders the shell + last-known pin locations; banner: "You're offline. Showing cached venues."
- Data sources:
  - Geolocation: `navigator.geolocation.watchPosition` (consider `getCurrentPosition` for battery)
  - Venues: `/api/venues` (or static JSON build artifact). 112 venues live as of 2026-05-15.
- Props: `viewport: { center: LatLng, zoom: number }`, `selectedVenueId?: string`
- Accessibility:
  - Search bar: `<input type="search" aria-label="Search venues or categories">`. Submit on Enter.
  - Locate button: `aria-label="Use my location"`, minimum 44×44 touch target (design shows 44, code must preserve)
  - Map markers: each marker has `aria-label="<venue name>, <category>, <distance>"`, keyboard-focusable, Enter opens sheet
- Anti-pattern guardrails enforced: no sidebar (chrome violation removed), search bar is THE only persistent chrome on this screen
- Stubs:
  - Search bar field is a `[stub]` in design; behavior is code-side (typeahead + filter)
  - `Get directions` button on sheet — links to Google Maps with venue coords (external)

### Mobile · 375 x 812 · map (Pueblo center)

- Page: `06 v2 - Mobile`
- Purpose: Map screen entered without geolocation (user chose "Show the Pueblo map" or denied permission).
- Wiring:
  - `locate-btn`: click → "Location denied" board (in code, re-request geolocation)
- State variants: same as `map (located)` minus the user-location dot
- Data sources: same as `map (located)`; viewport hardcoded to Pueblo center (lat 38.2544, lng -104.6091) at zoom 12
- Props: same
- Accessibility: same
- Stubs: same. Plus: the "Showing Pueblo center" microcopy below search bar is informational — fade out after 4s on user pan/zoom interaction.

### Mobile · 375 x 812 · sheet-quick

- Page: `06 v2 - Mobile`
- Purpose: Bottom sheet expanded to "quick summary" snap point (~320px tall) when a venue marker is tapped.
- Wiring:
  - `see-full-details` link: click → `sheet-full`
  - `close-x` (top-right of sheet): click → `map (located)` (sheet retracts to peek)
- State variants:
  - peek (88px): the `map (located)` board's default state
  - quick (320px): this board
  - full: `sheet-full`
- Data sources: venue data passed from selected marker. Required fields: name, category, distanceMiles, hoursToday, acceptsSnap, acceptsWic.
- Props: `venue: Venue`
- Accessibility:
  - Sheet is implemented as a Radix DialogContent (v1 has a Radix a11y violation flagged for fix — ensure `Dialog.Title` is included this time)
  - Drag handle has `aria-label="Drag to expand or close venue details"`, keyboard focusable
  - "Get directions" button is the primary action and should be the first focusable element after the sheet header
- Anti-pattern guardrails enforced: dismissable (Escape + scrim-tap + explicit close X — all three required by chrome rules)
- Stubs:
  - `Get directions` button — opens Google Maps in new tab with venue coords. External, not in-app.

### Mobile · 375 x 812 · sheet-full

- Page: `06 v2 - Mobile`
- Purpose: Bottom sheet fully expanded with complete venue detail.
- Wiring:
  - `close-x-bg` (close button): click → collapses sheet back to `sheet-quick`
- State variants: same as `sheet-quick`
- Data sources: extended venue data — name, category, address, phone, hoursByDay (Mon-Sun), acceptsSnap, acceptsWic, notes/description.
- Props: `venue: VenueFull`
- Accessibility:
  - Hours table rows have today's row highlighted with `aria-current="true"`
  - Phone tap-to-call: `<a href="tel:+1...">` not a styled button
  - Address line has "Get directions →" link with `aria-label="Get directions to <venue name>"`
- Stubs:
  - "Tap to call" link — `tel:` href, native handoff to dialer
  - Hours table data depends on Plentiful + community-submitted updates

### Mobile · 375 x 812 · location denied

- Page: `06 v2 - Mobile`
- Purpose: Map screen with permission-denied banner explaining graceful fallback.
- Wiring:
  - `locate-btn`: click → still navigates to this same board (in code, re-request permission — the browser may have a permanent block, in which case route the user to settings explanation)
  - `dismiss-x` (banner close): click → `map (Pueblo center)` (banner dismissed)
- Data sources: same as `map (Pueblo center)`
- Props: same
- Accessibility:
  - Banner is a `role="alert"` (or `role="status"` for less aggressive screen reader behavior)
  - Banner copy explains user agency: they can still browse, and can retry by tapping the locate icon
- Anti-pattern guardrails enforced: graceful degradation with explicit user-facing copy (no silent failure)
- Stubs: none

### Mobile · 375 x 812 · empty search

- Page: `06 v2 - Mobile`
- Purpose: Map screen with an empty-result state shown after a no-match search.
- Wiring: search query state and empty-result behavior are code-side. The category chip suggestions inside the popover are stubs in this design — code wires them to re-issue search with the chip's category.
- Data sources: search index of (venue names, category names, optional neighborhoods)
- Props: `query: string`, `results: Venue[]` (empty in this state)
- Accessibility:
  - Empty-result popover has `role="status"` so screen readers announce it
  - Each chip is a button with `aria-label="Show <category> venues"`
- Anti-pattern guardrails enforced: empty state doesn't require a network fetch (cached shell renders it); no spinner blocking the viewport

### Desktop · 1440 x 900 · splash

- Page: `07 v2 - Desktop`
- Purpose: First-visit entry, desktop layout. Same content as Mobile splash; 2-column layout.
- **Behavior (code-side):** First-visit-only, same `localStorage` gate as Mobile splash.
- Wiring:
  - `primary-cta` ("Find food near me"): click → map (located) (request geolocation in code first)
  - `secondary-cta` ("Show the Pueblo map"): click → map (Pueblo center)
- State variants: same as Mobile splash
- Data sources: none
- Props: none
- Accessibility: same a11y posture as Mobile splash. "How it works" 8th cell is a `[stub]` — code should implement an expandable panel or link to a docs page.
- Anti-pattern guardrails enforced: no centered hero + 3-card pattern (this is a 2-column splash with category grid on the right; deliberate civic choice, not generic SaaS landing)
- Stubs: "How it works" 8th cell — expand-to-modal or link, TBD

### Desktop · 1440 x 900 · map (located)

- Page: `07 v2 - Desktop`
- Purpose: Default desktop map screen, with floating window anchored top-right showing selected venue quick summary.
- Wiring:
  - `locate-btn` (top-right circle): click → "Location denied" board
  - `see-full-details` (link inside window): click → `window-expanded`
  - `close-x` (X inside floating window): click → `located-no-window` (map remains, window dismissed, no venue selected)
- State variants:
  - with-selected-venue (window visible): this board
  - without-selected-venue: `located-no-window`
  - location-denied: `location denied` (no user dot)
- Data sources: same as Mobile `map (located)`
- Props: `viewport`, `selectedVenueId?`
- Accessibility:
  - Search bar top-center: width ~520px, single field. Same `<input type="search">` + `aria-label` as Mobile.
  - Locate button at top-right: 52×52 hitbox, `aria-label="Use my location"`
  - Floating window is a positioned panel — in code, anchor to selected marker or use right-rail fixed position. Window must be keyboard-focusable and dismissable via Escape.
- Anti-pattern guardrails enforced:
  - No sidebar. The v1 360px categories rail + 280px detail panel are gone.
  - Chrome budget: at default load, only the search bar (520×52) + locate button (52×52) consume chrome. Total chrome area ~6% of 1440×900 viewport. Well under the 30% ceiling.
- Stubs:
  - Search bar field, `Get directions` button — same as Mobile

### Desktop · 1440 x 900 · map (Pueblo center)

- Page: `07 v2 - Desktop`
- Purpose: Desktop map without geolocation. No user dot. No floating window unless venue is selected.
- Wiring:
  - `locate-btn`: click → "Location denied" board
- State variants: same logic as Mobile equivalent
- Data sources: same
- Props: same
- Accessibility: same
- Stubs: same

### Desktop · 1440 x 900 · window-expanded

- Page: `07 v2 - Desktop`
- Purpose: Floating window expanded to full venue detail (right-side anchored, ~420×720).
- Wiring:
  - `close-x` (X top-right of window): click → `map (located)` (back to quick state)
  - `collapse-btn` (collapse-up button): click → `map (located)` (same result — collapse to quick)
- State variants: same component, two states (quick on `map (located)`, expanded here)
- Data sources: same extended venue data as Mobile `sheet-full`
- Props: `venue: VenueFull`
- Accessibility: same as Mobile `sheet-full`. Window is a focused panel; keyboard navigation should cycle within it when expanded.
- Stubs: same external links

### Desktop · 1440 x 900 · located-no-window

- Page: `07 v2 - Desktop`
- Purpose: Default desktop map (located) WITHOUT a selected venue / floating window. This is the initial state after geolocation.
- Wiring:
  - `locate-btn`: click → "Location denied" board
- State variants: tap a pin → opens `map (located)` (window appears with that venue)
- Data sources: same
- Props: same
- Accessibility: same. No window means the map area is fully exposed; pins must be keyboard-tabbable.
- Stubs: same

### Desktop · 1440 x 900 · location denied

- Page: `07 v2 - Desktop`
- Purpose: Desktop equivalent of Mobile location-denied banner.
- Wiring:
  - `dismiss-x` (banner close): click → `map (Pueblo center)`
- State variants: same posture as Mobile
- Data sources: same
- Props: same
- Accessibility:
  - Banner is `role="alert"` near the top of the map
  - 420×96 size, content same as Mobile but laid out horizontally
- Stubs: none

### Desktop · 1440 x 900 · empty search

- Page: `07 v2 - Desktop`
- Purpose: Desktop empty-search popover state.
- Wiring: search behavior + chip click are code-side stubs
- Data sources: search index
- Props: `query: string`, `results: []`
- Accessibility: popover is `role="status"`. Chips are buttons with `aria-label="Show <category> venues"`.
- Stubs: chip click handlers

## Wiring map

| Source board | Source element | Trigger | Destination board | Page |
| --- | --- | --- | --- | --- |
| Mobile · 375 x 812 · splash | primary-cta | click | Mobile · 375 x 812 · map (located) | 06 v2 - Mobile |
| Mobile · 375 x 812 · splash | secondary-cta | click | Mobile · 375 x 812 · map (Pueblo center) | 06 v2 - Mobile |
| Mobile · 375 x 812 · map (located) | locate-btn | click | Mobile · 375 x 812 · location denied | 06 v2 - Mobile |
| Mobile · 375 x 812 · map (located) | bottom-sheet-peek | click | Mobile · 375 x 812 · sheet-quick | 06 v2 - Mobile |
| Mobile · 375 x 812 · map (Pueblo center) | locate-btn | click | Mobile · 375 x 812 · location denied | 06 v2 - Mobile |
| Mobile · 375 x 812 · sheet-quick | see-full-details | click | Mobile · 375 x 812 · sheet-full | 06 v2 - Mobile |
| Mobile · 375 x 812 · sheet-quick | close-x | click | Mobile · 375 x 812 · map (located) | 06 v2 - Mobile |
| Mobile · 375 x 812 · sheet-full | close-x-bg | click | Mobile · 375 x 812 · sheet-quick | 06 v2 - Mobile |
| Mobile · 375 x 812 · location denied | locate-btn | click | Mobile · 375 x 812 · location denied | 06 v2 - Mobile |
| Mobile · 375 x 812 · location denied | dismiss-x | click | Mobile · 375 x 812 · map (Pueblo center) | 06 v2 - Mobile |
| Desktop · 1440 x 900 · splash | primary-cta | click | Desktop · 1440 x 900 · map (located) | 07 v2 - Desktop |
| Desktop · 1440 x 900 · splash | secondary-cta | click | Desktop · 1440 x 900 · map (Pueblo center) | 07 v2 - Desktop |
| Desktop · 1440 x 900 · map (located) | locate-btn | click | Desktop · 1440 x 900 · location denied | 07 v2 - Desktop |
| Desktop · 1440 x 900 · map (located) | see-full-details | click | Desktop · 1440 x 900 · window-expanded | 07 v2 - Desktop |
| Desktop · 1440 x 900 · map (located) | close-x | click | Desktop · 1440 x 900 · located-no-window | 07 v2 - Desktop |
| Desktop · 1440 x 900 · map (Pueblo center) | locate-btn | click | Desktop · 1440 x 900 · location denied | 07 v2 - Desktop |
| Desktop · 1440 x 900 · window-expanded | close-x | click | Desktop · 1440 x 900 · map (located) | 07 v2 - Desktop |
| Desktop · 1440 x 900 · window-expanded | collapse-btn | click | Desktop · 1440 x 900 · map (located) | 07 v2 - Desktop |
| Desktop · 1440 x 900 · located-no-window | locate-btn | click | Desktop · 1440 x 900 · location denied | 07 v2 - Desktop |
| Desktop · 1440 x 900 · location denied | dismiss-x | click | Desktop · 1440 x 900 · map (Pueblo center) | 07 v2 - Desktop |

20 navigate-to interactions wired in Penpot prototype mode. 2 named flows for demo:
- **Demo v2 - Mobile** — starts at `Mobile · 375 x 812 · splash`
- **Demo v2 - Desktop** — starts at `Desktop · 1440 x 900 · splash`

## States covered

| State | Mobile | Desktop |
| --- | --- | --- |
| Default (splash) | ✓ Mobile splash | ✓ Desktop splash |
| Default (map, located) | ✓ map (located) | ✓ map (located) |
| Default (map, no geolocation) | ✓ map (Pueblo center) | ✓ map (Pueblo center) |
| Sheet/window quick summary | ✓ sheet-quick | ✓ map (located) with window |
| Sheet/window full detail | ✓ sheet-full | ✓ window-expanded |
| Sheet/window dismissed | ✓ map (located) | ✓ located-no-window |
| Location denied | ✓ location denied | ✓ location denied |
| Empty search result | ✓ empty search | ✓ empty search |
| Loading | ✗ deferred (code-side skeleton) | ✗ deferred (code-side skeleton) |
| Error (network / tile failure) | ✗ deferred (banner over map; spec'd in board notes) | ✗ deferred |
| Offline | ✗ deferred (service worker + cached shell; spec'd in board notes) | ✗ deferred |

## Budgets at handoff (Tier 4 — post-Mapbox migration, measured 2026-05-17)

Tier 3 ceilings retired with the Mapbox migration. The JS bundle ceiling in particular is no longer enforced as a hard KB limit — Lighthouse Performance score ≥ 85 on mobile is the operational gate.

| Sub-budget | Tier 3 ceiling (retired) | Actual post-Mapbox | Notes |
| --- | --- | --- | --- |
| Lighthouse perf (mobile) | n/a | **98** | Well above the ≥ 85 Tier 4 gate |
| Lighthouse perf (desktop) | n/a | **100** | Up from Phase 1 baseline of 86 |
| Lighthouse a11y | n/a | **98** (mobile + desktop) | Matches Phase 1 baseline |
| JS bundle | 400 KB (retired) | ~1.4 MB raw | mapbox-gl ~600 KB + react-map-gl + app code; compressed transfer is smaller |
| CSS | 30 KB | ~15-20 KB | Tailwind utility CSS purged + brand token overrides |
| Images (excl. tiles) | 200 KB | ~5 KB | No decorative images; only inline SVG pins + favicon |
| Hero image | 120 KB | 0 KB | No hero — splash uses typography only |
| Font files | 2 × 35 KB | ~50 KB total | Fraunces variable woff2 ~28 KB + Public Sans variable woff2 ~22 KB (self-hosted) |
| Third-party tags | 2 | 1 | Mapbox tile provider. Plausible self-hosted = 0 tags. |

**Low-carbon design note:** Mapbox GL JS is a larger bundle than Leaflet. The trade-off is accepted for the demo: vector maps load fewer tiles on pan/zoom, reducing tile-fetch network requests vs. raster OSM tiles. The decision is documented here per the low-carbon-design skill: smoothness and reduced tile traffic are the justification for accepting a larger initial JS payload. Revisit with a custom lightweight basemap style post-demo if environmental footprint is a concern.

## Open questions / deferred

1. **Pin marker rendering.** ~~Penpot mockup uses colored circles (24×24 ellipses) as map markers because the plugin path API is impractical for drawing Lucide-style drop-pin SVGs at scale. **Code should render proper Lucide `MapPin` SVG icons** in production, colored by category token, with a 4px sage outer ring on the selected state. The colored circles in Penpot communicate category intent for demo purposes only.~~ **SHIPPED (PR #45):** `VenueMarker` renders Lucide `MapPin` filled with category color token + 4px sage ring on selected state.

2. **Search bar magnifying glass icon.** ~~Penpot mockup uses a small primitive shape (renders as a gray dot). **Code should use Lucide `Search` icon** inside the input, 16×16 mobile / 18×18 desktop, fill `color.ink.400`.~~ **SHIPPED (PR #43):** `SearchBar` renders Lucide `Search` 16×16 mobile / 18×18 desktop.

3. **Locate button crosshair icon.** ~~Penpot mockup composes vertical + horizontal lines + center dot; renders as `+`/`-` artifacts depending on board. **Code should use Lucide `Locate` icon** (or `LocateFixed` when geolocation is active), fill white, 18×18 mobile / 22×22 desktop.~~ **SHIPPED (PR #43):** `LocateButton` renders Lucide `Locate` (idle/denied) and `LocateFixed` (active/granted).

4. **First-visit-only splash.** Implement in code via `localStorage.getItem('pfm.splash.seen.v2')` gate. Show splash on first visit; set the key when either CTA is pressed or the splash is dismissed. Bump the version suffix (`v2`, `v3`, ...) only when the splash content materially changes — that re-shows the splash to existing users.

5. **Geolocation permission timing.** Don't pre-request geolocation on splash mount. Only request when the user taps "Find food near me" — explicit user gesture is required by some browser permission policies and is better UX. If the user has already granted (permission state `granted`), skip the splash CTA delay and navigate immediately.

6. **Service worker / offline state.** Not designed in Penpot v2. Implement separately: cache HTML shell + last-known venue list + map tiles for the Pueblo bounding box. Offline banner copy: "You're offline. Showing cached venues. Map updates will resume when you're back online."

7. **Wordmark letter-spacing.** Design spec called for 0.04em letter-spacing on the wordmark. Penpot's plugin API rejected the unit string; wordmark renders without it. In CSS, apply `letter-spacing: 0.04em;` to the wordmark.

8. **Desktop splash left-column whitespace.** The "WHAT YOU'LL FIND" section header on the left column is followed by empty vertical space before the CTAs because the category cards are on the right. Two valid options in code: (a) remove the section header entirely (the category grid on the right is self-explanatory), or (b) move "WHAT YOU'LL FIND" to be a header above the category grid on the right. Option (b) is preferred — it tightens the left column and improves the right column's hierarchy.

9. **"How it works" 8th cell on Desktop splash.** Currently rendered as a category-style card. Should either link to a separate `/about` route or expand inline into a panel explaining data sources (Plentiful, community submissions) and update cadence. Treat as a `[stub]` until product decides.

10. **Tablet (1024 x 768) viewport.** Deferred from v2. Existing `Archive - 03 Tablet v1` board is kept in the file for reference. Add a v2 tablet pass after the 2026-06-09 demo if the audience reception suggests it.

11. **Locale toggle (EN/ES).** v1 had a Spanish locale board. v2 doesn't yet include localized splash + map boards. Plentiful + community translations are still relevant — implement locale toggle in code using existing i18n infrastructure (`<html lang>`, route-level locale, or query string).

12. **WCAG AAA verification.** Spec calls for AAA contrast on body text. Verify with automated tools after deploy: `axe-core` + `lighthouse --only-categories=accessibility` + manual screen reader smoke test (NVDA on Windows / VoiceOver on Mac).

## How the coding agent should use this sidecar

Read this file BEFORE writing UI code for v2. When you encounter a question the Penpot export doesn't answer ("what does this button do?", "what's the empty state?"), search this file for the board name. The spec is authoritative for navigation wires, state variants, and a11y posture.

Where this file conflicts with the Penpot export, this file wins for behavior; the Penpot export wins for visual layout. Where both are silent, ask before implementing.

Flavor enforcement: every component must use Fraunces (display) + Public Sans (body) + the listed token palette. Reject any banned default by name. Override `tailwind.config.js` to make banned tokens unreachable.
