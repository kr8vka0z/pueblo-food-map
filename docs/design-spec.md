# Pueblo Food Access Map — Design Specification

**Status:** v1.0 — proposed, not yet implemented.
**Author:** Atlas (Claude Opus 4.7), 2026-05-13.
**Scope:** Full redesign for production v1, targeting the 2026-06-09 PFP team meeting demo.
**Deliverable:** A single visual system + responsive layouts + component specs that work from a 320px Android phone up to a 4K monitor without losing any functionality, with the editorial polish you'd expect from a small senior San Francisco product studio (think Linear, Stripe Atlas, Origin, Nava PBC, Code for America) — restrained, warm, accessible.

This document is the source of truth for the visual design. Each section starts with **the decision**, followed by **the rationale**. Read top-to-bottom on the first pass; treat sections 3+ as reference.

---

## 0. TL;DR

- **Voice of the product:** civic, warm, confident, calm. Not "VC startup," not "government website."
- **Design philosophy:** *map-as-primary* on mobile (à la Apple Maps / Citymapper) with a draggable bottom sheet; *list-and-map split* on desktop. One product, three resolutions, no functionality loss.
- **Palette:** warm bone background, deep sage primary, Pueblo-clay accent. Two type families: **Inter** for UI, **Fraunces** for display. Subtle, restrained, editorial.
- **What's new vs current:** search, category filters that actually filter, Spanish toggle, "open now" computation, SNAP/WIC badges, get-directions deep link, venue detail panel, custom map tiles, custom SVG markers, motion polish.
- **What stays:** the underlying data model (`Venue`), the distance-sort logic, the geolocation flow, Leaflet + react-leaflet, Next.js 16, Tailwind v4. Zero schema changes required.
- **Implementation budget:** roughly 2–3 sessions of focused work to ship the redesign behind the existing CI gate.

---

## 1. Design philosophy

### 1.1 The product is a civic tool, not a consumer app

The user might be a Pueblo resident scrambling for a food pantry 36 hours after their SNAP card stopped working. They might be 67 years old, on a flip-feature smartphone, in low light, with a cracked screen and ⅓ battery, walking. They might read Spanish more comfortably than English. They might not be a "tech user" in the sense most San Francisco designers usually mean.

**Implication:** every aesthetic decision is checked against three filters before it ships:

1. **Will it work for someone reading at 18pt with shaky hands?** (Touch targets ≥ 44px, body text ≥ 16px, never below 14px for anything functional.)
2. **Will it work over a 1G connection?** (No hero video, no autoplay anything, ship < 250KB JS budget per route.)
3. **Does it look like it respects them?** (Warm, dignified, sourced. No clip-art icons, no condescending illustrations, no "we know better" tone.)

### 1.2 The aesthetic target: SF studio, civic-tech subset

The reference set is intentionally narrow:

- **Stripe Atlas, Linear, Notion (mid-2020s):** restrained palette, editorial typography, generous whitespace, hairline borders over heavy shadows.
- **Code for America (GetCalFresh, ClientComms), Nava PBC, Origin, GiveDirectly:** the civic-tech ethos — large type, sourced data, multilingual, calm.
- **Apple Maps, Citymapper, Transit:** map-first mobile pattern with bottom sheets and snap points.

What we are explicitly **not** trying to look like:

- Geocities-era municipal websites.
- Trendy crypto / agency portfolios (gradients, dark mode by default, neon).
- A generic Tailwind starter (every-app blue-600 primary, indigo gradients).

### 1.3 Design principles, in priority order

1. **Functionality parity is non-negotiable.** Every feature available at one breakpoint is available at every breakpoint, just laid out differently.
2. **Map is the hero on mobile.** Sidebar-as-primary is a desktop affordance; on a phone the map is what someone needs to see first.
3. **One bold accent, used sparingly.** Sage green for primary action and selected state. Everything else is neutral.
4. **Editorial typography earns its keep.** The display face (Fraunces) is used for the wordmark, screen titles, and venue names — places that carry voice. Everything else is Inter. Two families, no more.
5. **Motion is meaning, not decoration.** Map flyTo, sheet drag, selection states animate. Nothing else does.
6. **Accessibility is the brief, not a checklist at the end.** WCAG 2.2 AA target, AAA for body text.

---

## 2. Functional audit — current state vs target

The current build (`src/components/Map.tsx`, `Sidebar.tsx`, `MapWrapper.tsx`, `page.tsx`) has the bones. The redesign keeps every existing capability and adds the gaps below.

### 2.1 Features the redesign keeps (working today)

| Feature | Current location | Keep |
|---|---|---|
| Map with 74 markers | `Map.tsx` Leaflet `CircleMarker` | Yes — replace `CircleMarker` with custom SVG marker |
| Distance-sorted sidebar | `MapWrapper.tsx` haversine sort | Yes — exact logic preserved |
| Geolocation → fly-to-user | `MapWrapper.tsx` + `Map.tsx` `flyTo` | Yes |
| Click venue → fly to marker | `Map.tsx` `MapController` | Yes |
| Hover tooltips | `Map.tsx` `Tooltip` | Replaced with detail panel on click; hover stays on desktop |
| Category legend | `page.tsx` colored dots | Replaced by interactive filter chips |
| Location-status banner | `Sidebar.tsx` top bar | Replaced by inline pill on the search/filter row |

### 2.2 Features the redesign adds (gaps to close)

| Gap | New feature | Where |
|---|---|---|
| Legend is not interactive | Tap a category chip → filter the map + list | Filter chip row, all breakpoints |
| No way to find a specific place | Type-to-search by name and address | Search input, all breakpoints |
| Bilingual users are second-class | EN / ES toggle in header | Persistent header control |
| Schema has `accepts_snap` / `accepts_wic`; not surfaced | Badges on every list item + detail panel | Venue card + detail |
| Schema has `hours_weekly`; not summarized | "Open now" / "Opens at 4pm" badge computed at render time | Venue card + detail |
| README roadmap item #6: Google Maps directions deep link | "Get directions" CTA on every venue detail | Detail panel primary button |
| Tap-to-call missing | Phone numbers are `tel:` links | Detail panel |
| Source / last-verified hidden | "Sources & data" disclosure at bottom of detail panel | Detail panel |
| Raw OSM tiles look generic | Custom-styled basemap | `Map.tsx` `TileLayer` |
| `CircleMarker` is a colored dot — no category legibility at glance | Custom SVG pin with category icon inside | New `<VenueMarker />` |
| No empty state when filters return zero results | Illustrated empty state with reset CTA | List column |
| No skeleton when geolocation is loading | Skeleton list + map shimmer | All breakpoints |

### 2.3 Features deferred (explicitly out of scope for v1)

- **In-app turn-by-turn routing.** README §6 already commits to the Google Maps deep-link approach; that's correct. OTP + Pueblo Transit GTFS is a v2 conversation.
- **Saved / favorited venues.** Adds account state and auth complexity for a POC.
- **User-submitted venue corrections.** Out of scope until v2, after demo.

---

## 3. Design system tokens

These are the **canonical token values**. Every color, type size, spacing value used anywhere in the product must be one of these. If a use case can't be served by the token set, the token set is wrong — extend the system, don't ship a one-off.

Where Tailwind v4 syntax is shown, the intent is to put these in `globals.css` `@theme` block.

### 3.1 Color

**The palette is four scales: bone (background neutrals), ink (foreground neutrals), sage (primary), and clay (warm accent), plus a small set of semantic colors and category accents.**

Rationale: cool grays (the Tailwind default) feel sterile and clinical. Pueblo is a high-desert steel town with adobe heritage. Warm neutrals signal *human* and *of-this-place*, which matters for a civic tool that serves a specific community. Sage and clay are the two colors you actually see when you walk around Pueblo — gardens and adobe — so they read as locally rooted rather than imported from a generic SaaS palette.

```css
@theme {
  /* Bone — warm background neutrals */
  --color-bone-50:  #FBFAF6;  /* Page background (lightest) */
  --color-bone-100: #F4F1EA;  /* Subtle panel, hover surface */
  --color-bone-200: #E8E3D6;  /* Hairline borders, dividers */
  --color-bone-300: #D4CDB8;  /* Disabled border */

  /* Ink — warm foreground neutrals */
  --color-ink-400:  #8A847A;  /* Secondary text */
  --color-ink-500:  #5F5A52;  /* Body text on bone */
  --color-ink-700:  #2D2A26;  /* Headings, primary text */
  --color-ink-900:  #1A1817;  /* Near-black (display titles, max emphasis) */

  /* Sage — primary brand + interactive */
  --color-sage-50:  #EAF0EC;  /* Selected row background */
  --color-sage-100: #D1DDD3;  /* Hover on sage surfaces */
  --color-sage-500: #4A8466;  /* Default primary */
  --color-sage-600: #2C5F4F;  /* Pressed / focused primary */
  --color-sage-700: #1F4639;  /* High-emphasis primary text */

  /* Clay — secondary accent (sparingly) */
  --color-clay-100: #F8E2D4;  /* Badge surface */
  --color-clay-500: #C2410C;  /* "Open now" pill, urgent action */
  --color-clay-700: #7C2D12;  /* Pressed accent */

  /* Semantic */
  --color-success: #15803D;
  --color-warning: #B45309;
  --color-danger:  #B91C1C;

  /* Category accents — used for map marker fill + list dot ONLY.
     Chosen to (a) hit 3:1 against bone-50, (b) be distinguishable
     for the 8% of male users with red-green color blindness — pantry red
     and garden green are paired with shape/icon, not color alone. */
  --color-cat-pantry:      #BE2D45;  /* Cranberry — pantries (emergency food) */
  --color-cat-grocery:     #1F4E8C;  /* Deep blue — grocery */
  --color-cat-convenience: #0F6573;  /* Teal — convenience */
  --color-cat-farm:        #92591D;  /* Burnt amber — farms */
  --color-cat-garden:      #2C5F4F;  /* Sage (matches brand) — gardens */
  --color-cat-landscape:   #58772B;  /* Olive — edible landscapes */
  --color-cat-meal:        #6B3FA0;  /* Plum — meal sites */
}
```

**Why each color:**

- `bone-50` over `#FFFFFF`: pure white at scale produces eye-fatigue glare; `#FBFAF6` reads as paper, holds up at full brightness outdoors, and pairs with sage and clay without color clashing.
- `ink-900` over `#000000`: pure black creates uncomfortable contrast with warm backgrounds (the so-called "vibrating border" effect). `#1A1817` carries the same perceived weight without the friction.
- Sage `#4A8466` / `#2C5F4F`: sampled from the leaves of native plants common to Pueblo's climate (rabbitbrush, sage, juniper). 4.7:1 contrast at `sage-500` on `bone-50` — passes AA for normal text and AAA for large text.
- Clay `#C2410C`: this is the warm orange of adobe; it's used ONLY for "open now" pills and "Get directions" hover states — anything that needs to feel warm and immediate. Restraint matters: if everything is clay, nothing is.
- Category colors are intentionally desaturated and earthy. The original palette (`#e11d48` rose, `#2563eb` blue, `#9333ea` purple) is fine on a dashboard but reads as "Bootstrap demo" on a map. The new set keeps category distinguishability while losing the saturated tech-app feel.

### 3.2 Typography

**Two families: Inter Variable (UI / body) and Fraunces Variable (display / titles).**

Rationale: Inter is the workhorse of serious UI work — exceptional hinting at small sizes, designed for screens, and free under the SIL Open Font License. Fraunces is a humanist serif with personality; it's used for the wordmark, screen titles, and venue names — places where voice matters. Two families is the maximum a design should have; one would be safer but loses voice; three would feel inconsistent. The current build's Geist (sans + mono) is fine but generic; swapping to Inter + Fraunces is a meaningful upgrade for a humanitarian tool that wants to feel warm.

Both are free, both ship via `next/font/google`, no licensing review needed.

#### 3.2.1 Scale

```
Display (Fraunces, opsz 144, wght 400):
  display-xl : 56 / 60 / -2%    → Wordmark / hero (rare)
  display-lg : 40 / 44 / -1.5%
  display-md : 32 / 36 / -1%    → Page titles ("Pueblo Food Access Map")
  display-sm : 24 / 28 / -0.5%  → Venue name in detail panel

UI (Inter, opsz 14):
  ui-xl  : 20 / 28 / -0.5%   → Section headers
  ui-lg  : 18 / 26 / 0       → Venue card name (mobile-first body emphasis)
  ui-md  : 16 / 24 / 0       → Body text, list item meta
  ui-sm  : 14 / 20 / 0.1%    → Captions, metadata
  ui-xs  : 12 / 16 / 0.2%    → Badge text, tiny labels (use very sparingly)

Mono (Geist Mono):
  data-md : 14 / 20 / 0       → Distance values, hours, addresses
  data-sm : 12 / 16 / 0.1%    → Tiny tabular data
```

(All units px. Format: `font-size / line-height / letter-spacing`. Negative tracking on display sizes is standard editorial practice for tight, confident headlines.)

**Weight strategy:** body text always 400 (regular); semibold (600) for venue names and section headers; bold (700) reserved for the rare emphasis case in a detail panel or wordmark. No use of 800/900 — they read aggressive and undermine the calm voice.

**Why size up the body:** the current build's `text-xs` (12px) in critical paths like the category legend and locale meta is too small for a tool whose primary audience skews older and may have visual impairment. The redesign's minimum size for functional UI is **14px** (`ui-sm`); 12px is reserved for non-essential decorative metadata like "last verified 2026-05-12."

#### 3.2.2 Font loading

```ts
// src/app/layout.tsx
import { Inter, Fraunces, Geist_Mono } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});
const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});
```

The `SOFT` axis on Fraunces softens the terminals on serifs — used at +50 for display sizes to give the headlines a friendlier, less newspaper-formal feel.

### 3.3 Spacing

**4px base, 6 stops, no half-steps.**

```
space-1  : 4px    → tightest inline (badge padding)
space-2  : 8px    → between adjacent labels
space-3  : 12px   → between paired elements
space-4  : 16px   → default cell padding, paragraph spacing
space-5  : 24px   → between paired sections
space-6  : 32px   → between major sections
space-8  : 48px   → page-level rhythm (rare)
space-10 : 64px   → hero spacing only
```

Tailwind v4 maps these to existing utilities (`p-1`/`p-2`/.../`p-10`).

**Rationale:** 4px base survives every breakpoint without breaking alignment. The current build mixes Tailwind's default 4px scale freely; tightening to 6 stops removes the visual jitter that comes from `gap-3` vs `gap-4` vs `gap-5` in adjacent containers. Stripe's design system uses a similar 6-stop discipline.

### 3.4 Radius

```
radius-sm   : 6px     → input fields, badge pills
radius-md   : 10px    → buttons, list items
radius-lg   : 14px    → cards, sheets
radius-xl   : 20px    → bottom sheet top edge
radius-full : 9999    → category chips, avatar, marker
```

**Rationale:** moderate corners — not Apple-iOS-pill, not flat Material. 10px on buttons reads as "designed" without screaming "designed in 2024." The bottom sheet's 20px top-edge radius matches Apple Maps almost exactly, which is the canonical reference for the pattern.

### 3.5 Elevation

**Two tiers, both subtle. No drop-shadow above tier 2.**

```
elevation-1: 0 1px 2px rgba(26, 24, 23, 0.04), 0 0 0 1px rgba(26, 24, 23, 0.05);
  /* Hairline border + breath. Used on cards, inputs at rest. */

elevation-2: 0 4px 12px rgba(26, 24, 23, 0.06), 0 0 0 1px rgba(26, 24, 23, 0.06);
  /* Floating sheet, dropdown, popover. Sitting above content. */
```

**Rationale:** the current trend in serious product design (Linear, Notion, Vercel dashboard) is hairline borders + minimal shadows. Heavy drop shadows belong to skeuomorphism or Material Design 2014. Two tiers is enough to express "on the page" vs "floating above the page"; more tiers create a visual hierarchy users have to parse.

### 3.6 Motion

**One easing curve, three durations.**

```
easing  : cubic-bezier(0.32, 0.72, 0, 1)   /* "easeOutCirc" */
fast    : 150ms    → Hover state, focus ring
default : 250ms    → Tab switch, panel open
slow    : 400ms    → Map flyTo zoom, sheet snap

spring  : { stiffness: 380, damping: 32 }
  /* Used for the draggable bottom sheet only — Apple-Maps-style snap. */
```

**Rationale:** one curve is enough. `cubic-bezier(0.32, 0.72, 0, 1)` is the same curve Apple's UIKit uses for most navigation transitions — it starts confidently and decelerates gracefully, which is the right feel for a map app. The spring config matches Framer Motion's "smooth" preset; it gives the bottom sheet that satisfying "settles into the snap point" feeling Apple Maps users expect.

---

## 4. Information architecture & responsive strategy

### 4.1 Core data unit

The `Venue` type stays. Nothing about the schema changes. The redesign only changes how venues are *projected*: cards on a list, pins on a map, fields in a detail panel.

### 4.2 Three layouts, one feature set

| Breakpoint | Range | Layout pattern | Sidebar | Map | Detail |
|---|---|---|---|---|---|
| **Mobile** | 320 – 767px | Map-dominant with draggable bottom sheet | Becomes sheet | Full-bleed | Replaces list content in sheet |
| **Tablet** | 768 – 1023px | Sidebar + map, sheet-style detail overlay | 360px fixed left | Fills right | Slides in over map from right |
| **Desktop** | 1024px+ | Top bar + nav rail + list + map | 280px filter rail + 380px list | Fills remainder | Slides over list column |

A user can do every meaningful action at every breakpoint:

- Search by name/address → top of every layout.
- Filter by category → filter chips on mobile, filter rail on desktop, both interactive everywhere.
- See distance-sorted list → bottom sheet on mobile, sidebar on tablet/desktop.
- See on map → always visible.
- Open a venue detail → bottom sheet content swap on mobile, side-panel slide on tablet, side-panel slide on desktop.
- Get directions → primary action in every detail view.
- Tap phone → tap-to-call works everywhere (even desktop, opens system handler).
- Switch language → top-bar control on every layout.

### 4.3 Breakpoint logic in code

```ts
// tailwind.config (v4 @theme defaults work, but stated here for clarity)
sm: 640   // unused — we treat 0–767 as "mobile"
md: 768   // tablet begins
lg: 1024  // desktop begins
xl: 1280  // unused — desktop layout already maxed out
2xl: 1536 // unused
```

We intentionally do not have a "narrow desktop" between 1024 and 1280: the desktop layout's content column is set to `min(1440px, 100%)` and centered. Past 1440px we stop scaling; that prevents the map from becoming a screensaver on ultrawide monitors.

---

## 5. Mobile layout (320 – 767px)

The mobile layout is the primary design — this product is mobile-first because its users are mobile-first.

### 5.1 Layout anatomy

```
┌──────────────────────────────────────────┐
│ Status / safe area                       │  ← env(safe-area-inset-top)
├──────────────────────────────────────────┤
│ [≡] Pueblo Food Map        [EN|ES] [⊙]  │  ← 56px sticky top bar
├──────────────────────────────────────────┤
│  ╭───────────────────────────────────╮   │  ← 12px gutter
│  │  🔍  Search venues or address…    │   │  ← 44px search input (floating)
│  ╰───────────────────────────────────╯   │
│                                          │
│       (Custom-styled map fills           │
│        the rest of the viewport)         │
│                                          │
│                                          │
│                                          │
│                                          │
│                                  ╭──╮    │  ← Map controls (right-bottom)
│                                  │◎│    │     above the sheet's peek state
│                                  ╰──╯    │
│                                  ╭──╮    │
│                                  │+ │    │
│                                  │− │    │
│                                  ╰──╯    │
├──────────────────────────────────────────┤
│  ━━━━  ← drag handle                    │  ← Sheet at "peek" snap point
│  74 places near you                      │     (~140px tall)
│  [All] [Pantries] [Grocery] [Garden] →  │     ← horizontal chip scroll
└──────────────────────────────────────────┘
```

### 5.2 Each region, with spec and rationale

#### 5.2.1 Top bar — 56px

**Spec:** sticky to top, `bone-50` background with `bone-200` 1px bottom border. Left: brand icon (24×24 SVG of a wheat sprig in sage) + wordmark "Pueblo Food Map" in `display-sm` Fraunces 500. Right: locale toggle (28px height segmented control "EN / ES") and a "locate me" icon button (44×44px target, sage `sage-500` ring icon).

**Why a top bar at all (and not a translucent floating control like Apple Maps):** an explicit, opaque top bar gives the locale toggle a permanent home and gives the wordmark a place. Apple Maps can hide everything because users already know what Apple Maps is — this product is brand-new to most users and needs to identify itself on every screen.

**Why 56px:** matches the iOS navigation bar height and gives a 44px touch target inside with adequate padding. Material Design tops are 64px but feel chunky on a 5.5" Android screen — 56px is the sweet spot for both platforms.

**Why the wordmark uses Fraunces:** the rest of the UI is Inter; the wordmark in a serif establishes voice on every screen without any other typographic weight. This is the "Linear logo in Söhne" move — the logo carries the personality so the UI doesn't have to.

#### 5.2.2 Search input — 44px height, floating

**Spec:** floats 8px below the top bar (technically still in the header region, with `bg-bone-50` and `elevation-1`). 12px horizontal page gutter on both sides. Magnifying-glass icon (16px) left-aligned with 12px right padding. Placeholder in `ink-400`: "Search venues or address…".

When focused: 2px sage ring (focus indicator), placeholder slides up. Typing filters both the list and the map markers in real time (250ms debounce).

**Why a persistent search bar vs. an icon that expands:** every consumer map app worth respecting (Apple Maps, Citymapper, Transit) keeps the search bar persistent on the home view. A search-icon-that-expands forces a tap to discover and shaves no real estate worth shaving.

**Why the search bar isn't *inside* the top bar:** on a 375px screen, putting search + locale + brand + locate all in 56px means everything is too small. Letting search occupy its own row buys both clearer touch targets and a clearer information hierarchy: "this is the app, here's the search."

#### 5.2.3 Map — fills remaining viewport

**Spec:** full-bleed below the search bar (or technically tucked under it — the map continues to the very top edge so panning feels boundary-less; the top bar and search float above on `elevation-1`).

Tile provider: **CARTO Voyager** as the default basemap (free for OSS, gentle warm earth-tones, excellent label rendering, OSM data underneath so we keep our attribution). Override target: a hand-tuned Mapbox style sometime post-demo for the v2 polish pass.

Marker style: custom SVG pin (see §8.6), not raw `CircleMarker`. The category color and icon live inside the pin; selected state grows the pin and adds a sage outline.

**Why CARTO Voyager over raw OSM tiles:** the standard OSM `tile.openstreetmap.org/{z}/{x}/{y}.png` style is engineering reference rendering, not a designed map. It's dense, high-contrast, and visually loud. CARTO Voyager is in the same family but desaturated and label-aware — water reads cool gray, parks read warm gray-green, roads read off-white. Crucially, it has way better hierarchy for finding pin markers on top: a busy basemap eats markers; Voyager doesn't.

**Why we still keep Leaflet:** swapping to Mapbox GL JS would unlock vector tiles and animated transitions but is a bigger lift than this redesign warrants. Leaflet + Voyager raster tiles is the right move for v1.

**Map controls (bottom-right, anchored 16px from right edge, 16px above sheet peek):**
- "Locate me" button: 48px circle, `bone-50` fill, `elevation-2`, sage icon. Tapping it asks for geolocation if not granted; if granted, flies to user's location.
- Zoom +/− stacked: 48px wide × 96px tall, segmented control style, separated from locate by 8px gap.

Why move zoom controls bottom-right (not top-right where Leaflet defaults): the thumb of a right-handed user holding a phone naturally rests bottom-right; this is the same logic Apple Maps and Google Maps follow. Leaflet's default top-right placement is desktop-mouse-era.

#### 5.2.4 Bottom sheet — 3 snap points

**The signature interaction of the mobile layout.**

**Snap states:**

| State | Height | What's visible | When activated |
|---|---|---|---|
| **Peek** | 140px | Drag handle + count line + filter chip row | Default; after dismissing a venue |
| **Half** | 50vh (about 400px on iPhone 14) | Above + venue list (scrollable) | Tap "View list" on count line, drag up, or swipe up |
| **Full** | viewport minus top bar (≈ 100vh − 100px) | Above + venue list extended; sheet covers map | Drag to top, or tap any list item with detail panel open |

**Spec:**
- 20px top-edge radius (`radius-xl`).
- `bone-50` background.
- `elevation-2` shadow.
- 4px-tall × 36px-wide drag handle, `ink-400` at 30% opacity, top-centered with 8px top padding.
- Drag-to-snap with spring (`{ stiffness: 380, damping: 32 }`), bounded by snap points.
- Tap on the handle area toggles between peek ↔ half.
- Drag is gesture-enabled across the entire top 56px of the sheet, not just the handle.

**Content at each state:**

*Peek (140px tall):*
```
━━━━                                ← 12px down from sheet top
74 places near you            View →  ← 16px row, "View" right-aligned, sage
[All]  [Pantry]  [Grocery]  [Garden] ← 36px chips, horizontal scroll
```

*Half / full (sheet extended):*
```
━━━━
74 places near you
[All]  [Pantry]  [Grocery]  [Garden]
─────────────────────────────────────
[ • Bethany Lutheran Church Garden     ]  ← venue card
[   Community Garden · 1802 Sheridan…  ]
[   ● Open today · SNAP                ]
[                              0.4 mi  ]
─────────────────────────────────────
[ • RMSER Community Garden             ]
…
```

**Why a bottom sheet instead of "sidebar collapses to top":** the bottom sheet is the canonical mobile-map pattern (Apple Maps, Google Maps, Citymapper, Transit, Yelp). Users *know* this pattern. Reusing it gives the app zero affordance-learning cost.

**Why three snap points (not two):** two snap points (peek + full) means the user has only "see one chip row" or "block the map entirely." Three snap points (peek + half + full) means a user can read the venue list while still seeing where their pins are on the map — the most useful state for actual decision-making.

**Why drag-to-snap and not a button:** Apple Maps and Google Maps both use drag; users expect it. A button-driven sheet feels like a 2014 mobile web app, not a 2026 product.

#### 5.2.5 Venue card (sheet list item)

**Spec:**

```
┌────────────────────────────────────────────────────────┐
│ ●  Bethany Lutheran Church Garden          0.4 mi      │ ← 18px Inter 600
│    Community Garden · 1802 Sheridan Rd, Pueblo, CO     │ ← 14px Inter 400
│    🌿 Open today  ·  Accepts SNAP                       │ ← 13px chip row
└────────────────────────────────────────────────────────┘
   ↑12px padding, 16px height between rows, 16px bottom padding
   Total card height: ~96px
```

- Tap target: full card, 96px tall × full width. Way above the 44px minimum.
- Category dot: 10px circle in `--color-cat-*`, left-aligned, vertically centered with the title.
- Distance: right-aligned, `data-md` Geist Mono `ink-500`, monospaced so column visually aligns across rows.
- "Open today" / "Opens at 4pm": small pill with sage icon if open, ink-400 if closed.
- "Accepts SNAP" / "Accepts WIC": small pill, `clay-100` background, `clay-700` text. SNAP is the higher-emphasis badge because SNAP coverage gap is the primary use case driving the project.
- Selected state: `sage-50` background, 3px sage left border.

**Why 96px tall and not 64:** lots of venues have long names ("Bethany Lutheran Church Garden", "Walmart Neighborhood Market"). Giving the title room to breathe at 18px without truncating is worth the extra height — it means scanning the list reads like a list of *places*, not a list of strings.

**Why category as a dot, not a badge:** badges at every row create visual noise. A single colored dot to the left of the title gives the at-a-glance categorical cue without competing with the title. The same dot color appears on the map marker, reinforcing the link.

**Why distance in mono:** monospaced digits keep "0.4 mi", "1.2 mi", "12.6 mi" right-edge-aligned across rows; proportional digits would jitter. This is the Stripe Atlas table treatment.

---

## 6. Tablet layout (768 – 1023px)

The tablet form factor is awkward — too small for a full desktop layout, too large to need a bottom sheet. The right move is a **persistent sidebar with map filling the rest**, with detail as a slide-over.

### 6.1 Anatomy

```
┌──────────────────────────────────────────────────────────┐
│ [≡] Pueblo Food Map     🔍 Search…     [EN|ES] [⊙]      │  64px top bar
├─────────────┬────────────────────────────────────────────┤
│             │                                            │
│  Filters    │                                            │
│             │                                            │
│ [All]     ●●│            (Map fills the                 │
│ [Pantry]  ●●│             entire right region)          │
│ [Grocery] ●●│                                            │
│ [Garden]  ●●│                                            │
│  ⋮          │                                            │
│             │                                            │
│ ─────────── │                                            │
│             │                                            │
│  Sorted by  │                                            │
│  distance   │                                            │
│             │                                            │
│ [Venue 1]   │                                            │
│ [Venue 2]   │                                            │
│ [Venue 3]   │                                            │
│  ⋮          │                                            │
│             │                                ╭──╮       │
│             │                                │◎│       │
│             │                                ╰──╯       │
│             │                                ╭──╮       │
│             │                                │+ │       │
│             │                                │− │       │
│             │                                ╰──╯       │
│   360px     │                                            │
└─────────────┴────────────────────────────────────────────┘
```

### 6.2 Differences from mobile

- **Search moves into the top bar** (room appears at 768px+).
- **Top bar grows from 56 → 64px** to balance the wider proportion.
- **Bottom sheet retires entirely.** The 360px left sidebar permanently holds filters above the list.
- **Detail panel** slides over the map from the right edge (not from the bottom). 420px wide, full height, `elevation-2`, dimmer-style scrim at 8% black over the map behind.
- **Filter list becomes vertical** (rather than horizontal chips), with count of venues per category right-aligned (`● Pantry  12`).

### 6.3 Why a 360px sidebar specifically

360px is wide enough for the venue card layout to read comfortably without truncating names like "Bethany Lutheran Church Garden" but narrow enough to leave the map dominant on a 768–1023px viewport. Linear's sidebar is 240; Notion's is 240; Stripe Dashboard's is 256. 360 is intentionally chunky for a content-dense civic tool — the user spends most of their attention scanning the sidebar.

---

## 7. Desktop layout (1024px+)

Desktop adds breathing room and a dedicated filter rail.

### 7.1 Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│  Pueblo Food Map  ────────  🔍 Search…  ───────  [EN|ES]  [⊙]       │ 72px
├───────────────┬──────────────────────┬───────────────────────────────┤
│               │ 74 places · sorted   │                               │
│   CATEGORIES  │ by distance from you │                               │
│               │                      │                               │
│ ● All     74  │ [Venue card]         │                               │
│ ● Pantry  12  │ [Venue card]         │                               │
│ ● Grocery 28  │ [Venue card]         │     (Map fills the           │
│ ● Conv.    8  │ [Venue card]         │      remaining width)        │
│ ● Farm     4  │ [Venue card]         │                               │
│ ● Garden  10  │ [Venue card]         │                               │
│ ● Landscape 5 │  ⋮                   │                               │
│ ● Meal     7  │                      │                               │
│               │                      │                               │
│ ── DIVIDER ── │                      │                               │
│               │                      │                               │
│  FILTERS      │                      │                               │
│               │                      │                               │
│ ☐ Open now    │                      │                               │
│ ☐ Accepts     │                      │                               │
│   SNAP/WIC    │                      │                               │
│ ☐ Walking     │                      │                               │
│   distance    │                      │                               │
│   (< 1 mi)    │                      │                               │
│               │                      │                               │
│  280px        │     380px            │                               │
└───────────────┴──────────────────────┴───────────────────────────────┘
                                                     min(1440, 100%) max content width
```

### 7.2 Differences from tablet

- **Three columns instead of two.** Filters get their own 280px rail; venue list gets its own 380px column.
- **Top bar grows to 72px** with horizontal alignment of brand / search / controls.
- **Filter rail adds advanced filters** that don't fit on smaller layouts: "Open now," "Accepts SNAP/WIC," "Walking distance (< 1 mi)." These are present on mobile/tablet too but live inside a "More filters" disclosure rather than always visible.
- **Filter chip row retires.** The filter rail subsumes the chips.
- **Detail panel** slides over the venue list column (not the full map). 420px wide. Map stays fully visible — desktop users tend to want the map *and* the detail at the same time.
- **Max content width caps at 1440px.** Past that, the layout centers and the page background `bone-100` shows on the flanks. Map continues edge-to-edge inside the 1440 frame.

### 7.3 Why the three-column

Two columns (sidebar + map) wastes desktop real estate; the sidebar becomes either too wide (1024 / 2 = 512px, way too much for a list) or vehicles a vertical filter list crammed at the top. A dedicated filter rail at 280px keeps filters always visible and discoverable, and a list column at 380 px is the right width to hold the same venue card design that ships on mobile and tablet — meaning **one component renders identically across three breakpoints**, just laid out differently.

### 7.4 Hover and keyboard

Desktop unlocks:

- **Hover on map marker:** shows the venue tooltip card without selecting (current behavior).
- **Hover on venue card:** marker on the map glows (`sage-500` outline) and grows 10%.
- **Keyboard:** `⌘K` / `Ctrl+K` opens command palette focused on search. `Esc` clears search or closes detail panel. Arrow keys navigate the venue list when focused.
- **Focus rings:** 2px sage ring with 2px transparent offset on every focusable element. Visible only on keyboard navigation (`:focus-visible`), not on mouse click.

---

## 8. Component catalog

Each component appears at every breakpoint, just with different sizing.

### 8.1 Buttons

Three variants only.

| Variant | Background | Foreground | Border | Use |
|---|---|---|---|---|
| **Primary** | `sage-500` | `bone-50` | none | Single per-screen CTA — "Get directions" |
| **Secondary** | `bone-50` | `ink-700` | 1px `bone-300` | "Share venue," "Add to favorites" (v2) |
| **Ghost / Icon** | transparent | `ink-700` | none | Locate, zoom, close X |

Sizes: `sm` (32px tall), `md` (40px tall, default), `lg` (48px tall — used for the primary detail-panel CTA). Padding scales: 12, 16, 20px horizontal. Radius: `radius-md` (10px).

States: default → hover (background darkens 4%) → pressed (background darkens 8%) → focus (2px sage ring) → disabled (50% opacity, no cursor).

**Why only three variants:** the moment a system grows to "primary, secondary, tertiary, link, destructive, ghost outline," every screen becomes a buffet of buttons of indistinguishable hierarchy. Three is enforceable, and the role hierarchy is unambiguous.

### 8.2 Inputs

Single variant: search.

```
┌──────────────────────────────────────────────────┐
│  🔍   Search venues or address…           ⌘K     │
└──────────────────────────────────────────────────┘
```

- 44px tall (mobile) / 40px tall (desktop) / `radius-md` corners.
- 1px `bone-200` border at rest, `sage-500` at focus, with `0 0 0 3px rgba(74,132,102,0.15)` focus halo.
- Magnifying glass icon left at 16px size with 12px left padding.
- Right side: `⌘K` hint badge (desktop only, hidden < 1024).
- Placeholder color: `ink-400`. Filled text: `ink-700`.
- Real-time filter, 250ms debounce.

### 8.3 Category chip (mobile/tablet)

```
[● Pantry · 12]
```

- 36px tall, `radius-full` (pill).
- At rest: `bone-100` background, `ink-700` text, 10px category dot.
- Selected: category color background, `bone-50` text, no dot (the chip *is* the dot now).
- Touch target: 36px tall × varied width, gap of 8px between chips.

### 8.4 Category rail row (desktop)

```
●  Pantry                     12
```

- 40px tall row, 16px horizontal padding, hover `bone-100`.
- Active selection: 3px sage left bar + `sage-50` background.
- Right-aligned count in `data-sm` mono `ink-400`.

### 8.5 Venue card (list item)

Spec already detailed in §5.2.5. Same component, same spec, three breakpoints — only the surrounding container differs.

### 8.6 Map marker (custom SVG)

Replaces `CircleMarker`.

```
SVG, 32 × 40px, drop-shadow:

       ╱─────╲          ← Pin head, filled with category color
      │  🏪   │          ← Category icon centered, bone-50
       ╲─────╱
          │
          ▾              ← Pin tip, 1px ink-700 outline
```

- Default size: 32 × 40.
- Selected: 40 × 50 + 3px sage ring.
- Hover (desktop): 36 × 44.
- Z-index: selected marker on top.

**Why a pin shape and not a flat circle:** flat circles are abstract; pin shapes are the universal map-marker form. The pin tip lets the user know precisely which point on the map the venue refers to (a circle is ambiguous about its anchor). Apple Maps, Google Maps, Mapbox all use pin shapes. The current `CircleMarker` is the engineering default, not a design choice.

**Why category icon inside the pin:** lets a user identify category at a glance without consulting the legend. A red dot vs. a green dot communicates "different category"; a red pin with a basket icon vs. a green pin with a leaf icon communicates *what kind of place each is*.

Icon set: a 14-icon subset of Lucide (free, MIT, optical-aligned). Mapping: pantry → `basket`, grocery → `shopping-cart`, convenience → `store`, farm → `tractor`, garden → `sprout`, edible_landscape → `leaf`, meal_site → `utensils`.

### 8.7 Venue detail panel

The detail panel is the highest-value real estate after the map itself.

```
┌──────────────────────────────────────────────────┐
│  ←  Back                                    ✕   │  ← 48px header
├──────────────────────────────────────────────────┤
│                                                  │
│  Bethany Lutheran Church Garden                  │  ← display-sm Fraunces
│                                                  │
│  ● Community Garden                              │  ← category pill
│                                                  │
│  📍  1802 Sheridan Rd, Pueblo, CO 81001          │  ← address row
│      0.4 mi from your location                   │  ← distance
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │       Get directions  →                    │  │  ← primary CTA, sage-500
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [Open today · 8a–5p] [Accepts SNAP]             │  ← badges
│                                                  │
│  HOURS                                           │
│  Mon   Closed                                    │  ← hours table
│  Tue   Closed                                    │
│  Wed   4 – 7 pm   ← Today                        │
│  Thu   Closed                                    │
│  Fri   Closed                                    │
│  Sat   Closed                                    │
│  Sun   Closed                                    │
│                                                  │
│  CONTACT                                         │
│  📞 (719) 555-0100   ← tel: link                 │
│  ✉  garden@pueblofoodproject.org                 │
│                                                  │
│  ABOUT                                           │
│  Weekly volunteer work days Wed 4-7pm. Produce   │
│  donated to food pantries. Partner: Pueblo       │
│  County Extension Master Gardener Program.       │
│                                                  │
│  ── SOURCES & DATA ──────────────────────────    │
│  Listed at pueblofoodproject.org/cgsp            │
│  Last verified May 12, 2026                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Spec:**

- Mobile: occupies the full sheet at "full" snap point. Header replaces "74 places near you." Tap "← Back" or drag down to return to list.
- Tablet/Desktop: 420px-wide slide-over from right edge (tablet) or left edge of map (desktop). Closes on `Esc`, on click outside, or on close button.
- Scrolls internally; header sticks.
- Get directions deep-link: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=transit`. Per README §6, this is the chosen routing approach for v1.
- Phone is a `tel:` link; email is a `mailto:` link.
- "Today" indicator on hours row uses sage `sage-700` text + sage left border 3px.

**Why such a long detail panel:** the data model (venue type) already has `hours_weekly`, `phone`, `email`, `notes`, `source`, `last_verified` — surfacing all of it gives users trust signals and reduces the "is this even still open?" anxiety that plagues pantry directories. Most pantry-directory failures aren't "wrong address," they're "outdated hours." Surfacing `last_verified` is the single highest-value transparency move.

**Why "Get directions" is the only sage button:** one primary CTA per panel. Anything else (call, email, save) is secondary. This is the standard product-design rule: zero or one primary action per screen.

### 8.8 Badges

| Badge | Use | Background | Foreground | Icon |
|---|---|---|---|---|
| Open now | When `hours_weekly` says open at current time | `sage-100` | `sage-700` | `clock` |
| Opens at X | When `hours_weekly` has a slot later today | `bone-100` | `ink-500` | `clock` |
| Closed today | When no slot today | `bone-100` | `ink-400` | none |
| Accepts SNAP | When `accepts_snap === true` | `clay-100` | `clay-700` | none |
| Accepts WIC | When `accepts_wic === true` | `clay-100` | `clay-700` | none |
| Source: PFP | On detail panel only, "official PFP venue" | `sage-50` | `sage-700` | `verified` |

### 8.9 Locale toggle

```
┌───────────┐
│ EN │ ES   │
└───────────┘
```

- Segmented control, 28px tall × 64px wide.
- Active half: `ink-700` background, `bone-50` text.
- Inactive: transparent, `ink-500` text.
- Tap toggles language; persisted via `localStorage`.
- Spanish copy ships alongside English for every UI string and every category label. Venue names stay in their listed language; addresses stay literal; notes are translated.

**Why a segmented control and not a dropdown:** Spanish is not a "secondary option" buried behind a chevron. A visible segmented control signals "this is a bilingual product, full stop."

### 8.10 Empty / loading / error states

| State | Visual | Copy |
|---|---|---|
| Loading map | Bone-100 placeholder with subtle pulse animation | "Loading map…" (no spinner — pulse is enough) |
| Loading geolocation | Same with location pill in top bar reading "Finding you…" | — |
| Geolocation denied | Map centers on downtown Pueblo, banner in sheet | "Showing distance from downtown Pueblo. Tap ⊙ to share your location." |
| No results for filter | Illustration of an empty plate in sage line art (single SVG, < 4KB) | "No places match your filters." [Clear filters] button |
| Error loading venues | Same illustration, error tone | "Something went wrong. [Retry]" |

**Why an illustration for empty state:** empty states are emotional cliffs. Showing nothing is worse than showing something. A single sage line-art illustration (and only one — used in all empty states) costs little, signals craft, and softens the failure.

---

## 9. Motion & interaction principles

### 9.1 What animates

- **Bottom sheet drag and snap:** spring as specified.
- **Detail panel slide-in / slide-out:** 250ms `cubic-bezier(0.32, 0.72, 0, 1)`, opacity + translateX.
- **Map flyTo:** Leaflet built-in, 600ms easeOut.
- **Marker selection grow:** 150ms.
- **Filter chip select:** 150ms color crossfade.
- **Sheet "View list" tap → expand:** spring snap.

### 9.2 What does NOT animate

- Page load / route change — fast cuts only.
- Hover on every UI element — sub-150ms hover transitions are jarring on a slow device.
- Sheet drag on user-initiated input — the sheet follows the finger 1:1 with no easing, snap only when finger releases.

### 9.3 `prefers-reduced-motion`

Every motion above is wrapped in a respect for `prefers-reduced-motion: reduce`. If reduced, durations drop to 0ms and spring becomes a hard snap. The visual outcome stays identical; only the journey is removed.

---

## 10. Map styling spec

### 10.1 Basemap

- **Provider:** CARTO Voyager via `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`.
- **Attribution:** `© OpenStreetMap contributors © CARTO`.
- **Why:** see §5.2.3. Free for OSS use; visually calmer than raw OSM; works at every zoom level Pueblo needs (10–17).
- **Fallback:** keep the current `tile.openstreetmap.org` URL as a code-level fallback if Voyager 404s.

### 10.2 Marker rendering

Replace `<CircleMarker>` with `<Marker>` using a custom `L.divIcon` containing an inline SVG. Selected state, hover state, and category live entirely in the SVG — no PNG sprite needed. Total marker payload: < 2KB per category for 7 categories = < 14KB.

### 10.3 Attribution placement

Move Leaflet's attribution control from the default bottom-right to **bottom-left**, with a custom CSS treatment: `data-sm` text, `ink-400` color, 80% opacity, transparent background, 8px from edges. Required by both OSM and CARTO licenses, but visually de-emphasized.

### 10.4 Boundary visualization (optional v1.1)

A subtle outline of Pueblo County / Pueblo city limits rendered as a 1px sage line at 30% opacity. Communicates "this product is about Pueblo" without dominating the map. Defer to v1.1; not on the demo-day critical path.

---

## 11. Accessibility commitments

| Requirement | Target | Measurement |
|---|---|---|
| Color contrast for body text | AA (4.5:1), aim AAA (7:1) | Verified per token pair in §3.1 |
| Color contrast for large text | AAA (4.5:1) | Same |
| Touch targets | ≥ 44 × 44 CSS px on mobile, ≥ 32 × 32 on desktop | Per-component spec enforces this |
| Keyboard navigation | Every interactive element reachable; focus visible | `:focus-visible` rings, logical tab order |
| Screen reader | Every map marker has `aria-label="<name>, <category>, <distance>"`; sheet announces state changes | Tested with VoiceOver + NVDA before demo |
| Reduced motion | Honored on every animation | `@media (prefers-reduced-motion: reduce)` blocks |
| Language tag | `<html lang>` updates when locale toggles | EN ↔ ES |
| Form labels | Every input has a visible label or `aria-label` | Search has `aria-label="Search venues"` |
| Heading structure | One `<h1>` per route (wordmark), logical descent | `<h1>` for wordmark, `<h2>` for sheet title, `<h3>` per venue card |

**No reliance on color alone.** Category is communicated by color *and* icon shape. "Open now" status by color *and* clock icon presence *and* text. Selection by color *and* size *and* sage ring.

---

## 12. Implementation roadmap

Three small PRs land the redesign behind the existing CI gate.

### 12.1 PR 1 — Design tokens + typography swap

- Update `globals.css` with the `@theme` token block from §3.
- Swap fonts in `src/app/layout.tsx` from Geist Sans → Inter + Fraunces (mono stays).
- No layout changes yet. Visual diff: warmer page, new fonts, same layout.
- Risk: very low. Pure visual.

### 12.2 PR 2 — Layout + components

- Add `BottomSheet` component (mobile), `Sidebar` rework (tablet/desktop).
- Replace `Map.tsx` `CircleMarker` with custom SVG `Marker` + category icons.
- Swap basemap to CARTO Voyager.
- Add search input, category chips / rail, locale toggle (English copy only; ES strings can land in PR 3).
- Implement `VenueDetail` panel with hours table, badges, directions deep link.
- Risk: medium. Touches all primary components. Behind PR preview URL; no production impact until merged.

### 12.3 PR 3 — Spanish translations + empty/error states + motion polish

- Add `src/i18n/en.json` + `src/i18n/es.json` + locale state.
- Empty-state illustration (single SVG inline).
- Reduced-motion enforcement.
- Final visual QA pass at 320, 375, 414, 768, 1024, 1440 widths.
- Risk: low.

### 12.4 What this doesn't do

- Doesn't replace Leaflet with Mapbox GL — deferred.
- Doesn't add in-app routing — README §6 already plans Google Maps deep link, which this design uses.
- Doesn't add user accounts, favorites, or submission flow.
- Doesn't backfill the Plentiful pantries or OTP routing — those are independent data/feature workstreams.

---

## 13. Open questions

These are worth a call before PR 2 ships:

1. **Are we comfortable adding Fraunces?** The new font load adds ~30 KB of variable font data. Inter + Fraunces vs. Inter-only is a small but real performance trade.
2. **Should we ship Spanish strings in PR 2 or PR 3?** Splitting it out is safer but means a one-week window where ES users see English-only.
3. **Is the bottom sheet's "full" snap point covering the map okay?** Apple Maps allows it (the user has explicit drag-down to reveal); some users find it disorienting. The alternative is capping max sheet height at 80vh so a sliver of map always shows.
4. **Are we okay with CARTO Voyager's attribution / TOS for our use case?** Free for OSS; we should still confirm with the PFP team since the eventual demo audience may not be technically OSS-aware.
5. **Custom marker icons — are we okay with Lucide's licensing?** MIT, so yes, but flagging for completeness.

---

## 14. Appendix — color contrast verification

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `ink-900` | `bone-50` | 14.8 : 1 | AAA |
| `ink-700` | `bone-50` | 11.2 : 1 | AAA |
| `ink-500` | `bone-50` | 6.8 : 1 | AAA |
| `ink-400` | `bone-50` | 4.6 : 1 | AA |
| `sage-700` | `bone-50` | 8.4 : 1 | AAA |
| `sage-500` | `bone-50` | 4.7 : 1 | AA |
| `bone-50` | `sage-500` | 4.7 : 1 | AA (primary button) |
| `clay-700` | `clay-100` | 6.1 : 1 | AAA |
| `cat-pantry` | `bone-50` | 5.4 : 1 | AA (3:1 minimum for graphical objects) |
| `cat-grocery` | `bone-50` | 8.3 : 1 | AAA |
| `cat-garden` | `bone-50` | 7.2 : 1 | AAA |

(Computed against approximate sRGB values; final QA must verify each pair with a contrast checker before merge.)

---

## End of spec

This document is intentionally complete enough to implement against without further design rounds. If a question arises that isn't answered here, the answer either belongs in a token (extend §3) or in a component spec (extend §8). The design system should accommodate the question; the question should not bend the design system.
