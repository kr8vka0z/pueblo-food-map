---
name: Pueblo Food Map
description: >-
  Community-built interactive map of food resources in Pueblo County, Colorado —
  pantries, grocery stores, community gardens, farms, and meal sites — with
  walking and transit directions. Flavor: Civic Editorial (Editorial #7 display
  + Civic govtech body/contrast/color rules).

colors:
  primary: "#2C5F4F"
  white: "#FFFFFF"
  navy: "#190F3F"
  orange: "#F7943C"
  yellow: "#FFD166"
  bone50: "#FBFAF6"
  bone100: "#F4F1EA"
  bone200: "#E8E3D6"
  bone300: "#D4CDB8"
  ink400: "#8A847A"
  ink500: "#5F5A52"
  ink700: "#2D2A26"
  ink900: "#1A1817"
  sage50: "#EAF0EC"
  sage100: "#D1DDD3"
  sage500: "#4A8466"
  sage600: "#2C5F4F"
  sage700: "#1F4639"
  clay100: "#F8E2D4"
  clay500: "#C2410C"
  clay700: "#7C2D12"
  success: "#15803D"
  warning: "#B45309"
  danger: "#B91C1C"
  catPantry: "#BE2D45"
  catGrocery: "#1F4E8C"
  catConvenience: "#0F6573"
  catFarm: "#92591D"
  catGarden: "#2C5F4F"
  catLandscape: "#58772B"
  catMeal: "#6B3FA0"

typography:
  fontDisplay: "'Fraunces', Georgia, serif"
  fontSans: "'Public Sans', system-ui, -apple-system, sans-serif"
  fontMono: "ui-monospace, monospace"
  sizeXs: "11px"
  sizeSm: "12px"
  sizeBase: "14px"
  sizeMd: "16px"
  sizeLg: "18px"
  sizeXl: "20px"
  size2xl: "24px"
  size3xl: "30px"
  size4xl: "36px"

spacing:
  sp1: "4px"
  sp2: "8px"
  sp3: "12px"
  sp4: "16px"
  sp5: "24px"
  sp6: "32px"
  sp8: "48px"
  sp10: "64px"

rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  full: "9999px"

components:
  buttonPrimary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
  tooltipChip:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.sm}"
  categoryBadge:
    textColor: "{colors.bone50}"
    rounded: "{rounded.full}"
  snapWicPill:
    backgroundColor: "{colors.sage100}"
    textColor: "{colors.sage700}"
    rounded: "{rounded.sm}"
  searchBar:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.full}"
  categoryChip:
    backgroundColor: "{colors.bone100}"
    textColor: "{colors.ink700}"
    rounded: "{rounded.full}"
  filterChip:
    backgroundColor: "{colors.sage100}"
    textColor: "{colors.sage700}"
    rounded: "{rounded.full}"
  bottomSheet:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.xl}"
  desktopVenueWindow:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.lg}"
  wordmarkMapButton:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.xl}"
  plentifulLink:
    backgroundColor: "{colors.sage50}"
    textColor: "{colors.sage600}"
    rounded: "{rounded.md}"
  operatorLink:
    textColor: "{colors.sage600}"
  venueTitle:
    textColor: "{colors.ink900}"
    typography: "{typography.fontDisplay}"
  bodySecondary:
    textColor: "{colors.ink500}"
  sectionLabel:
    textColor: "{colors.ink400}"
  badgeYellow:
    backgroundColor: "{colors.yellow}"
  venueMarkerPantry:
    backgroundColor: "{colors.catPantry}"
  venueMarkerGrocery:
    backgroundColor: "{colors.catGrocery}"
  venueMarkerConvenience:
    backgroundColor: "{colors.catConvenience}"
  venueMarkerFarm:
    backgroundColor: "{colors.catFarm}"
  venueMarkerGarden:
    backgroundColor: "{colors.catGarden}"
  venueMarkerLandscape:
    backgroundColor: "{colors.catLandscape}"
  venueMarkerMeal:
    backgroundColor: "{colors.catMeal}"
  focusRing:
    backgroundColor: "{colors.sage500}"
  hoverSurface:
    backgroundColor: "{colors.bone200}"
  inputBorderRest:
    backgroundColor: "{colors.bone300}"

motion:
  easingDefault: "cubic-bezier(0.32, 0.72, 0, 1)"
  durationFast: "150ms"
  durationDefault: "250ms"
  durationSlow: "400ms"

elevation:
  level1: "0 1px 2px rgba(26,24,23,0.04), 0 0 0 1px rgba(26,24,23,0.05)"
  level2: "0 4px 12px rgba(26,24,23,0.06), 0 0 0 1px rgba(26,24,23,0.06)"
---

## Overview

Pueblo Food Map is a civic field guide for finding food in Pueblo County, CO. The visual identity is "Civic Editorial" — a deliberate hybrid of an Editorial display serif (Fraunces, variable) with Civic / govtech body posture (Public Sans, WCAG AAA body contrast, warm neutrals). Think of a well-typeset community bulletin printed on cream paper: readable at a glance, trustworthy, not slick.

The live Mapbox map is the product. Every other surface is chrome that helps people find food and get out. Design decisions flow from that premise: minimal persistent chrome (search bar + one pill button), no sidebar, no decorative imagery, and a category color system that makes a pantry pin instantly distinguishable from a garden pin at arm's length.

A pre-existing design sidecar (`docs/pueblo-food-map-v2-handoff.md`) documents per-screen navigation wires, state variants, accessibility posture, and the Penpot prototype link. This DESIGN.md consolidates the visual token layer and aesthetic constraints for ongoing builds. Where they overlap, the sidecar is authoritative on behavior; this file is authoritative on tokens and identity.

## Colors

**Bone is the paper.** The entire app sits on `bone-50` (#FBFAF6), a warm cream with a faint yellow tint. The bone scale steps up through `bone-100` (chip resting state, hover fills), `bone-200` (card borders, subtle dividers), and `bone-300` (search bar border at rest). These are not grays — they are warm. Never introduce a neutral or cool gray.

**Ink is the ink.** Text runs warm charcoal: `ink-700` (#2D2A26) for all body text and headings — this combination on `bone-50` achieves WCAG AAA (7:1). `ink-500` (#5F5A52) for secondary metadata (distance, hours). `ink-400` (#8A847A) for placeholder text, icon fills, and section headers (rendered 10–11px uppercase, tracked wider). `ink-900` (#1A1817) for venue name headings in detail cards.

**Sage is the primary interactive color.** Every link, focus ring, active filter chip, selected marker ring, and interactive affordance uses sage — NOT blue. `sage-600` (#2C5F4F) is the primary color, used for the "Show details" toggle text, operator links on hover, and the Plentiful CTA hover state. `sage-500` (#4A8466) is the focus ring and selected marker ring color. `sage-100` + `sage-700` form the SNAP/WIC benefit badge pairing (calm, not urgent).

**Orange and navy are the brand colors** from Pueblo Food Project (`pueblofoodproject.org`). Orange (#F7943C) appears on exactly two things: the splash CTA buttons and the LocateButton pill. Navy (#190F3F) is the wordmark color and the text rendered on orange-background controls. These are the loudest, most declarative elements. Do not apply them to secondary actions, metadata, or hover states.

**Yellow (#FFD166)** is for support/classification badges only. It does not appear as a button, interactive state, or background fill.

**Category colors** are a 7-color data palette for map pins. Each maintains drop-shadow contrast against the Mapbox Streets basemap at day rendering:
- Pantry: deep crimson `#BE2D45`
- Grocery: dark cobalt `#1F4E8C` — the only blue in the entire palette
- Convenience: teal `#0F6573`
- Farm: amber-brown `#92591D`
- Garden: `#2C5F4F` — same hex as `sage-600` and `primary` (intentional: the garden category maps to the brand's calming green)
- Edible landscape: olive `#58772B`
- Meal site: plum `#6B3FA0`

## Typography

Two fonts with clearly delineated roles, both self-hosted as variable woff2 files — no Google Fonts CDN at runtime.

**Fraunces** (variable, weights 300–900) is the display serif. Reach for it exactly twice: the wordmark, and venue name headings inside the detail panels (BottomSheet `h2`, DesktopVenueWindow `h2`). It is NOT preloaded on the critical path — it loads via `font-display: swap` to avoid competing with Public Sans for LCP bandwidth. Do not use it for body copy, badges, buttons, labels, form inputs, or any text below the wordmark and venue name contexts.

**Public Sans** (variable, weights 100–900) carries everything else: all body text, button labels, badge text, placeholder copy, section headers, hours, distance readouts, microcopy. It is humanist and legible at small sizes. Four stylistic alternates are active globally via `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` — these produce cleaner numeral and letterform rendering without any visible style change for most readers.

`ui-monospace` appears only in distance readouts where coordinates fall back to raw lat/lng — a single context where fixed-width numerals prevent layout jitter.

The wordmark uses the `.wordmark` CSS utility class: Fraunces + 0.04em letter-spacing. In splash display mode it scales from `text-4xl` (375px mobile) to `text-6xl` (768px+ desktop). In map-reset button mode it drops to `text-sm / text-base` inside a frosted white pill.

Section headers in detail cards (hours, contact, about) are 10–11px uppercase with wider tracking, in `ink-400` — a govtech convention that organizes dense data without adding visual weight.

## Layout & Spacing

The spacing scale is a 4px base grid: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. Most inter-element gaps and component padding land on 16px or 24px.

The Mapbox canvas fills the entire viewport — there is no persistent sidebar or navigation rail. Persistent chrome at default state:
- Search bar: floating pill, full-width minus 16px margins mobile / 520px centered desktop, 44px tall mobile / 52px desktop
- LocateButton: context-sensitive pill, center-bottom desktop / center-top mobile, hidden when user dot is on-screen
- Wordmark: frosted pill, top-left, 44px minimum tap target
- Category chips: scrollable single row below the search bar

Together these occupy less than 10% of the 1440×900 desktop viewport at default state. When a venue is selected, the BottomSheet (mobile) or DesktopVenueWindow (desktop) appears — still leaving the bulk of the map exposed.

Body: `background: bone-50`, `color: ink-700`, `font: Public Sans`. No max-width container on the root — the map bleeds to all edges. Content pages (suggest, report, privacy) use standard centered column widths.

## Elevation

Two shadow levels, both using warm ink-tinted rgba (not black):

- `elevation-1` — subtle inner-border glow: `0 1px 2px rgba(26,24,23,0.04), 0 0 0 1px rgba(26,24,23,0.05)`. Used on the SearchBar. The 1px ring gives the floating pill definition against the bone background without a hard border.
- `elevation-2` — raised card: `0 4px 12px rgba(26,24,23,0.06), 0 0 0 1px rgba(26,24,23,0.06)`. Used on the BottomSheet and LocateButton pill.

Map markers use CSS `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25))` — not `box-shadow`. A filter drop-shadow follows the alpha shape of the Lucide MapPin SVG, not its bounding box, so the shadow traces the pin silhouette correctly.

The DesktopVenueWindow uses a heavier hand-written shadow `0 8px 32px rgba(0,0,0,0.18)` — enough to lift a 360–420px floating panel clearly off the map surface.

## Motion

Easing: `--ease-out-circ` (`cubic-bezier(0.32, 0.72, 0, 1)`) is registered in `@theme` for spec compliance. Most transitions use standard `ease` at `duration-150ms` (color / filter changes on button hover/active).

Three deliberate animations in the product:

1. **`pfm-pulse`** (2s, ease-in-out, infinite) — the user-location dot breathes gently: scale 1 → 1.2, opacity 1 → 0.7. Communicates "live GPS" without demanding attention.
2. **`locateButtonIn`** (200ms, ease-out) — the LocateButton slides up 8px from below on entry. A subtle arrival cue; not decorative.
3. **Vaul drawer drag** — the BottomSheet uses vaul's native momentum physics for drag-to-dismiss. No custom easing needed.

All animations collapse to `0.01ms !important` via the global `prefers-reduced-motion: reduce` block. No per-component reduced-motion guards are needed — the cascade handles it. `motion-safe:animate-[locateButtonIn_200ms_ease-out]` is the one explicit usage in code.

## Map Chrome

Mapbox GL attribution: rendered transparent (`background: transparent`, `box-shadow: none`, `opacity: 0.8`, `color: ink-400`). It reads as a quiet legal notice, not a product badge.

Hover tooltip (`.pfm-tooltip`): default Mapbox popup chrome is completely stripped. A minimal sage-bordered chip: `bone-50` background, 1px `sage-500` border, `radius-sm`, `px-2 py-1`, no arrow tip (`mapboxgl-popup-tip { display: none }`), `pointer-events: none`. Name line: 12px / font-weight-600 / ink-700. Category line: 11px / ink-500.

User-location dot: the custom `.pfm-user-dot` pulsing element replaces the Mapbox default blue dot entirely.

Splash scrim: a frosted translucent overlay — `rgba(182, 172, 139, 0.25)` (bone-tinted mid-tone at 25% opacity) + `backdrop-filter: blur(4px)`. The live map shows through faintly behind the splash text. Two text-shadow classes add legibility without obscuring the translucency: `.splash-text-outline` (1px 8-direction white shadow for wordmark + purpose text) and `.splash-text-outline-sm` (0.5px 4-direction shadow for smaller microcopy).

## Components

**ButtonPrimary** (splash CTA + LocateButton pill): `orange` bg, `navy` text, `radius-md`, `px-6 py-4` mobile / `px-6 py-5` desktop. Hover: `brightness-105`. Active: `brightness-95`. Focus: 2px orange offset outline. Use for exactly one primary action per screen context.

**TooltipChip** (marker hover popup): `bone-50` bg, 1px `sage-500` border, `radius-sm`, `px-2 py-1`, `pointer-events: none`, no popup arrow.

**CategoryBadge** (venue detail card header): category accent color background, `bone-50` text, `rounded-full`, `px-2.5 py-1 text-sm font-medium`. A 2px `white/40` dot precedes the label.

**SnapWicPill** (benefit indicator): `sage-100` bg, `sage-700` text, `rounded` (sm radius), `px-2 py-0.5 text-xs font-medium`. Calm, not urgent — sage reads "civic info," not "alert."

**SearchBar**: `bone-50` bg, `bone-300` border at rest, `rounded-full` (pill), `elevation-1`. On focus: border → `sage-500`, ring → `rgba(74,132,102,0.15)`. Lucide `Search` icon at `ink-400` (16px mobile / 18px desktop), left-inset. When a category filter is active, a `filterChip` (sage-100/sage-700/full radius) appears inside the bar left of the placeholder.

**CategoryChip** (filter chip row): `bone-100` bg / `ink-700` text when unselected, with a 10px colored dot at left. Category accent bg / `bone-50` text when selected (dot hidden). `rounded-full`, `h-9 px-3 text-sm`. Scrollable row with `no-scrollbar` utility and a right-edge bone-50 fade mask.

**BottomSheet** (mobile venue detail): vaul `Drawer.Content`, `bone-50` bg, `rounded-t-xl` (top corners only — bottom clips to viewport), `elevation-2`, `max-height: calc(100dvh - 100px)`. No drag handle — vaul provides swipe-to-dismiss. Venue name heading uses `font-display` (Fraunces). Two states toggled by a single "Show details / Hide details" button (`sage-600` text, `chevron` icon).

**DesktopVenueWindow** (desktop venue detail): floating panel anchored to the selected marker. 360px × auto collapsed / 420px × 720px expanded. `bone-50` bg, `bone-200` border, `radius-lg`, heavy shadow `0 8px 32px rgba(0,0,0,0.18)`. Animates `width/height` at `duration-150`. Edge-flip prevents viewport clipping (hand-rolled, no @floating-ui dependency).

**VenueMarker**: Lucide `MapPin` SVG filled with category accent color, `stroke: #FFFFFF`, `strokeWidth: 1.5`, `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25))`. Default 28px / selected 36px. Selected state: an outer SVG `circle` with `sage-500` stroke (4px, no fill) wrapping the pin. Hover: `scale(1.15)` inline transform.

**Wordmark (map-reset button mode)**: `bg-white/90 backdrop-blur-sm`, `radius-xl`, `px-3 py-2`, `min-h-[44px] min-w-[44px]`, `text-sm md:text-base`, absolute top-left of the map canvas at `z-index: 1000`. Focus ring: `sage-500`, 2px offset. Text: Fraunces + 0.04em tracking via `.wordmark` utility.

## Do's and Don'ts

**Do:**
- Use `bone-50` as the base background everywhere — the app has one paper color and it is warm cream.
- Use sage for every interactive affordance: focus rings, selected marker ring, "Show details" link, active filter chip, hover on links inside detail cards.
- Use Fraunces sparingly for the wordmark and venue name `h2` headings only. These are the display moments.
- Use Public Sans for all body text, buttons, badges, labels, placeholder copy, and section headers.
- Preload only Public Sans (`/fonts/PublicSans-Variable.woff2`). Fraunces loads non-blocking via `font-display: swap`.
- Target WCAG AAA (7:1) for body text. `ink-700` on `bone-50` is the floor; do not go lighter.
- Use `filter: drop-shadow(...)` on SVG map pins — not `box-shadow`.
- Respect `prefers-reduced-motion`. The global `@media (prefers-reduced-motion: reduce)` block collapses all animation to `0.01ms !important`; no per-component guard is needed.
- Keep persistent map chrome under 10% of the viewport area. The map is the product.

**Don't:**
- Don't introduce cool or neutral grays anywhere. Bone and ink are warm-tinted; a neutral gray creates a visible temperature mismatch.
- Don't use `catGrocery` (`#1F4E8C`) for links, buttons, or any interactive state. It is a data color reserved for the grocery category pin only — the only blue in the system.
- Don't use orange for secondary actions, badges, hover states, or metadata. Orange is reserved for the splash CTAs and the LocateButton pill.
- Don't use yellow (`#FFD166`) for anything other than support/classification badges.
- Don't use Fraunces for body text, button labels, form inputs, or any running text at 16px or smaller. Its variable weight range is seductive, but it is a display serif built for headlines.
- Don't add a sidebar. The v1 360px categories rail + 280px detail panel were removed in v2. A sidebar competes with the map for viewport space and violates the chrome budget.
- Don't use unmodified Tailwind palette tokens (`gray-500`, `blue-50`, `blue-500`, etc.). Every color in this system is a custom token that overrides the Tailwind defaults.
- Don't add decorative imagery. The v2 design handoff budget is ~5 KB for all images (favicon + inline SVG pins). No hero images, no stock photos, no illustrations.
- Don't add a dark mode. `color-scheme: light` is explicit in `:root`. The bone palette has no dark-mode counterpart.
- Don't use the `clay` palette in new UI. Clay (warm accent, `#C2410C`) is defined but does not appear in current component usage — it is held in reserve for future error/destructive states where `danger` is too harsh.
