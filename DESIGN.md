---
name: Pueblo Food Map
description: >-
  Design system for Pueblo Food Map, a free, community-built map of food
  resources in Pueblo County, Colorado: pantries, grocery stores, community
  gardens, farms, meal sites, blessing boxes and food events, with walking and
  transit directions. The feel is Civic Editorial. This file mirrors the theme
  in src/app/globals.css; see "What this file is".

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
  ink400: "#6A645A"
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
  catBlessing: "#C2447B"
  eventPin: "#F7943C"
  eventOutline: "#190F3F"

typography:
  wordmark:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: 0.04em
  wordmarkLarge:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 60px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.04em
  titlePage:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 30px
    fontWeight: 400
    lineHeight: 36px
  titleForm:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 24px
    fontWeight: 400
    lineHeight: 32px
  titleCard:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.25
  titleSmall:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.375
  bodyInput:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  body:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  labelCategory:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  small:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  navLabel:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 14px
  sectionLabel:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.05em
  micro:
    fontFamily: "'Public Sans', system-ui, -apple-system, sans-serif"
    fontSize: 10px
    fontWeight: 600
    lineHeight: 14px
  mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px

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
  page:
    backgroundColor: "{colors.bone50}"
    textColor: "{colors.ink700}"
    typography: "{typography.body}"
  wordmark:
    textColor: "{colors.navy}"
    typography: "{typography.wordmark}"
  pageTitle:
    textColor: "{colors.ink900}"
    typography: "{typography.titlePage}"
  placeName:
    textColor: "{colors.ink900}"
    typography: "{typography.titleCard}"
  categoryLabel:
    textColor: "{colors.catPantry}"
    typography: "{typography.labelCategory}"
  benefitWords:
    textColor: "{colors.sage700}"
  sectionLabel:
    textColor: "{colors.ink400}"
    typography: "{typography.sectionLabel}"
  bodySecondary:
    textColor: "{colors.ink500}"
  divider:
    backgroundColor: "{colors.bone200}"
  bottomBar:
    backgroundColor: "{colors.bone50}"
    textColor: "{colors.ink500}"
    rounded: "{rounded.full}"
    height: 64px
  bottomBarOpen:
    textColor: "{colors.navy}"
  bottomBarBoxesOn:
    textColor: "{colors.catBlessing}"
  hoverFill:
    backgroundColor: "{colors.sage100}"
  focusRing:
    backgroundColor: "{colors.sage500}"
  searchBar:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.full}"
    height: 48px
  fieldEdgeRest:
    backgroundColor: "{colors.bone300}"
  categoryChip:
    backgroundColor: "{colors.bone100}"
    textColor: "{colors.ink700}"
    rounded: "{rounded.full}"
    height: 48px
  buttonOrange:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
  buttonPrimary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bone50}"
    rounded: "{rounded.md}"
    height: 48px
  buttonPrimaryHover:
    backgroundColor: "{colors.sage700}"
    textColor: "{colors.bone50}"
  buttonOutline:
    backgroundColor: "{colors.bone50}"
    textColor: "{colors.ink700}"
    rounded: "{rounded.md}"
    height: 48px
  switchOn:
    backgroundColor: "{colors.sage600}"
  tooltipChip:
    backgroundColor: "{colors.bone50}"
    textColor: "{colors.ink700}"
    rounded: "{rounded.sm}"
  snapWicBadge:
    backgroundColor: "{colors.sage100}"
    textColor: "{colors.sage700}"
    rounded: "{rounded.sm}"
  goodNewsTag:
    backgroundColor: "{colors.sage50}"
    textColor: "{colors.sage700}"
  phoneSheet:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.xl}"
  sidePanel:
    backgroundColor: "{colors.bone50}"
    rounded: "{rounded.lg}"
    width: 380px
  adminCard:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
  supportBadge:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink700}"
  clayNotice:
    backgroundColor: "{colors.clay100}"
    textColor: "{colors.clay700}"
  savedStar:
    textColor: "{colors.clay500}"
  statusStocked:
    textColor: "{colors.success}"
  statusLow:
    textColor: "{colors.warning}"
  errorText:
    textColor: "{colors.danger}"
  eventPinMarker:
    backgroundColor: "{colors.eventPin}"
    textColor: "{colors.eventOutline}"
  eventStrip:
    backgroundColor: "{colors.eventOutline}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: 48px
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
  venueMarkerBlessingBox:
    backgroundColor: "{colors.catBlessing}"

elevation:
  level1: "0 1px 2px rgba(26,24,23,0.04), 0 0 0 1px rgba(26,24,23,0.05)"
  level2: "0 4px 12px rgba(26,24,23,0.06), 0 0 0 1px rgba(26,24,23,0.06)"
---

# Pueblo Food Map: DESIGN.md

## What this file is

This file **mirrors** the theme. It is not the source of it.

- **Source of truth:** the Tailwind v4 `@theme` block in `src/app/globals.css`. If this file and `globals.css` disagree, `globals.css` wins: fix this file. A new token goes into `@theme` first, then into this file's frontmatter.
- **The drift check:** `npm run design:drift` (`scripts/check-design-drift.mjs`) compares every `--color-*`, `--spacing-*` and `--radius-*` value in `@theme` with the `colors`, `spacing` and `rounded` lists above, and fails on a mismatch. It also fails when code under `src/` names a `var(--color-...)` that `@theme` does not define. It does not check `typography`, `components` or `elevation` above: the type sizes are Tailwind's own (there is no type scale in `@theme`), copied here from what the code uses, so keep them in step by hand.
- **The format check:** `npm run design:lint` runs `designmd lint` on this file (Google's DESIGN.md format, alpha).
- **Where the parts live in code:** the public site's components are in `src/components/`, one file each (no shared `ui/` folder yet). Shared class strings live in `src/lib/interactionStyles.ts`, `src/lib/adminCardStyles.ts`, `src/components/formClasses.ts` and `src/components/PublicForm.tsx`. The admin has one home for its class strings, `src/lib/adminCardStyles.ts` (titles, page bodies, cards, tables, buttons, links, tags, chips, failure and empty states), one for its fields, `src/components/formClasses.ts`, and three shared components: `src/components/AdminConfirm.tsx`, `src/components/AdminRowMenu.tsx` and `src/components/AdminSegmented.tsx` (#926). Pages import these instead of typing their own (a few one-off strings remain, such as fieldset legends and the error page's spacing); `src/__tests__/touchTargets.test.tsx` guards the 48-pixel floor and the hover rules in them. Each component entry below names its file.
- **The approved design pages:** Brand, Foundations, Components (three pages: map and cards, pages and forms, admin), Icons and Patterns. Their source is in this repo at `docs/design/design-system/` (`pages/*.ts`). Build them with `cd docs/design/design-system && MOCK_DIST=<a folder whose path contains /scratch/> bun build.ts` (see that folder's `README.md`). This file is written from those pages, which the owner reviewed. Anything the owner did not object to is approved.
- **Status words:** `Live as is` means the code matches the entry. `Live, changing in the redesign` means the entry is live but the owner approved changes that are not in the code yet; each change is written as **Approved, not built** with exactly what changes. A change gets its code file and drops the tag the day it ships.

Read this file before touching anything visual. Update it in the same change as the component, never later.

## Overview

**The feel: Civic Editorial.** Think of a well-typeset community bulletin printed on cream paper: readable at a glance, trustworthy, not slick. The mix is an editorial display serif for headlines (Fraunces) over the plain, high-contrast body type of a public-service site (Public Sans), on warm neutrals. It is never a glossy app with cool greys, a dark mode or decorative pictures.

**Who it's for:**

- **Neighbors looking for food.** People facing food insecurity in Pueblo County, often on an older Android phone, on slow or metered data, using one hand, in English or Spanish. They want the nearest place that's open, and how to get there.
- **Neighbors who help.** People who suggest a place, fill or check a blessing box, share a food event, or report something wrong.
- **Partners and food-bank staff.** On the admin: keeping places, boxes and events right, and reviewing what the public and the weekly data check send in.

**The concrete reference:** a community bulletin on cream paper. Headlines in Fraunces, everything else in Public Sans, the paper is bone 50 (`#FBFAF6`), the words are warm inks. The map is the picture: category colors on the pins do the work photos would do on another site.

**Two looks, one family:** the public site is the map filling the screen, a search bar on top and the bottom bar under the thumb; everything else is a card or one column of text. The admin uses the same paper, fonts and greens with denser lists and forms.

**Settled brand decisions** (live; they change only on a new ruling):

1. **One orange action per screen.** Orange means "find food". See Colors for every approved use.
2. **Category colors.** Each of the eight kinds of place has its own color, on its pin and on its words, so a pantry and a garden can be told apart at arm's length. Nothing else uses them, and grocery's blue is never a link.
3. **No decorative pictures.** The only pictures are ones people send in: a blessing box's approved photos and an event's flyer, and they load only when that card opens.
4. **The map is the product.** Everything around it (search bar, bottom bar, cards) helps someone find food and get there, and stays under a tenth of the screen when nothing is open.

**Logo: not decided yet.** A new logo is parked. Until one is chosen, the current rules hold:

- The logo is the name, "Pueblo Food Map", set as live text in Fraunces with the shared `wordmark` utility (0.04em letter spacing, `src/app/globals.css`), never a picture. Bold on the welcome screen (`src/components/Wordmark.tsx`, `text-4xl md:text-6xl font-bold`, navy, 17 to 1 on bone 50) with a thin white outline because the map shows through; regular weight, ink 900, 24 pixels in the admin's top bar ("Pueblo Food Map Admin").
- Navy on light paper, ink 900 in the admin. No other colors, no gradients, no shadows; the one effect is the welcome screen's white outline.
- On sage green, use the pin mark (the app icon: an orange pin with a white edge and a white dot on sage 600, `src/app/apple-icon.png`, `public/icons/`), never the name.
- Sized to stay on one line: 36 pixels fits a 375-pixel phone, 60 from 768 wide. Nothing overlaps it.

**How we build** (the principles behind every screen):

1. **Find it in minutes.** The map comes first, and every screen helps someone find food and get there.
2. **Works on the phone people have.** Built for an older Android on slow data, used one-handed.
3. **Right, or it says so.** Hours and details are checked against their sources, and anything unsure is marked "call ahead" instead of guessed.
4. **Plain words, in English and Spanish.** No forms to qualify, no judgment, no jargon.
5. **Private by default.** No sign-up, no name asked to look for food, and no IP addresses, emails or form contents in our logs.

**Mission, vision and values** live in the brand note in the knowledge base, not here. The mission and vision are the ones on the About page. The brand values are in draft in the brand note, still under review with the Pueblo Food Project.

**The voice in one line:** a well-typeset community bulletin on cream paper, readable at a glance, trustworthy, not slick. In practice: plain, warm, second person, talking to one neighbor. See Wording.

## Colors

Every hex here is copied from `@theme`. Ratios are measured against the real background: words need 4.5 to 1, edges and icons 3 to 1.

**Bone is the paper.** Warm cream, never grey.

- `bone-50` `#FBFAF6`: the paper every page sits on.
- `bone-100` `#F4F1EA`: resting chips, the loading block, the location help card, the status pill without a photo, the admin's quiet tags. It is no longer a hover fill anywhere (that is sage 100, R1).
- `bone-200` `#E8E3D6`: card borders, dividers, the ended event badge.
- `bone-300` `#D4CDB8`: edges of the search bar, bottom bar and outline buttons at rest (1.5 to 1, decoration only: the words carry the control). It is also the public text-box edge, which fails (see Known drift); admin text boxes use ink 400.

**Ink is the words.** Warm charcoal.

- `ink-900` `#1A1817`: place names and headings. 17 to 1 on bone 50.
- `ink-700` `#2D2A26`: everyday words. 13.7 to 1 on bone 50, past the 7 to 1 AAA level. Body text never goes lighter.
- `ink-500` `#5F5A52`: second lines (distance, hours today, the bottom bar's words). 6.5 to 1.
- `ink-400` `#6A645A`: section labels (HOURS), placeholders, small icons, the middle dots in the category label; the edge of an admin text box (5.9 to 1 on white, #926). 5.6 to 1 on bone 50, 5.2 on bone 100, 4.6 on bone 200.

**Sage is everything you can press.** Every link, focus ring, selected state and filled button. Never blue.

- `sage-50` `#EAF0EC`: the Plentiful link fill, the good-news tag, What to bring, the sponsored band, the row the arrow keys reach in search results.
- `sage-100` `#D1DDD3`: SNAP and WIC badges, calm admin tags, the sponsor card, and **the hover fill** on anything you can point at that isn't a filled button (R1). Words on it stay ink 500 or darker (ink 500 4.9 to 1, ink 700 10 to 1, navy 13 to 1); ink 400 is 4.2 to 1 and is never words on it.
- `sage-500` `#4A8466`: the keyboard ring, the selected pin ring, today's line in the hours, the Plentiful link's edge. 4.2 to 1 on bone 50, 4.4 on white: an edge color only, never words, and never a fill behind words (`npm run lint` refuses `bg-[var(--color-sage-500)]` outside the two non-text marks).
- `sage-600` `#2C5F4F` (`primary`): the main color. Filled buttons (bone 50 words 7.0 to 1, white 7.4 to 1), Walk, the switch that's on, link hovers.
- `sage-700` `#1F4639`: link and phone words, SNAP and WIC words, a filled button under the pointer (bone 50 words 10 to 1).

**Orange and navy are the Pueblo Food Project's brand colors** and stay rare.

- `brand-orange` `#F7943C`: the one main action on a screen, always with navy words (7.8 to 1, AAA). Never words on a light color (it fails). Orange buttons get no hover change. Approved uses: the welcome screen's Find food near me (one button per language, `src/components/SplashScreen.tsx`); Try again on the location help card (`src/components/LocationHelpCard.tsx`); the Filters panel's Show N places button and the Filters count beside the icon (`src/components/FilterPanel.tsx`, `src/components/SearchBar.tsx`); the admin's Add place (`src/components/AdminNav.tsx`, its one main action).
- `brand-navy` `#190F3F`: the wordmark, words on orange, the bottom bar item whose panel is open, the Share an event page's "Preview" tag (`src/components/ShareEventForm.tsx`, navy pill with bone 50 bold words, no orange).
- `brand-yellow` `#FFD166`: support and classification badges only, with ink words (ink 700 9.9 to 1); also the admin's caution tags, Draft on Places and Low on Blessing Boxes (ink 900, 12 to 1). Never a button, a state or a background.

**The event exception.** `event-pin` (`#F7943C`) and `event-outline` (`#190F3F`) are the same hexes as orange and navy with their own names (owner's ruling, 2026-10-10), so an event reads as different from every place and the exception can be found in the code. They cover only: the event star pin (`src/components/EventMarker.tsx`), Get directions on the event card and event page (`src/components/EventCardBody.tsx`, `src/components/EventPage.tsx`), the happening-today strip (`src/components/EventStrip.tsx`: navy bar, orange star and status line 7.8 to 1, white name 18 to 1), and the star on the events list rows and the Filters Events row. Nothing else on an event card is orange.

**Clay and alerts.**

- `clay-100` `#F8E2D4`: the pale fill for reports, warnings and "needs a sponsor"; clay 700 words on it 7.5 to 1.
- `clay-500` `#C2410C`: the filled saved star, the Donate heart, the × on the outside-the-county note, the edge of Waiting to publish. An edge color (5.0 to 1 on bone 50).
- `clay-700` `#7C2D12`: words on clay 100; calm "didn't work, here's what to try" guidance; an event's cancel note (9.0 to 1 on bone 50).
- Clay is the warm attention color. It is never a third action color beside sage.
- `success` `#15803D` (Stocked, thank-you lines), `warning` `#B45309` (Running low), `danger` `#B91C1C` (errors, Empty, remove buttons). `danger` is the only error red; never Tailwind's `red-*`. Success and warning pass on bone 50 (4.8 to 1) but not on bone 100 (see Known drift).

**Category colors: map pins and the category words.** A data palette, one color per kind of place. Use them only for that kind of place (its pin, its words on a card), never for a button, a link or a state. Each carries words on the paper, so each is checked at 4.5 to 1 on bone 50:

| Kind of place | Token | Hex | On bone 50 |
|---|---|---|---|
| Food Pantry | `cat-pantry` | `#BE2D45` | 5.5 to 1 |
| Grocery / Supermarket | `cat-grocery` | `#1F4E8C` | 8.0 to 1 (the only blue on the site) |
| Convenience Store | `cat-convenience` | `#0F6573` | 6.4 to 1 |
| Farm / Market | `cat-farm` | `#92591D` | 5.5 to 1 |
| Community Garden | `cat-garden` | `#2C5F4F` | 7.0 to 1 (the same hex as sage 600, on purpose) |
| Edible Landscape | `cat-landscape` | `#58772B` | 4.9 to 1 |
| Meal Site | `cat-meal` | `#6B3FA0` | 7.1 to 1 |
| Blessing Box | `cat-blessing` | `#C2447B` | 4.6 to 1 (also Boxes in the bottom bar while it's on) |

Category words never sit on the hover fill: on sage 100, pantry and farm are 4.1 to 1, landscape 3.7 and raspberry 3.4. That is why a Boxes-on item gets no hover fill. Raspberry is also 4.2 to 1 on bone 100, so Boxes-on stays on bone 50.

**Pairs that fail or are never used for words** (shown so nobody reaches for them): bone 300 edge on white 1.6 to 1 (live on public text boxes, Known drift); warning on clay 100 4.0 to 1 (the old admin Low tag, gone since #926); sage 500 words on white; orange words on the paper; ink 400 on sage 100; any category word on sage 100.

## Typography

Two typefaces, both self-hosted as variable `.woff2` files, so no page waits on another company's servers.

- **Fraunces** (variable, 300 to 900) is the display serif, for headings only: the wordmark, place names, page titles, short card and thank-you titles, admin titles (these carry the `wordmark` utility's 0.04em spacing). Regular weight, semibold at most, except the welcome-screen wordmark, which is bold. Ink 900; navy for the wordmark and the location help card title. It is not preloaded: it loads with `font-display: swap` so it never competes with Public Sans for first paint.
- **Public Sans** (variable, 100 to 900) carries everything else: body, buttons, badges, labels, hours, distances, placeholders. It is the one font preloaded (`/fonts/PublicSans-Variable.woff2`). Four letter alternates are on everywhere (`font-feature-settings: "cv02", "cv03", "cv04", "cv11"`) for cleaner numbers.
- **Monospace** (`ui-monospace`) for distance readouts and the times in the hours list, so the numbers line up.

**Sizes** (Tailwind's own sizes plus a few written by hand; there is no type scale in `@theme`):

| Size | Class | Face | Where |
|---|---|---|---|
| 60 | `text-6xl` | Fraunces | The wordmark on the welcome screen, 768 wide and up |
| 36 | `text-4xl` | Fraunces | The wordmark on phones |
| 30 | `text-3xl` | Fraunces | Page titles on content pages (About, help pages, Not found, a box's history) |
| 24 | `text-2xl` | Fraunces | Page titles on form pages and a place's own page; an event's name; the admin's name, Pueblo Food Map Admin, the admin's one `h1` (`adminNameClass`) |
| 20 | `text-xl` | Fraunces | A place's name on its card (`leading-tight`); a thank-you title (semibold); an admin page's title, its `h2` (`pageTitleClass`) |
| 18 | `text-lg` | Fraunces | The location help card's title; the box check-in question; admin section titles, `h3` (`sectionTitleClass`) |
| 16 | `text-base` | Public Sans | Inside every text box on a phone; empty-page titles (semibold); route steps; the name of the thing an admin card is about (semibold, `cardNameClass`) |
| 14 | `text-sm` | Public Sans | The everyday size: card lines, buttons, menu rows, field labels, the category words (semibold); admin group headings inside a section, `h4` (semibold ink 700, `groupTitleClass`) |
| 12 | `text-xs` | Public Sans | The bottom bar's words (bold), field errors, small second lines, the map's hover tip |
| 11 | `text-[11px]` | Public Sans | Section labels in capitals (HOURS), tracked wider; the bottom bar's words under 360 wide |
| 10 | `text-[10px]` | Public Sans | The smallest, in three places: small badges on the computer card, the admin chart's week labels, a label on the report page |

New work picks from this list. Each size brings its own line height (12 on 16, 14 on 20, 16 on 24, 18 on 28, 20 on 28, 24 on 32, 30 on 36). Paragraphs open up to `leading-relaxed` (1.625); names and titles close to `leading-tight` (1.25); words inside buttons sit at `leading-none`. Weights: 400 reading, 500 labels, 600 the category words, empty-page titles and section labels, 700 the bottom bar's words.

**On a 360-pixel phone:** text boxes are 16 pixels and drop to 14 from 768 wide (below 16 an iPhone zooms the whole page when the box is tapped); the bottom bar's words drop from 12 to 11 below 360 wide; the longer Spanish welcome button (Encuentra comida cerca de mí) gets less side padding below 640 wide and `text-balance`, so a word is never left alone; Spanish runs longer, so every label wraps or shortens cleanly at 320 wide and words never break in the middle.

**Don't:** Fraunces on a button, a badge, a label or running text at 16 pixels or smaller. Lighter than ink 700 for reading. A size off the list.

## Layout

**A 4-pixel grid:** 4, 8, 12, 16, 24, 32, 48, 64. Most gaps and padding land on 16 or 24.

**The spacing trap.** `@theme` redefines `--spacing-5`, `--spacing-6`, `--spacing-8` and `--spacing-10` as 24, 32, 48 and 64 pixels (stock Tailwind: 20, 24, 32, 40). That reaches every class built on them: `p-5` is 24, `gap-6` and `size-6` are 32, `h-8` and `w-8` are 48, `h-10` is 64, `space-y-5` is 24. Every other number is 4 times itself as usual: `h-11` is 44, `h-12` and `min-h-12` are 48. When you mean 20 or 40 pixels, write it out (`p-[20px]`) or pick a number that isn't remapped, and check the size in the browser, not in the Tailwind docs. Icons take a `size={n}` number, never a size class. Live examples of the trap are under Known drift.

**The map screen.** The Mapbox map fills the whole screen; no sidebar, no max-width on the root, the map bleeds to every edge. Only the search bar and the bottom bar are always there (under 10% of a 1440 by 900 screen). A card opens over it: the phone sheet, or the computer side panel (380 wide). Exact positions are under Low-end device guardrails, Safe zones.

**Content pages** (About, help pages, hub pages, forms, a place's page, a box's history, box activity): one centred column, `max-w-lg` (512 pixels), `px-4` (16-pixel) gutters; the footer uses the same column. Admin editing forms widen to `max-w-2xl` (672).

**Breakpoints** (Tailwind's defaults, used as they are):

| Width | Name | What changes |
|---|---|---|
| under 360 | `min-[360px]` | The bottom bar's words drop from 12 to 11 pixels so five items fit at 320 |
| 640 | `sm` | Small padding and type steps on content pages and the admin |
| 768 | `md` | **Phone to computer:** the phone sheet becomes the side panel, the full-screen Menu a 280-pixel dropdown on inside pages, the search bar 520 wide and centred, text boxes 16 to 14 pixels (`MOBILE_QUERY`, `src/lib/useMediaQuery.ts`) |
| 1024 | `lg` | Admin dashboard, boxes and proposals go to columns |
| 1536 | `2xl` | The bottom bar becomes a centred pill (`BELOW_2XL_QUERY`); the Mapbox credits stop lifting above it |

Design and test at 360 and 375 wide first; 320 must not cut anything off.

## Elevation & Depth

A shadow means something floats over the map. Two levels, both tinted with ink 900 (`rgba(26,24,23,...)`), never plain black. Anything sitting flat on the paper gets a `bone-200` line instead.

- **Level 1** (`elevation-1` utility in `src/app/globals.css`): `0 1px 2px rgba(26,24,23,0.04), 0 0 0 1px rgba(26,24,23,0.05)`. A hairline ring and a breath of shadow: the search bar, the admin's cards and tables.
- **Level 2** (`elevation-2`): `0 4px 12px rgba(26,24,23,0.06), 0 0 0 1px rgba(26,24,23,0.06)`. Lifted: the phone sheet, the search popovers, the happening-today strip, the location help card, the route strip; on the admin, the sign-in card and the three-dot menu.
- **The bottom bar's own:** `0 4px 16px rgba(26,24,23,0.14)`, deeper because it floats over the busiest part of the map (`src/components/bottomNavShared.tsx`).
- **Map pins** draw their shadow inside the SVG (`src/components/PinShadow.tsx`): five faint, ever-wider copies of the outline, 2 pixels down. Never a CSS `drop-shadow` filter: a filter was redrawn every frame for about 130 pins while the map moved (#722).
- **Backdrops** behind the Menu and Filters are ink at 40% (`rgba(26,24,23,0.4)`), never black. The photo viewer's near-black scrim (`rgba(0,0,0,0.92)`) is the one black surface, because it shows photos.

**Don't:** a third level, a shadow on a card that sits on the paper, a CSS filter shadow on anything drawn on the map. Live panels with black shadows written by hand are under Known drift.

## Shapes

Rounder as things get bigger. Use one of the five tokens; never a new size.

| Token | Size | Where |
|---|---|---|
| `radius-sm` | 6 | The map's hover tip, SNAP and WIC badges, the event pin's label, the Call label on a computer |
| `radius-md` | 10 | The most used: text boxes, buttons, the Plentiful link, error boxes, the event strip |
| `radius-lg` | 14 | Cards, popovers, the Donate card, the location help card, the Not found card, the computer side panel, admin cards |
| `radius-xl` | 20 | The top corners of the phone sheet and the steps sheet |
| `radius-full` | fully round | The search bar, the bottom bar, pills, badges, round icon buttons; every admin tag, filter chip and slider |

The code writes them as `rounded-[var(--radius-md)]` or the named class; both give the token. Off-scale corners in the live code are under Known drift.

## Components

One compact entry per shared part, in the order a visitor meets them, then the inside pages, then the admin. Each names its real file. All are live; "Approved, not built" lines are the owner-approved changes still to code.

### The redesign rulings (apply to every entry below)

These five rulings apply to the whole site. All five are live on the public site (#917) and on the admin (#926). Every grey hover is now sage 100, including the place card's Report an issue (its mockup picture still shows bone 100).

- **R1, the hover fill is sage 100.** Under the pointer, anything you can press that isn't a filled button takes a `sage-100` (`#D1DDD3`) fill, fading in over 150 ms. It replaces every grey hover (`bone-100`, `bone-200`, and `sage-50` on sign-in). Words on it stay ink 500 or darker. Filled sage buttons darken to sage 700. A Boxes-on item gets no hover fill. Orange buttons get no hover change at all.
- **R2, nothing brightens on hover.** No `filter: brightness()` under the pointer, anywhere: on top of the color fade it made hover stutter. The press dim stays: a slight `brightness(0.95)` while pressed shows a tap landed, and the approved pages keep it. So `PRESS_FEEDBACK` in `src/lib/interactionStyles.ts` is `active:brightness-95` only (its old `hover:brightness-105` half is gone). Hover animates color, opacity or transform only.
- **R3, the category label is colored words.** On a card the category is colored words on their own line under the name: the category in its category color, then SNAP, then WIC in sage 700, joined by middle dots in ink 400 (`Food Pantry · SNAP · WIC`). Sentence case as the data names it, 14 pixels, semibold, no fill, no underline, no pill. Screen readers hear a comma for each dot. SNAP or WIC only when the place takes it. The same style anywhere a category with SNAP and WIC shows on a place.
- **R4, the card action row.** A row of icon buttons at the top left of the place and box cards, above the name, so the name runs the card's full width. Full detail: Card action row.
- **R5, switches slide in 250 ms** on `--ease-out-circ` (`cubic-bezier(0.32, 0.72, 0, 1)`), knob and fill together (live: 150 ms, too fast to see).

### Bottom bar (BottomNav)

`src/components/BottomNav.tsx`, `src/components/bottomNavShared.tsx` (classes and the Boxes icon), `src/app/globals.css` (`[data-bottom-nav]`, `--bottom-nav-clearance`), `docs/bottom-nav-spec.md` (geometry and stacking history).

- **Status:** Live as is. R1 and R2 are in (`ITEM_CLASS`: a sage 100 hover, none on Boxes while it's on, the press dim only). The standing spec (and the code's own comment): icons 24 on phones and 20 on large screens, the large-screen bar 24 up. Live they measure 32, 24 and 32 because of the spacing trap (Known drift). Open: the owner may keep 32. Either way, use exact pixel classes.
- **For:** the five ways off the map: Near me, Saved, Boxes, Help, Menu. Near me and Boxes act on the map; Saved and Menu open a panel; Help opens the Food help programs page (`/resources`). It floats near the bottom of every map and inside page, under the thumb.
- **Use something else when:** it's about one place (the card); it narrows the map (Filters; Boxes is the one agreed shortcut); it's a new destination (the Menu). A sixth item narrows every cell and needs a mockup first.
- **States:** resting `ink-500`; panel open `brand-navy`; Boxes on: raspberry words and icon, and only the heart in the box icon fills (the shape changes too); working: Near me shows `Loader2` spinning and can't be pressed again; keyboard: a sage 500 ring inside the item.
- **Behaviour:** Boxes on with the location already known centers the map on the visitor, zoomed to their 5 nearest boxes (`nearestBoundsAround`, `src/lib/mapBounds.ts`); it never asks for the location. Saved opens the drawer with only saved places. The bar hides while something covers the whole screen (the phone Menu, Filters, a photo, the route steps, the phone sheet).
- **Sizes:** below 1536 wide: a 64-pixel `bone-50` pill with a `bone-300` edge, 12 in from each side and `calc(env(safe-area-inset-bottom) + 12px)` up, five equal items (about 64 wide at 360, 57 at 320), icon over a 12-pixel bold word, the bar stops growing at 460 wide. From 1536: a white pill bottom centre, 52 tall, icon and word on one line, items 44 tall (left at 44: that size only shows where a pointer is the norm). The hover fill sits 4 pixels in from the bar's inner edge on every side, a pill whose round ends follow the bar's (radius = the bar's inner radius minus 4): drawn on the item's `::before` (`before:inset-y-1`, `2xl:before:inset-y-px` for the 44-tall items) with the bar's 4-pixel side padding (`px-1`), so the items themselves keep the bar's full height as their tap areas (#917 round 3).
- **Wording:** Near me, Saved, Boxes, Help, Menu (Cercanos, Guardados, Cajas, Ayuda, Menú). The words never change with the state.
- **Everyone:** a navigation landmark called Main, last in the Tab order after the map and search; the open item is current, Boxes is pressed or not, a hidden line says Locating…. Every item keeps its word.

### Place card (VenueCardBody)

`src/components/VenueCardBody.tsx`, shown inside `src/components/BottomSheet.tsx` (phone) and `src/components/DesktopVenueWindow.tsx` (computer, variant "panel"); `src/components/HoursList.tsx`, `src/components/DirectionButtons.tsx`, `src/components/ReportVenueButton.tsx`.

- **Status:** Live as is. R1 to R4 are in: the card starts with the action row (`src/components/VenueActionRow.tsx`), the category is the colored label (`src/components/CategoryLabel.tsx`), the phone number is the Call button (its `tel:` link and `CALL_CLICKED` tracking moved there; no CONTACT section), and on a computer the × ends the action row. The Plentiful line stays for Plentiful places.
- **For:** everything about one place, in the order people need it: the action row, the name, the category label, the Event here line, the operator, how far and whether it's open, notes, Walk, Bus and Drive, then the address, Accepts SNAP and WIC badges, the week's hours, the Plentiful link and Report an issue with this place. The same body on the phone and the computer.
- **Use something else when:** it's a blessing box (Box card), an event (Event card), or several places (the list).
- **States:** hours line Open now · Closes 6pm, Opens at 2pm, Closed today, or Hours unknown with its own icon (`circle-question-mark`), so no hours is never read as open. On the phone, everything below the direction buttons starts below the screen edge with its top showing.
- **Sizes:** phone: 24 pixels in from the sides (`px-5`, the trap) and no top padding: the action row's tap boxes meet the grab bar's, 12 between blocks, name Fraunces 20, the rest 14 (labels 11, operator line 12). Every control taps at 48. Computer: 16 padding, words 12, labels 10, icons a size smaller, notes in full.
- **Wording:** hours today as a short sentence, times lower case with no :00; distance to one decimal, "0.8 mi from you"; the distance and hours-today items each stay on one line (`whitespace-nowrap`) and the row wraps between them (`flex-wrap`, 4 between lines), so a long Spanish item drops whole to the next line instead of breaking in two; section labels in capitals (HOURS).
- **Everyone:** the name is the card's heading; Hours is a labelled section; today's row is marked as the current date, not only by color; Bus and Drive say they open a new tab; the star says Add to saved or Remove from saved and whether it's pressed.

### Search bar (SearchBar)

`src/components/SearchBar.tsx` (the bar and the Filters icon), `src/components/SearchResultsPopover.tsx`, `src/components/EmptySearchPopover.tsx`.

- **Status:** Live, changing in the redesign. R1 (result rows, See all and the No matches category buttons take sage 100; a row's `ink-400` words darken to `ink-500` under the pointer, so they stay 4.5 to 1) and R2 are in. Approved, not built: R3 under each result's name (live: 12-pixel grey words). Open: R3's colored words on a row under the pointer (sage 100) or the arrow keys (sage 50) fall under 4.5 to 1 for some categories (pantry and farm 4.1, landscape 3.7, raspberry 3.4 on sage 100; landscape 4.4 and raspberry 4.1 on sage 50), which collides with "category words never sit on the hover fill". Not decided.
- **For:** finding a place by name or kind. It floats at the top of the map: the magnifier at the left, the words box, and Filters inside its right end. Results drop down as you type, nearest first; with no match it offers the eight kinds of place.
- **Use something else when:** narrowing the map (Filters); seeing every place as a list (the map / list switch).
- **States:** typing edge `sage-500`; Filters icon `ink-500` with nothing on, `sage-600` with filters on, plus an orange count pill beside the icon (never over it); the row the arrow keys reach is `sage-50`.
- **Sizes:** 48 tall on a phone, 52 on a computer, fully round, 16 in from the screen sides, 520 wide from 768, level 1 shadow. Magnifier 16 (18 on a computer). Filters is 44 drawn, 48 to tap (a 2-pixel invisible `::before`), with a 1-pixel `bone-200` divider on its left; the input reserves room for the count so typed words never reflow. Drop-downs 8 under the bar, corners 14, level 2; result rows 52 tall; category buttons 48 tall, 8 apart.
- **Wording:** Search before typing, heard as Search places (Buscar, Buscar lugares); Filters, heard as Filters, 2 on; +4 more matches, then See all 7 matches as a list; No matches for "xyzzy", then Try a category instead:. There is never a Search button.
- **Everyone:** a search box with a list of suggestions; the arrow keys move through results, Enter opens, Escape closes; the match count is read out when it changes; distances are read as "0.8 mi away".

### Filters panel (FilterPanel)

`src/components/FilterPanel.tsx`, opened by the Filters icon in `src/components/SearchBar.tsx`; the filters live in `MapWrapper`'s `useMapFilters`.

- **Status:** Live as is. Every kind of place is a switch row like the Show only rows (a 10-pixel color dot in the icon slot, the name, how many places of that kind there are, `useMapFilters`' `categoryCounts`, and the same switch), with no tick boxes; switches slide in 250 ms (R5); R1 on the ×; R2 everywhere (the orange Show N places gets no hover change).
- **For:** narrowing what the map shows. It slides in from the left over a dimmed map (300 ms on `--ease-out-circ`, the dim fading in with it; out in 250 ms, then it unmounts; no slide with reduced motion; see Animation). Every switch applies at once; the orange button only closes the panel and says how many places are left.
- **Use something else when:** one place by name (search); only blessing boxes (Boxes in the bottom bar).
- **Rows:** SHOW ONLY: Events (first, with a star in the event colors and the count of events still to come; shown only while there are events, or while it is on; on, it shows only events and pins every upcoming event beyond the usual 7-day window), Open now, Accepts SNAP, Accepts WIC. KIND OF PLACE: the eight full category names, each a switch row with its count. The guided tour's Filters step highlights the Show only rows only.
- **Sizes:** 85% of the screen wide, up to 360, full height, from the left, over ink at 40%. Title row 16 top and bottom, 24 at the sides. Every row at least 48 tall with 24-pixel sides; the switch is drawn 36 by 24 and the whole row is its tap area. Switch on `sage-600`, off `bone-300`, white knob. The × is 48 round. The button is full width, 48 tall, corners 10, 14-pixel bold words.
- **Wording:** Filters (Filtros); Clear all (Borrar todo) clears the switches, never the search words; Show 24 places (Mostrar 24 lugares), or Show 3 events with Events on.
- **Everyone:** a dialog named Filters; focus moves in and stays; Escape, the ×, a tap on the dimmed map or a swipe left closes it, and focus returns to Filters. Every row is one `role="switch"`, heard by name and state. Same layout at every width.

### Map / list switch (ViewSuggestion)

`src/components/ViewSuggestion.tsx`; the list it opens is `src/components/ListView.tsx`; also See all N matches as a list (`src/components/SearchResultsPopover.tsx`) and the Menu's first line (`src/components/HamburgerMenuContent.tsx`).

- **Status:** Live as is (R1: sage 100 under the pointer).
- **For:** the way from the map to a list of every place, and back. Not a standing control: tapping into the empty search bar drops one row offering the other view. On the list with the map turned off (#165) it renders nothing rather than a dead row.
- **Use something else when:** two or three views that both stay on screen (a slider of real radios); narrowing the map (Filters).
- **Sizes:** one row 52 tall, as wide as the search bar, 8 under it, corners 14, level 2. A `sage-600` 18-pixel icon, `sage-700` 14-pixel bold words over a 12-pixel `ink-500` count, an `ink-400` chevron.
- **Wording:** it names where it takes you: See all places as a list, Back to the map. The count follows the filters, never the search words. The Menu line is List view or Map view.

### Map pins and the hover tooltip (VenueMarker, EventMarker)

`src/components/VenueMarker.tsx`, `src/components/PinShadow.tsx`, `src/components/EventMarker.tsx` with the `.pfm-event-*` rules in `src/app/globals.css`, `src/lib/eventPins.ts`; the tooltip in `src/components/Map.tsx` and `.pfm-tooltip` in `src/app/globals.css`.

- **Status:** Live, changing in the redesign. Approved, not built: R3 in the tooltip under the name (live: 11-pixel `ink-500` words under a 12-pixel name). Open: whether the 14-pixel label fits under a 12-pixel name. The pins are live as they are.
- **For:** every place is a pin in its category color with a white edge; a tap opens its card. A computer shows the tooltip (name and kind) on pointer or keyboard focus. Events get their own bigger orange pin with a navy star and their time written over it.
- **Place pin:** Lucide's `MapPin` filled with the category color, white `1.5` stroke, the drawn shadow. 28 pixels; selected 36 inside a 4-pixel `sage-500` ring. Hover grows it 15% over 0.1 s (mouse only). Taps at 44 (Known drift).
- **Event pin:** the pin outline filled `event-pin`, an `event-outline` edge and five-point star; 44 tall coming up, 52 going on now, tapping at 48, drawn above every place pin. Its label (12-pixel bold) sits 2 above it: `bone-50` with navy edge and words while coming up ("Sat 2 PM", "Today 2 PM"); navy fill, bone 50 words, orange edge while live ("NOW, until 2 PM"), with the `pfm-event-ring` rings (see Animation). Selected: the same sage ring plus `scale(1.12)`. Times are always Pueblo time.
- **Tooltip:** default Mapbox popup chrome removed: `bone-50`, 1-pixel `sage-500` edge, `radius-sm`, 4 by 8 padding, no arrow, `pointer-events: none`, up to 240 wide; name 12-pixel semibold `ink-700`.
- **Wording:** screen readers hear the name, a short kind in lower case and the distance: "Eastside Community Pantry, Food pantry, 0.8 mi". Event pins add "special event" and the day.
- **Everyone:** every pin is a real button; Tab reaches them, Enter opens the card, the tooltip shows on focus. No tooltip on a phone.

### Phone sheet and computer side panel (BottomSheet, DesktopSidePanel)

`src/components/BottomSheet.tsx`, `src/components/DesktopSidePanel.tsx` (size, place, Escape, focus), `src/components/DesktopVenueWindow.tsx` (what the panel shows, and its pinned top), `src/lib/interactionStyles.ts` (`HIDDEN_UNTIL_FOCUS`).

- **Status:** Live as is. On a computer the × ends the card's action row at the right (the old `VenuePopupHeader` bar is gone); ← Saved, when shown, shares one line with the ×, and a box's History does the same, with no line under either; R1 on the × and the phone's keyboard-only Close; R2 on the × and the grab bar. On the phone the card's first row now starts right under the grab bar (#917 round 3): the bar's 48-pixel button and the action row's 48-pixel buttons meet edge to edge, so the icons sit 14 pixels under the bar's tap area, no top padding on a place or box card.
- **For:** the two containers every card sits in (a place, a box, an event; on a computer also the Saved list and the Menu).
- **Phone sheet:** a vaul drawer, `bone-50`, top corners `radius-xl`, level 2, height `calc(100dvh - 100px - env(safe-area-inset-bottom))` (vaul's snap points measure from `window.innerHeight`, so the height tracks it; fully open it leaves 100 pixels of map). A `bone-300` grab bar (64 by 5, `h-[5px] w-10`, wider than its button because `w-10` is 64 here) inside a real 48 by 48 button, named Show details or Hide details, with `aria-expanded`. Every card draws the bar, a box too: when a card's first view fills the sheet (a box's check-in panel does on most phones) there is only one resting height, so the button is disabled, hidden from screen readers and lets touches through (`pointer-events-none`), but the bar stays drawn as the handle a swipe down closes from. Two resting heights plus closed: collapsed shows the top of the details at the screen edge (the peek: 64 pixels for a place, 96 for a box or event), no fade. The sheet follows the finger anywhere between the two heights and settles to the nearer, with vaul's 0.5 s ease; it scrolls only when fully open; a swipe down from collapsed closes it. No visible × on the phone: the Close button stays in the Tab order, hidden until keyboard focus (then a 48-pixel button top right). Escape closes. Tapping the map behind it does not close it.
- **Route strip:** while a walking route is on, the sheet collapses to `RouteStrip` (see Direction buttons); the bottom bar hides for as long as the strip or the full card is on screen.
- **Computer panel:** fixed to the right, 12 in from the top, right and bottom, 380 wide, `bone-50`, `bone-200` edge, `radius-lg`, one view at a time (`MapWrapper`'s `sidePanelView`). The search bar and bottom bar shift left by `DESKTOP_PANEL_RIGHT_CLEARANCE_PX` while it's open, and the map pans (`panBy`) so the chosen pin clears it; `fitBounds` adds the same right padding. Not a trap (`aria-modal="false"`): the map stays usable. Its top (the action row, or ← Saved or History with the ×) stays put while the card scrolls under it, with no line under it until something has scrolled beneath, then one `bone-200` hairline.
- **Everyone:** on open, focus moves to the card's name; Escape, the × or a click on the map closes it and focus returns to the pin or bar item (not when the view changed from inside the panel). In the panel's action row Tab runs Call, Website, Share, Save, Close.

### Direction buttons and the route strip (DirectionButtons, RouteStrip)

`src/components/DirectionButtons.tsx` (Walk, Bus, Drive, the route readout, `WalkStepper`), `src/components/RouteStrip.tsx` (the phone strip and the steps sheet).

- **Status:** Live as is (R1 on Bus, Drive and the steps sheet's ×; R2 everywhere).
- **For:** getting to a place. **Walk** draws the walking route on our map, so it is the one filled button (`sage-600`, `sage-700` under the pointer; while a route is on it reads Clear walking route on a `sage-100` fill with a `sage-600` edge). **Bus** and **Drive** open Google Maps in a new tab, so they are outlines (`bone-50`, `ink-700` words, `bone-300` edge).
- **Use something else when:** a blessing box (its address is the walking-route link); an event (one orange Get directions).
- **Route strip (phone):** 112 tall, flush at the screen edge (`env(safe-area-inset-bottom)`): the place name (Fraunces 16), distance and time, Clear walking route, a filled `sage-600` Steps button (or "No turn-by-turn steps for this route" when there are none), Show card. Steps opens a bottom sheet (up to 70% of the screen, top corners 20, over a 40% black dim) with one turn at a time: Step N of M, 48 by 48 Back and Next, the distance to the turn, a "Then:" peek, All turns for the whole list, and Open in Google Maps.
- **Sizes:** Walk, Bus and Drive share the card's width, 48 tall, 8 apart, corners 10. Turn icons and arrows 24.
- **Wording:** Walk, Bus, Drive (Caminar, Autobús, Manejar); Walk is heard as "Walking directions to <place> (opens on map)". Share your location to see walking directions, under the row when the location is off.
- **Everyone:** each new turn is read out on Back or Next; the arrows are named Previous turn and Next turn and can't go past the first or last; the steps sheet is a real dialog.

### Card action row (ShareButton, FavoriteButton)

`src/components/ShareButton.tsx` and `src/lib/share.ts`, `src/components/FavoriteButton.tsx`; Call and Website in `src/components/VenueActionRow.tsx` (`ownWebsite` skips Plentiful pages); placed by `src/components/VenueCardBody.tsx` (phone), `src/components/DesktopVenueWindow.tsx` (computer) and `src/components/BoxCardBody.tsx` (`nameBlock`).

- **Status:** Live as is (R4, `src/components/VenueActionRow.tsx`). One row of icon buttons as the card's first line, at the top left, 12 above the name: **Call** (a `tel:` link, Lucide `Phone`), **Website** (the place's own `venue.url` when it isn't a Plentiful page, Lucide `Globe`), **Share**, **Save**, and on a computer the **×** at the far right. A missing phone or website stays in its place, greyed (ink 400 at 40%), as a `<button>` with `aria-disabled="true"`, never a link, so the row never shifts and a screen reader hears why. On a computer, Call shows its number in a small `ink-900` label under the pointer and keyboard focus (a computer can't dial). A box card gets Share and Save only, on the left (boxes have no phone or website: `BoxVenueRow` in `src/lib/blessingBoxes.ts` selects neither). The event card does not get this row. R1 and R2 apply; a missing one gets no hover fill. On a computer the row sits in the panel's pinned top (Side panel and sheet).
- **For:** call the place, open its website, share the link to it, save it. Most useful first: calling ahead is what people do before they go.
- **Use something else when:** the action needs words (Get directions, Add to calendar). More than five actions: at 360 wide the row holds five (four used); a sixth means four icons and a three-dot menu in the fifth place.
- **States:** icons `ink-400` at rest, `ink-700` under the pointer; save: outline, filled `clay-500` when saved (`aria-pressed`); share: the native share sheet, or copy the link and swap to a `sage-600` `Check` for 2 seconds.
- **Sizes:** each 48 by 48 to tap, corners 10, icon 20 (18 on a computer), 8 apart; the first one's tap area reaches 4 pixels into the card padding. A phone place card has 312 pixels inside its padding at 360: five icons fit (272), six don't (328).
- **Wording:** no visible words. Heard as "Call (719) 555-0142", "Visit <place>'s website (opens in a new tab)", "Share <place>", "Add <place> to saved"; missing ones "No phone number listed", "No website listed" (Sin número de teléfono, Sin sitio web); after a copy, Link copied (Enlace copiado).

### Hours list (HoursList)

`src/components/HoursList.tsx` (phone card and computer panel), `src/lib/hours.ts` (day order, time format). The place's own page builds its own copy with no today line on purpose (`src/components/VenueContent.tsx:159-205`): that page is built ahead of time and must never read today's date.

- **Status:** Live as is.
- **For:** the week's hours, Monday first, today marked; a Monthly list follows when a place also opens on a monthly pattern.
- **Use something else when:** you only need today (the card's short hours line); an event (its When section).
- **Sizes:** a `<dl>`; day column 48 wide (28 on a computer), 12 to the times; today is `font-semibold sage-700` with a 3-pixel `sage-500` line on its left; times in monospace so they line up; 14 pixels on a phone, 12 on a computer.
- **Wording:** three-letter days (Mon, Tue; Lun, Mar); times lower case with no :00, joined by a spaced short dash (`9am – 1pm`), two times on a day joined by a comma; Closed (Cerrado); Monthly (Mensual).
- **Everyone:** today is `aria-current="date"` and also says ", Today"; nothing in it takes focus.

### Event card (EventCardBody)

`src/components/EventCardBody.tsx`, rendered by `BottomSheet` on a phone and by `src/components/EventPanel.tsx` in the side panel; `src/components/EventFlyer.tsx`, `src/components/EventHereLine.tsx`, `src/components/EventStrip.tsx`, `src/components/EventsEmptyNotice.tsx`, `src/components/EventListSection.tsx`; `src/lib/eventCard.ts` (badge, When words, the action button's label).

- **Status:** Live as is (R1 on Share, Add to calendar and the computer's ×; R2 everywhere). It does not get the card action row.
- **For:** one special event, from its pin or the strip. Top to bottom: the flyer, a badge, the name (Fraunces 24, the card's `<h2>`), Hosted by, When, About (cut to 3 lines, Read more only when cut), the action button, Where, What to bring, Share and Add to calendar, and the orange Get directions last.
- **Flyer:** the admin's picture in a `bone-100` box with a `bone-200` edge and `radius-md`, sized by its stored shape, at most `min(55vh, 28rem)` tall, never cropped (`object-contain`), a link to the full file. None, or it fails to load: nothing, no placeholder. On a phone it sits at the top of the below-the-fold part.
- **Badge:** coming up `bone-50` with a 2-pixel navy edge and words; live: navy fill, bone 50 bold words, an orange dot; ended `bone-200` / `ink-700`; cancelled `clay-100` / `clay-700` with a `clay-500` edge. Always words; it counts down once a minute and is not a live region.
- **Action button** (only for an http(s) link, and only while the event is upcoming or on now; ended and cancelled cards hide it, `EventCardBody.tsx:412`): full width, at least 60 tall, `radius-md`, `sage-600` fill, a 22-pixel icon for the kind (`Globe` website, `ClipboardCheck` sign up, `Ticket` tickets, `CircleCheck` RSVP, `HandHelping` volunteer, `Heart` donate), the label in white 16 bold over the site name in 12-pixel `sage-100`, a chevron; new tab.
- **Rest:** What to bring: `sage-50`, a `sage-500` edge, `sage-700` title. Share and Add to calendar: equal outline buttons, 48 tall. Get directions: full width, 56 tall, `event-pin` fill, navy words, navy focus ring 2 out. Ended or cancelled: the badge, the note in `clay-700`, a `sage-600` See places open now button, and none of the action button, Get directions, Share or Add to calendar.
- **Happening-today strip:** 48 tall under the search bar, as wide as it, 8 below, `radius-md`, navy, level 2: a 20-pixel orange star, a status line (11-pixel orange, "Happening now, until 2 PM") over the name (14-pixel white), then a chevron or "and N more", then a 48 by 48 ×. It names the event on now, else the next to start; closing hides that event until the Pueblo day ends. Map view only, hidden while any card is open. Below 360 wide "and N more" shortens to "+N". Placement: Safe zones.
- **Elsewhere:** a place with an event gets one Event here line (48 tall, navy edge, a small star: "Event here Saturday"); with the Events filter on and none left, a small notice says No events coming up with Show places again (`EventsEmptyNotice`); the list view puts an "Events · N" section above the places (rows 64 tall, a 28-pixel orange disc with a navy star).
- **Wording:** badge Starts in 2 days, Happening now, ends in 1 hour, This event has ended, Cancelled; sections When, Where, About, What to bring (Cuándo, Dónde, Acerca del evento, Qué llevar); the action button says what the link is for (Visit website, Sign up, Get tickets, RSVP, Volunteer, Donate); Get directions (Cómo llegar).

### Blessing box card (BoxCardBody)

`src/components/BoxCardBody.tsx`, `src/components/BoxCheckinPanel.tsx` (check-ins and photos), `src/components/PhotoViewer.tsx`, `src/lib/blessingBoxes.ts` (status colors), `src/components/AdoptBoxForm.tsx`, `src/components/BoxAlertSignupForm.tsx`.

- **Status:** Live as is. R3: Blessing Box in raspberry words on its own line under the name; R4: Share and Save on the left of their own row above the name, no Call or Website; on a computer, History and the × share one line above the photo with no rule under it; R1 on the check-in buttons, Cancel and the needs tags.
- **For:** a little free pantry on a post: how full it is, what it needs, and a one-tap way to say you filled it, took something or found it empty. Everything happens on the card, never on a separate page.
- **Layout:** computer (`layout="default"`): the photo first (170 tall, edge to edge) with the status pill on it, then the sponsor band, the action row (Share, Save), name, label, address, most needed, host note, check-in, footer (History is on the panel's top line with the ×). Phone (`layout="sheet"`): action row, name, label, the status pill inline under the name, address, most needed, host note and the check-in panel all above the fold; the photo, sponsor band and History / Email me footer below it.
- **Parts:** status pill: a colored dot and the status word in its color, then "· filled 2 hours ago" in `ink-500` (`bone-50` chip on the photo, `bone-100` without one). The address is the walking-route link (`sage-600` underlined, no icon). Most needed as `bone-100` chips. The check-in question in Fraunces 18. Sponsor band: `clay-100` / `clay-700` "This box needs a sponsor", or `sage-50` / `sage-700` "Sponsored by …", both with Want to help too? Check-in buttons white with a `bone-300` edge, at least 48 tall, corners 10.
- **Wording:** Stocked, Running low, Empty, Unknown, Out of service (Surtida, Quedan pocas cosas, Vacía, Desconocido, Fuera de servicio); Please update this box; I filled it, Running low, It's empty, I used this box, Add a photo, Report a problem; Sending…; Thanks for filling it!; Photos are reviewed before they're shown publicly. Please don't include faces or license plates.
- **Everyone:** while one check-in sends, all wait; thanks and errors are read out; the photo opens in a native `<dialog>` (`showModal()`, full screen on a near-black scrim, a 48-pixel round close, Escape closes, focus returns by `previouslyFocusedRef`).

### Menu panel (HamburgerMenu)

`src/components/HamburgerMenu.tsx` (the phone shell: place, dim, focus trap, Escape, scroll lock), `src/components/HamburgerMenuContent.tsx` (the lines, Saved, the sponsor and donate cards), `src/components/HamburgerMenuItem.tsx`, `src/components/LanguageToggle.tsx`, `src/components/StyxCredit.tsx`; on a computer the same content shows in `src/components/DesktopSidePanel.tsx`.

- **Status:** Live as is (R1 on menu lines, saved rows and the ×; R2 on the ×, the sponsor card and the donate card).
- **For:** everything that isn't on the map. Menu opens it; Saved opens the same panel with only saved places. On a phone it slides in from the right (80% wide, up to 384, full height, over ink at 40%, the bottom bar unmounted; 300 ms in and 250 ms out on `--ease-out-circ` with the dim fading, no slide with reduced motion; see Animation); on inside pages from 768 wide it's a 280-pixel dropdown; on the map from 768 it's the side panel.
- **Parts:** first the sponsor card (`sage-100`, `sage-500` edge, `radius-lg`, SPONSORED BY in 11-pixel `ink-500` over Pueblo Food Project in `sage-700`, new tab); then the Donate card (white, `bone-300` edge, `radius-lg`, a `Heart` in a `clay-100` circle, Donate over a small line, `ExternalLink`, opens the Pueblo Food Project's donation page). Never "sponsor" for money: on this site sponsor means looking after a blessing box. Lines at least 48 tall, 24-pixel sides, 14-pixel medium `ink-700`, a trailing 14-pixel `ink-400` icon. A place opened from Saved on a computer shows a `sage-700` "← Saved" button.
- **Wording:** List view (or Map view), Learn how to use this map, Show welcome screen, Suggest a place, Share an event, Send us feedback, About this map, Browse all places, Blessing box activity, Food help programs, Roadmap; Saved places; No saved places yet; Language / Idioma.
- **Everyone:** on a phone focus moves in and stays, and returns to Menu or Saved on close; on a computer it isn't a trap.

### Location help card and the welcome screen (LocationHelpCard, SplashScreen)

`src/components/LocationHelpCard.tsx`, `src/components/SplashScreen.tsx`, `src/components/Wordmark.tsx`. The same orange button is Show N places in `src/components/FilterPanel.tsx`.

- **Status:** Live as is (R1 on the card's ×, See all places as a list and the welcome screen's Take a tour; R2 everywhere). Orange buttons get no hover change (owner, approved on review).
- **Welcome screen:** a full-screen layer (`z-[9000]`) over the live map on a frosted scrim (see Map chrome). A centred column up to 820 wide: the wordmark, a navy purpose line (`text-2xl md:text-3xl font-semibold`), `ink-500` small print, then the orange buttons: full width, about 50 tall (18-pixel words, 16 above and below, 32 at the sides; 16 for the Spanish one below 640), corners 10, 12 apart. Take a tour: 48 tall, a 2-pixel sage edge, `sage-700` words.
- **Location help card:** shown when the phone won't share its location: a `bone-100` card above the bottom bar, 12 in from the sides, 6 above the bar (420 wide on a computer), corners 14, a 4-pixel `sage-600` band along its top, level 2, a `sage-600` `MapPin`, a Fraunces 18 navy title, 14-pixel `ink-700` words, a 48-pixel round × , fully round 48-tall buttons. Location is off (refused): an outlined See all places as a list and a settings hint, no Try again. We couldn't find you (timeout): the orange Try again first. `role="status"`, no focus steal; it hides while any panel is open.
- **Wording:** Find food near me / Encuentra comida cerca de mí (tapping one also picks the language); We only use your location to show food nearby. Nothing is saved.; the card titles and lines are in the Finding food near me pattern.

### Page top (PageNav)

`src/components/PageNav.tsx` (`PAGE_NAV_CLEARANCE` keeps the page end clear of the bottom bar); the column and title in `src/components/AboutContent.tsx`, `VenuesDirectoryContent.tsx`, `ResourcesContent.tsx`, `HubPages.tsx` (`HubShell`), `SuggestPageContent.tsx`, `FeedbackPageContent.tsx`, `ReportPageContent.tsx`, `ShareEventPageContent.tsx` (all in `src/components/`).

- **Status:** Live as is.
- **For:** the top of every inside page the Menu opens: a 48-tall bar with one link, ← Back to map (Volver al mapa), `sage-600` 14-pixel medium, a `bone-200` line under it; then the page title in Fraunces in the 512-pixel column. The same bottom bar as the map sits at the foot: Menu and Saved open over the page, Near me returns to the map locating (`/?near=1`), Boxes returns filtered to boxes (`/?boxes=1`), Help is highlighted on its own page.
- **Use something else when:** the map (no page top); an event page (its own breadcrumb top); Not found (no bars).
- **Sizes:** title 30 (36 line) on content pages, 24 (32 line) on form pages; on a form page one `ink-500` line sits 4 under the title, then 32 before the form. Blocks 48 apart.
- **Everyone:** a navigation landmark called Page; Back to map is the first Tab stop; the title is the only top-level heading.

### Site footer (SiteFooter, StyxCredit)

`src/components/SiteFooter.tsx` (`LINK_CLASS`), `src/components/StyxCredit.tsx` (also at the foot of the Menu).

- **Status:** Live as is.
- **For:** the quiet links at the foot of every inside page (map, place lists, hub pages, About, Privacy, Suggest, Roadmap, the OpenStreetMap credit) and the build credit. It is how search engines reach every place page, because the map's links exist only once its code runs. The map has no footer.
- **Sizes:** a `bone-200` top line, the 512 column, `text-xs ink-400` links (`ink-700` under the pointer), each at least 48 by 48, 16 apart side by side, rows `gap-x-4` in a `py-2` column; the credit line under them, full width. The credit link sits in a sentence and keeps the sentence's size.
- **Wording:** each link is the page's short name; the credit reads "Designed, built and managed by The Styx Group" word for word (Diseñado, creado y administrado por The Styx Group); "Place data includes © OpenStreetMap contributors" is a licence requirement, never shortened.

### Language switch (LanguageToggle)

`src/components/LanguageToggle.tsx`, placed on the Menu's Language / Idioma row (`src/components/HamburgerMenuContent.tsx`).

- **Status:** Live as is (#917 round 3: rebuilt as the design system's two-way slider, the owner ruling "sliders for a two- or three-way switch"; it was a 28-tall `bone-100` pill whose EN and ES sat at different heights on mirrored pages, where one part is a link and the other a button). R1 on the part you aren't reading; R2: `SEGMENT_CLASS`'s `PRESS_FEEDBACK` is the press dim only.
- **For:** English and Spanish. The slider from `docs/design/design-system/mock.css` (`.rs`, `.thumb`): a `bone-200` track, corners `radius-lg`, 4 padding; a `sage-600` (primary) thumb, corners `radius-md`, a soft shadow, behind the part you're reading, whose word is `bone-50`; the other word `ink-700`, with the sage 100 hover fill. The thumb slides between the two in 250 ms on `--ease-out-circ` (R5), none with reduced motion. On a mirrored page the other language is a full page load: the thumb moves to the tapped word at once, so it slides while the next page loads, and goes back if the browser restores the page from its back/forward cache. It lives in the Menu, never on the map.
- **Use something else when:** two or three choices inside a form (a slider of real radios); the event page (one link to the other language).
- **Sizes:** 104 by 48 overall; each part 48 wide and 40 tall (`w-12 h-[40px]`), the same box whether it is a link or a button (`inline-flex`, centered, words 14-pixel semibold on a fixed 20-pixel line, so nothing shifts on hover, press or switch); each taps at 48 by 48 (the tap area reaches the track's 4 padding above and below; the two meet in the middle).
- **Wording:** EN and ES, never flags. Heard as Language: English, Language: Spanish, in a group called Language selection; the part you're reading is pressed (on a mirrored page, the link to the other language is a link, and the current one is marked current).

### Hub page list rows (HubPages, VenuesDirectoryContent)

`src/components/HubPages.tsx` (`PLACE_LINK_CLASS`, `DETAIL_CLASS`, `PlaceItem`), `src/components/VenuesDirectoryContent.tsx`, `src/lib/hubPages.ts` (which places show and in what order).

- **Status:** Live as is. On the SNAP and WIC stores page only, the category and SNAP and WIC join as the R3 label under the address (`CategoryLabel`, in `SnapWicHub`). The other hub pages and All places stay as they are.
- **For:** a plain list of places: the name as a big `sage-600` link to the place's page (`sage-700` under the pointer), its address, then one line of hours or what it takes, all `ink-500` 14-pixel. No pictures, no map, so it loads fast. Food pantries, SNAP and WIC stores, Community gardens, Blessing boxes and All places use it; blessing box names open the box's card on the map.
- **Sizes:** rows 16 apart; the name Public Sans 16 semibold, at least 48 tall to tap on the hub pages; section headings 18 semibold.
- **Wording:** hours as a sentence on hub pages (`Hours: Tuesday to Wednesday, 9am – 1pm`); the short form on All places; with no hours, "Hours not listed. Check before you go." Never guess hours. SNAP or WIC only when confirmed. Blessing boxes never say free.

### Questions and answers (FaqList, FaqSection)

`src/components/FaqList.tsx`, `src/components/FaqSection.tsx` (the pantry page: the same block plus the search-engine copy, built from the same list), `src/lib/faqItems.ts`.

- **Status:** Live as is.
- **For:** a short block of common questions near the end of About, Food help programs and Food pantries. Always open. Search engines read the same questions, so every answer must be true and match the page.
- **Sizes:** heading 18 semibold; question 16 semibold, 4 above its answer; answer 14 with `leading-relaxed`; 24 between one answer and the next question. All `ink-700`.
- **Wording:** questions in the visitor's own words ("How often can I go?"); answers start with the answer. About has six questions, the other two four each.

### Public form fields and buttons (PublicForm)

`src/components/PublicForm.tsx` (`Field`, `INPUT_BASE`, the send and Try again buttons, the thank-you, the error box), used by `SuggestForm.tsx`, `ReportForm.tsx`, `FeedbackForm.tsx`, `ShareEventForm.tsx` (all `src/components/`).

- **Status:** Live as is (R1 on Try again). Public form pages keep the line under the title (owner, approved on review); the no-subtitle ruling is for the admin only.
- **For:** every public page form. One shell checks the fields, waits for Cloudflare's Turnstile check, sends, then shows a thank-you or a plain error with Try again, keeping what was typed. The box card forms (`AdoptBoxForm.tsx`, `BoxAlertSignupForm.tsx`) use their own copy of these styles, `PRIMARY_BTN` and `SECONDARY_BTN` from `BoxCheckinPanel.tsx`, and `CardFormTurnstile.tsx`.
- **Field:** a real `<label htmlFor>` (14 medium `ink-700`, 4 above); the box white, `radius-md`, 1-pixel `bone-300` edge, 12 by 8 padding, `ink-900` words, `ink-400` placeholder, 16 on a phone and 14 from 768; focus: `sage-500` edge and ring. Fields 24 apart (`space-y-5`). Required: a `danger` star (`aria-hidden`; the field says required). Error: `danger` edge and a 12-pixel `danger` line under it, `role="alert"`, wired with `aria-invalid` and `aria-describedby`.
- **Send and Try again:** full width, 48 tall, `sage-600`, `bone-50` semibold 16-pixel words, `sage-700` under the pointer, a `sage-500` ring 2 out. While waiting: `opacity-60`, `cursor-not-allowed`, Verifying… then Sending….
- **Error box:** `radius-md`, 1-pixel `danger` edge, white, 16 by 12, `role="alert"`, a 14-pixel medium title and a line, both `danger`. Guidance that doesn't block uses `clay-700`; calm confirmation `sage-600`.
- **Thank-you:** replaces the form: a centred `role="status"` block, a semibold title, a line saying what happens next, one Back to map button.
- **Wording:** labels in two or three words, "(optional)" in the label; the send button says what it sends (Submit suggestion, Send feedback, Submit report, Send for review); the privacy line under every email box.

### Box numbers and activity (BoxNumbersPanel, BoxActivityList, BoxMilestones)

`src/components/BoxNumbersPanel.tsx` (`Row`, `FIELD_LABEL`, `SELECT_CLASS`), `src/components/BoxActivityList.tsx`, `src/components/BoxMilestones.tsx`; shown on `src/components/BoxesActivityContent.tsx` (`/boxes/activity`) and `src/components/BoxHistoryContent.tsx` (`/box/<id>/history`).

- **Status:** Live as is (R1 on Previous and Next).
- **For:** how the boxes are doing in words and plain numbers: counts for a picked period, the latest activity a page at a time, and one or two milestone lines. No charts on purpose.
- **Sizes:** rows 14-pixel label left, 14-pixel medium number right, a `bone-200` line between; activity lines 14 with 12-pixel details, photos 64 square; Previous and Next 48 tall at the two ends of their row; Milestones heading Fraunces 18.
- **Wording:** plain past tense ("Elm Street Blessing Box was filled"), never who, except a sponsor by the name they chose; relative times within a week, then a short date; Previous and Next (Anterior, Siguiente), never Load more.

### Not found page (NotFoundContent)

`src/components/NotFoundContent.tsx`, shown by `src/app/(site)/not-found.tsx` and `src/app/es/not-found.tsx`.

- **Status:** Live as is.
- **For:** a wrong link or a page that has gone: a white card in the middle (`bone-200` edge, faint shadow, `radius-lg`, at most 448 wide), a Fraunces 30 `ink-900` title, one `ink-500` 16-pixel sentence, one `sage-600` button. No top bar, no bottom bar, no footer.
- **Use something else when:** an ended or cancelled event (its page stays up and says so); a load failure on a page that exists (say so on that page).
- **Wording:** Page not found (Página no encontrada); "The page you are looking for doesn't exist or has been moved."; ← Back to map.

### Event page (EventPage, EventFlyer, EventAddToCalendar)

`src/components/EventPage.tsx` (`/event/[id]`, `/es/event/[id]`), `src/components/EventAddToCalendar.tsx`, `src/components/EventFlyer.tsx`.

- **Status:** Live as is (R2 on Get directions, Open on the map and Find food on the map; R1 on Add to calendar and Find food on the map).
- **For:** the page one event gets, so it can be shared and found by search engines. Its own top bar: a breadcrumb (Map › name, a long name cut with …) and the same event in the other language (Ver en español / View in English). Then the flyer (at most `min(70vh, 32rem)`, loaded at once), the status pill (words only: Coming up, Happening now, This event has ended, Cancelled), the name (`<h1>`, Fraunces 24), Hosted by, the cancel note or ended line, When (with the zone, "Pueblo time"), Where, About, What to bring, then stacked full-width buttons: the orange Get directions (upcoming and live only, 56 tall), the `sage-600` Open on the map, Add to calendar; or, ended or cancelled, a Find food on the map link. Every control at least 48 tall. It reads fine with scripts off; only Add to calendar needs them.

### Admin menu (AdminNav)

`src/components/AdminNav.tsx` (`AdminNav`, `AdminNavSkeleton`), `src/lib/adminNavCounts.ts`, `src/app/(site)/admin/loading.tsx`.

- **Status:** Live as is (#926). R1 on the tabs (the loading skeleton's tabs don't change under the pointer); Add place has no hover change, the press dim and the green keyboard ring (an orange ring was 2.3 to 1 on white).
- **For:** the top of every admin page except sign-in: Pueblo Food Map Admin (Fraunces 24 `ink-900`, the page's one `h1`, `adminNameClass`), Signed in as and the email, one row of tabs (Dashboard, Blessing Boxes, Places, Events; the owner's account also sees Activity) with a `clay-100` / `clay-700` count pill on any tab with work waiting, and Add place, the admin's one orange button, at the end.
- **Use something else when:** a step inside one page (a filter, a sort); a queue that belongs to a tab (its count and its To review filter, not a new tab).
- **Sizes:** white, a `bone-200` line under it, 16 at the sides on a phone and 32 from 640; every tab and Add place 48 tall, corners 10, 14-pixel words (Add place bold); the current tab `sage-600` with `bone-50` words, the others `ink-500` with the sage 100 hover. The row wraps on a phone, never scrolls sideways.
- **Everyone:** a navigation landmark called Admin; the current page is announced, not only shown by its fill. The admin is English only.

### Sign-in (AdminLoginForm)

`src/components/AdminLoginForm.tsx`, `src/app/(site)/admin/login/page.tsx`, `src/components/formClasses.ts`, `src/lib/adminCardStyles.ts` (`signInCardClass`), `src/lib/adminAuthAllowlistPlugin.ts`.

- **Status:** Live as is (#926). Use a passkey is the plain outline button (`ADMIN_SECONDARY_BUTTON`: `bone-300` edge, `ink-700` words, sage 100 under the pointer); the boxes take the admin field look (48 tall, `ink-400` edge); Resend code, Use a different email and Continue to admin without a passkey are links with a 48-pixel tap area and the green ring.
- **For:** the only way in: an email, a 6-digit code, or a passkey once set up. It never says whether an email belongs to an admin.
- **Sizes:** a white card at most 384 wide on bone 50, lifted (level 2), 32 padding (48 from 640), corners 14; boxes 48 tall; Email me a code, Sign in and Use a passkey full width, 48 tall, 16-pixel words.
- **Wording:** each step says what happens next ("We sent a 6-digit code to …. It expires in 10 minutes."); errors say what did not happen or what to do (The code was not sent. Try again. That code didn't match. Try again. That code didn't work. Try again. That code expired. Send a new one.); working words: Sending…, Signing in…, Waiting for passkey….

### Admin cards and boxes (cardClass, summary boxes)

`src/lib/adminCardStyles.ts` (`cardClass`, `cardSlimClass`, `clayNoticeClass`, `failureBoxClass`, `emptyStateClass`, `fieldLabelClass`, the three buttons), `src/components/ToReviewSummaryBox.tsx`, `src/components/BoxesToReviewBox.tsx`, `src/components/WaitingToPublishBox.tsx`, `src/components/SuggestionsBox.tsx`, `src/components/BoxReviewBox.tsx`, `src/components/SourceSwitchPanel.tsx`.

- **Status:** Live as is (#926: every admin card, summary box and notice comes from these strings).
- **For:** the one white card every admin queue item and summary sits in (`cardClass`): `radius-lg`, a `bone-200` hairline, level 1, 16 padding (24 from 640). A summary box is the same card slimmer (`cardSlimClass`, 12 by 16), with one line saying how much is waiting and one green button, 48 tall. The clay box (`clayNoticeClass`: `clay-100`, `clay-500` edge) is the one warm exception: saved changes not on the public map yet, a dead link on a place's edit page, the test site line. A box with nothing in it hides. A group on an edit page (Things to review, Suggestions to review) is a section title over a stack of cards 16 apart.
- **Wording:** the total, then where from ("14 to review · 11 from the data refresh, 3 from the public"); the button says how many it acts on (Approve all 6 date-only updates), and asks first in the on-page confirm.

### Publish bar (PublishPanel, PublishBotStatusBanner)

`src/components/PublishPanel.tsx`, `src/components/PublishBotStatusBanner.tsx`, `src/app/(site)/admin/page.tsx`, `src/app/(site)/admin/places/page.tsx`.

- **Status:** Live as is (#926: Publish is the shared green button, 48 tall; it asks in the green on-page confirm, full width under the sentence; Review changes has a 48-pixel tap area; no long dashes in the bar or the banner).
- **For:** places reach the public map only when someone presses Publish. The white bar says how many places are new, edited or removed and holds the one Publish button; above it a banner follows the change request until it lands, and turns `danger` if it gets stuck. Boxes and events need no Publish. The test site shows a clay line in its place ("Test site: publishing is turned off here", `isProductionWorker()`).
- **Wording:** "2 new, 5 edited, 1 removed since the last publish", or "The public map is up to date"; the confirm asks "Publish 2 new places and 5 edited places to the public map?", says "1 place will be removed." when any are, and "This opens a change request on GitHub that merges on its own."; after, "Published: 7 places pushed, 1 place removed to the public map." and that the map can take a minute; a failure always says whether anything changed ("Couldn't reach GitHub to publish. Nothing was changed. Try again in a moment."; when it can't tell: "The publish didn't finish, so we can't tell whether the map changed. Reload the page to see what's still waiting, then try again."). The banner: "Publish in progress: waiting on PR #7." and "Publish is stuck: merge conflict. PR #42 hasn't merged, so…".

### Change cards (ProposalCard, SubmissionCard, PhotoReviewCard, SponsorRequestCard)

`src/components/ProposalCard.tsx` (`SOURCE_BADGE`, `LANE_BADGE`, the diff, the preview column), `src/components/SubmissionCard.tsx`, `src/components/PhotoReviewCard.tsx`, `src/components/SponsorRequestCard.tsx`; buttons, tags and the name in `src/lib/adminCardStyles.ts`; the reason step's focus in `useAdminStep` (`src/components/AdminConfirm.tsx`).

- **Status:** Live as is (#926). One button height, 48, on all four cards; R1 on Reject, Cancel, Remove photo and Decline; in every Reject, Remove photo and Decline step Cancel comes first, then the red Confirm; Archive this venue asks in the red on-page confirm.
- **For:** one card per thing waiting on a person (a data-check change, a public suggestion or report, a box photo, a sponsor request): tags and when it arrived, what it is, then the decision buttons, yes first.
- **Parts:** tags through `tagClass` (Admin tags and filter chips): calm, attention, quiet, all fully round. The name of the place or box in Public Sans 16 semibold `ink-700` (`cardNameClass`), the address under it 14. The old value crossed out in `clay-700`, an arrow, the new value in `sage-700`. The reason step opens in place of its button (the button stays on the page, hidden): opening puts the cursor in the reason box; Cancel, or Escape inside the step, closes it and puts focus back on the button.
- **Wording:** the yes button says what it does (Approve, Approve rename, Mark done, Keep photo, Approve sponsor, Archive this venue); no is Reject, Remove photo, Decline or Remove, with a Confirm second step; the reason box says "(optional, for your own notes)"; working: only the pressed button changes (Applying…, Approving…, Archiving…). Errors say what did not happen, then Try again: "This change was not applied.", "The place was not archived.", "This suggestion was not rejected.", "This report was not marked done.", "The photo was not removed.", "The request was not declined.", each followed by "Try again.".

### Admin form fields and the save button (formClasses.ts)

`src/components/formClasses.ts` (`inputBase`, `inputBorder`, `labelClass`, `errorClass`, `hintClass`, `requiredMarkClass`, `fieldGroupClass`, `checkboxRowClass`, `checkboxClass`, `ADMIN_PRIMARY_BUTTON`, `ADMIN_SECONDARY_BUTTON`, `saveRowClass`, `cancelLinkProps`), `src/components/AddVenueForm.tsx`, `src/components/EventForm.tsx`, `src/components/EventFlyerField.tsx`, `src/components/HostAlertsAdminPanel.tsx`.

- **Status:** Live as is (#926). Cancel sits beside Save on every admin form; text boxes are 48 tall with an `ink-400` edge; tick boxes sit in 48-tall rows; a two- or three-way choice is a slider.
- **For:** the boxes, labels, errors, tick boxes and the save row every admin form shares (Add a place and its edit page, Add event and Edit event, the flyer, host alert emails, sign-in).
- **Sizes:** a real label (14 medium `ink-700`, 4 above); the box white, `radius-md`, a 1-pixel `ink-400` edge (5.9 to 1 on white; the public field keeps `bone-300`, Known drift), 12 by 8 padding, at least 48 tall, `ink-900` words, `ink-400` placeholder, 16 on a phone and 14 from 768; focus: `sage-500` edge and ring; error: `danger` edge and a 12-pixel `danger` line, and the edge and ring stay red while the box has focus. Tick box 20 pixels with a `sage-600` tick, in a 48-tall row that takes the sage 100 hover. Form pages are one 672-pixel column, title included. Save row (`saveRowClass`): Cancel a third, Save two thirds, both 48 tall, 16-pixel words; on a new or draft event the two thirds hold Save draft (outline) and Publish (green). Reload, in the red box when someone else saved first, is the red outline button.
- **Cancel:** a link that saves nothing, never a submit, so Save stays the form's first submit and Enter saves. On a place's form it goes where Save would land (Places, or the To review list when the form was opened from a review); on the event form it goes to Events. While a save runs it is off: dimmed, out of the Tab order, a click does nothing (`cancelLinkProps`).
- **Wording:** Add venue on a new place, Save changes on an existing one, Save draft and Publish on an event; Saving…; "Cancel", never Back or Discard, beside Save; "(optional)" in the label, in `ink-400`; a red star on required ones; a failed save: "The place was not saved. Try again.".

### Lists and tables (VenueListView, AllBoxesTable, EventsList, EventSubmissionsList)

`src/components/VenueListView.tsx`, `src/components/AllBoxesTable.tsx`, `src/components/EventsList.tsx`, `src/components/EventSubmissionsList.tsx`, `src/lib/adminVenues.ts` (`DISPLAY_STATUS_LABELS`, `DISPLAY_STATUS_KEY`); the table strings (`tableWrapClass`, `tableHeadRowClass`, `tableRowClass`, `tableLinkRowClass`, `tableCellClass`, `tableHeadCellClass`) and `emptyStateClass` in `src/lib/adminCardStyles.ts`.

- **Status:** Live as is (#926). R1 on the filter chips and on every row that links somewhere (Places, Blessing Boxes, Events); Places chips are 48 tall like the Boxes filters (`chipClass`); the Places Category column is the colored category words (R3, `CategoryLabel`), with SNAP and WIC when the place takes them; the public's shared events keep Make it a draft event and Dismiss in one three-dot menu per item; the Boxes Sponsor filter is a slider; every empty list is the shared empty box.
- **For:** every place, box and event in one table each, with chips to narrow it, a search box, and the name (a `sage-700` link with the green ring) as the way into its edit page.
- **Sizes:** the three tables share one look: 14-pixel words, cells 12 by 16, column headings 11-pixel `ink-400` capitals over a `bone-200` line, `bone-200` row lines, corners 14, level 1, a minimum width (680 Places, 560 Boxes, 512 Events) inside a box that scrolls sideways on a phone; a row tints sage 100 under the pointer only if it links somewhere (an archived Places row with no link gets none), and a click anywhere on that row opens its link (`src/lib/rowLinkClick.ts`; the link itself stays the keyboard path). Times and tags stay on one line. Tags through `tagClass`: Draft yellow on Places, `bone-200` on Events, Low yellow and Empty red on Boxes. The Events Edit link sits in its cell as an inline link.
- **Wording:** filters show their count ("To review (12)"); the Boxes Sponsor slider says Any, Has one, Needs one; after a filter: "No places match your search or filters." or "No boxes match these filters.", each with Clear filters (it clears the search words and every chip, not the sort, and puts the cursor in the search box); with nothing at all: "No places yet.", "No blessing boxes yet." with "Add a place with the category Blessing Box and it shows up here.", "No events yet." with a line and Add event.

### Dashboard numbers (DashboardNeedsStrip, KpiCard, DailyBars, BarList, BoxReportsChart)

`src/components/DashboardNeedsStrip.tsx`, `src/components/KpiCard.tsx`, `src/components/DailyBars.tsx`, `src/components/BarList.tsx`, `src/components/DashboardPeriodPicker.tsx`, `src/app/(site)/admin/page.tsx`; `tileCardClass` and `tileLabelClass` in `src/lib/adminCardStyles.ts`. `src/components/BoxReportsChart.tsx` is on the Blessing Boxes page (`src/app/(site)/admin/boxes/page.tsx`), not the Dashboard.

- **Status:** Live as is (#926). R1 and the green ring on the Needs you cards; a number card's change wraps under the number on a 360 phone instead of running past the edge; the time period (7 days, 30 days, 90 days) is a slider, still kept in the address (`?period=`).
- **For:** under the greeting (the page title) and the period slider: four Needs you cards (each a link into its list), then number cards with the change since the last period, and small charts: visitors per day, ranked bars, and, on Blessing Boxes, box reports per week.
- **Sizes:** tiles (`tileCardClass`) `radius-lg`, 16 padding at every width, level 1, 12 apart; labels 12-pixel `ink-500` capitals; numbers 24 semibold `ink-900`; up `sage-700`, down `danger`, always with a + or -; ranked bars `sage-600` on a `bone-100` track, linked names with the green ring; the weekly chart `sage-500` OK and `clay-500` needs attention, week labels 10 pixels. Section titles Fraunces 18 (`h3`), group headings Public Sans 14 semibold (`h4`).
- **Wording:** plain labels (Places to review, Waiting to publish); sampled numbers say "about"; missing numbers show a dash; empty charts say why ("No visitor data yet for this period.").

### On-page confirm (AdminConfirm, useAdminConfirm, useAdminStep)

`src/components/AdminConfirm.tsx` (the box and both hooks). Used by `src/components/ArchiveVenueButton.tsx` (Remove from map, in the Danger zone of a place's edit page), `src/components/PublishPanel.tsx`, `src/components/ToReviewSummaryBox.tsx`, `src/components/ProposalCard.tsx`, `src/components/EventForm.tsx` and `src/components/EventFlyerField.tsx`; `useAdminStep` by the four change cards.

- **Status:** Live as is (#926). All six admin browser pop-ups are now this box; the admin has no `window.confirm` left.
- **For:** asking before an admin action that changes what the public sees or can't easily be undone. The first press hides the button (it stays on the page) and opens the box right where it was: the question naming the thing, a line saying what happens and what doesn't, then Cancel first and the action. Nothing is sent until the action button is pressed.
- **Use something else when:** the step needs something typed (the Reject, Remove photo and Decline steps, and Cancel event's note with Keep event first and the red Confirm cancel event: `useAdminStep` gives them the same focus handling without the box); the action is easy to undo (Hide a check-in, Remove a host email act at once); a public page (the public photo report is still the browser's pop-up, Known drift).
- **Versions:** red (`tone="danger"`: a `danger` edge and the red outline action) for the removals: Remove from map, Archive this venue, Archive event, Remove flyer. Green (`tone="primary"`: a `sage-500` edge and the green action) for Publish and Approve all date-only updates.
- **Sizes:** white, a 1-pixel edge, corners 10, 16 padding, 8 between its parts; the question medium `ink-900`, the line under it 14 `ink-700`; both buttons 48 tall, 14-pixel words, stacked full width on a phone with Cancel on top (at half a phone's width "Remove from map" wrapped) and half the row each from 640. A failure shows as a red line under the buttons.
- **Wording:** the action button names the action, never Yes or OK; on a place's edit page the red button alone under Danger zone says what it does to the public, Remove from map, never Archive or Delete; while it works it says what it is doing (Removing…, Publishing…, Approving…, Archiving…) and neither button can be pressed. Every site's words are in the Confirming a risky action pattern.
- **Everyone:** a group named by its question; opening puts focus on Cancel, so Enter right away is the safe choice; Escape cancels unless it is working; Cancel puts focus back on the button that opened it. Both buttons are `type="button"`, so the box is safe inside a form.

### Three-dot row menu (AdminRowMenu)

`src/components/AdminRowMenu.tsx`, used by `src/components/EventSubmissionsList.tsx`.

- **Status:** Live as is (#926; the owner's ruling: per-row actions in one three-dot menu).
- **For:** a list item with two or more actions: each event the public sent in holds Make it a draft event, then Dismiss in red, last, under a line. Risky choices always go last, whatever order the code passes.
- **Use something else when:** the item has one action (a plain button or link); the row sits inside a scrolling table (the menu does not float out of its box, so it gets cut off); a choice needs the on-page confirm (the menu can't hand focus back to it).
- **Sizes:** the button 48 by 48, corners 10, a 20-pixel `ink-500` three-dot icon, sage 100 under the pointer and while open; the menu under it at its right: white, `bone-200` edge, corners 14, level 2, at least 200 wide; items 48 tall, 14-pixel, `ink-700`, the risky one `danger`.
- **Everyone:** the button is named "More actions for" plus the item's visible name (no sender-typed words in an attribute); Enter, Space or Down open it on the first item, Up on the last; the arrows, Home and End move; Escape and choosing close it and return focus to the button. A choice that can't be used is marked so and does nothing; while the item's own request runs the whole button is off.

### Slider (AdminSegmented)

`src/components/AdminSegmented.tsx`; the Dashboard's copy is `src/components/DashboardPeriodPicker.tsx`.

- **Status:** Live as is (#926; the owner's ruling: sliders for a two- or three-way switch).
- **For:** picking one of two or three short choices, all in view: the Dashboard's period (7 days, 30 days, 90 days, kept in `?period=`), SNAP and WIC on a place's form (Unknown, Yes, No), where an event is (On the map, Other address), the Blessing Boxes Sponsor filter (Any, Has one, Needs one), a host email's language (English, Spanish).
- **Use something else when:** four or more choices (a select, like Sort on Blessing Boxes); several at once (chips, or switches on the public map).
- **Sizes:** a fully round `bone-200` track, 4 padding, 48 tall overall; a `sage-600` thumb behind the chosen word that slides in 250 ms on `--ease-out-circ` (R5; still with reduced motion); each part 40 tall with a tap area reaching 48, 14-pixel semibold, `bone-50` on the thumb, `ink-700` off it with the sage 100 hover. Where it needs a visible caption, an 11-pixel capitals label sits above it (`controlLabelClass`: Sponsor, Language). The public Language switch is the same slider with `radius-lg` corners.
- **Everyone:** real radios in a group with a hidden name (Time period, Accepts SNAP, Sponsor), so the arrow keys move the choice and screen readers hear which is chosen; the ring shows on the part with keyboard focus.

### Admin tags and filter chips (tagClass, chipClass)

`src/lib/adminCardStyles.ts` (`tagClass(tone)`, `chipClass(on)`), used by every admin list and card.

- **Status:** Live as is (#926: one shape for every admin tag; 48-tall chips everywhere).
- **Tags:** fully round, 12-pixel medium, 2 by 8 padding, one line. Six tones, each words on a fill: calm `sage-100` / `sage-700` 7.5 to 1 (OK, Live, Published, New place, the data sources); attention `clay-100` / `clay-700` 7.5 to 1 (Needs a human, Public report, Live · edits waiting, Problem, Cancelled, Suggested new place); quiet `bone-100` / `ink-500` 6.1 to 1 (Removed, Quiet, Archived, Likely noise); neutral `bone-200` / `ink-700` 11 to 1 (Draft on Events); caution `brand-yellow` / `ink-900` 12 to 1 (Draft on Places, Low on Blessing Boxes); danger `clay-100` / `danger` 5.2 to 1 (Empty).
- **Chips:** the quick filters above a list (Places status, source and lane; Blessing Boxes status). 48 tall, fully round, 14-pixel medium, 14 at the sides. Off: white, `bone-300` edge, `ink-700`, sage 100 under the pointer. On: `sage-100` fill, `sage-500` edge, `sage-700` words. One with nothing to show is faded and can't be pressed. They change no address.
- **Wording:** a tag is one or two words; a chip ends with its count ("To review (12)").
- **Everyone:** a chip says whether it is pressed (`aria-pressed`); color is never the only sign, every tag is words.

### Admin error page (admin/error.tsx)

`src/app/(site)/admin/error.tsx`.

- **Status:** Live as is (#926).
- **For:** an admin page that fails to load (a database read that throws, for example). It replaces the whole page, menu included, in the admin's look: "This page didn't load" (Fraunces 20, the page's `h1`), "Nothing was changed. Try again, or go back to the Dashboard.", a green Try again and a Go to the Dashboard link with a 48-pixel tap area.
- **Use something else when:** an action failed on a page that loaded (its red line or box, on that page); the person is signed out (they are still sent to sign-in; this page never catches that); the address is wrong (Not found).
- **Behaviour:** Try again reloads the page, because only a reload asks the server again. It never shows the error's own text, which can carry internal details.

## Do's and Don'ts

**Do:**

- Make everything you tap at least 48 by 48 pixels. A smaller drawing gets an invisible tap area around it; never shrink the look to hit the number.
- Build for a 360-pixel phone with the browser's address bar showing, and for Slow 4G.
- Keep one orange action per screen, with navy words. The event pin and its few named uses are the only exception.
- Use `bone-50` as the page everywhere, ink for words, sage for everything you can press.
- Use the sage 500 keyboard ring: 2 pixels, 2 pixels out from the edge.
- Use the sage 100 hover fill (R1).
- Line up an icon button beside a title with the title's first line, so a two-line title never pushes it to the middle.
- Show the category as colored words under the name (R3).
- Ship every word in English and Spanish, screen-reader names too.
- Back every color signal with words or shape: Boxes on also fills the heart; Hours unknown has its own icon and words.
- Respect reduced motion; animate color, opacity and transform only.
- Keep the map screen's chrome under 10% of the screen when nothing is open.

**Don't:**

- Don't use greys outside the bone and ink palettes, or any stock Tailwind color (`gray-500`, `blue-50`, `red-600`). `npm run lint` (`scripts/check-banned.mjs`) refuses them. Errors are `danger`, never `red-*`.
- Don't use grocery blue (`cat-grocery`) or any category color for a link, a button or a state.
- Don't use orange for a second action, a hover, a label or words on a light color. Don't use yellow for anything but support and classification badges.
- Don't brighten or dim on hover (`filter: brightness()`); see R2.
- Don't use Fraunces for running text at 16 pixels or smaller, buttons, badges, labels or form boxes.
- Don't use a CSS drop-shadow filter on anything drawn on the map; the pin shadow lives in the SVG.
- Don't add decorative pictures, a gradient, a card inside a card, a dark mode (`color-scheme: light` is set) or a sidebar beside the map.
- Don't add colored edge stripes. Two live ones break this rule and are listed in Known drift: today's line in the hours and the location help card's top band.
- Don't put a long dash in anything a person reads (see Wording).
- Don't treat clay as unused: it is the warm attention color (the saved star, needs a sponsor, Waiting to publish, the outside-the-county note), never a third action color.

## Icons

**The set: Lucide** (`lucide-react` 1.65.0, ISC licence). Each icon is imported by name, so only the 44 the site uses reach phones. Simple line drawings on a 24-pixel square, 2-pixel lines with round ends, never filled except where a fill means something (a saved star, Boxes on). An icon helps people find the words faster; it never replaces them. The licence notice travels with the package: `node_modules/lucide-react/LICENSE` (some icons come from the Feather project, MIT; same file).

**Drawn for this site** (Lucide has nothing close; same 24 grid, round ends):

- **Filters:** three bars, shortest at the bottom, 20 pixels, a heavier 2.2-pixel line (`src/components/SearchBar.tsx`).
- **Boxes:** a small house with a heart; on, raspberry and the heart fills (`BoxHeartIcon`, `src/components/bottomNavShared.tsx`).
- **A place on the map:** Lucide's map pin filled with the category color, a 1.5-pixel white edge, the drawn shadow (`src/components/VenueMarker.tsx`, `src/components/PinShadow.tsx`).
- **An event on the map:** the same pin in orange, a navy edge and a navy star (`src/components/EventMarker.tsx`, `src/lib/eventPins.ts`).

**Which icon means what** (one meaning per icon, one icon per meaning):

| Meaning | Lucide name |
|---|---|
| Near me / found you / working | `locate`, `locate-fixed`, `loader-circle` (one item's three states) |
| Search, Menu, Close | `search`, `menu`, `x` |
| Map view, list of places | `map`, `list` |
| Saved | `star` (filled clay when saved) |
| Where a place is | `map-pin` |
| Call, Hours, Hours unknown | `phone`, `clock`, `circle-question-mark` (never Clock, so no hours never reads as open) |
| Opens another site, Website | `external-link`, `globe` |
| Share, Done (Link copied) | `share-2`, `check` |
| Report a problem | `flag` |
| SNAP, WIC | `credit-card`, `apple` |
| Get directions, Route steps | `navigation`, `list-ordered` |
| Turns and steps | `arrow-up`, `corner-up-left`, `corner-up-right`, `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down` |
| Event links | `calendar-plus` (Add to calendar), `ticket`, `clipboard-check` (Sign up), `circle-check` (RSVP), `hand-helping` (Volunteer), `heart` (Donate), `eye` (Preview) |
| Menu lines | `map-pin-plus` (Suggest), `message-square` (Feedback), `message-square-text` (Text a number), `info` (About), `rotate-ccw-clock` (Box activity), `compass` (How to use the map), `rotate-ccw` (Welcome screen), `lightbulb` (Roadmap), `hand-helping` (Food help programs) |

Eight icons are flagged as one icon with two meanings or two icons for one: the star (saved, and events in orange), `map-pin` (a place, your own location, the arrive step), `hand-helping` (Help and Volunteer), `calendar-plus` (Add to calendar and Share an event), Website drawn two ways (`external-link` on Resources, `globe` on the place card's action row and on events; the place card's See on Plentiful line keeps `external-link` as "opens another site"), and two near twins (`message-square` and `message-square-text`; `circle-check` and `check`). Listed for the owner, not changed.

**Sizes in use today:** 11, 12, 13, 14 (the most used), 15, 16, 18, 20, 24, 28 and 32 pixels; map pins have their own scale (28 and 36 places, 44 and 52 events). A proposed set of five (14, 16, 20, 24, 28) is on the Icons page, waiting on the owner; it is not a rule yet. Write an icon size as a number (`size={20}`), never a size class: `size-5` and `size-6` are 24 and 32 here.

**How to use them:** always beside words or named (an icon-only button has a translated `aria-label`; icons beside words are `aria-hidden`); the color of the words next to it (`currentColor`: `ink-400` for quiet ones, `sage-600` or `sage-700` inside links, `clay-500` for the saved star, raspberry for Boxes on); the tap area is the button, 48 even when the icon is 16; no emoji as icons, anywhere. A new one: search this list first, ask whether words alone would do, and take it from Lucide.

## Animation

Movement only shows what changed: a color fades, a card slides up, the map flies to a place, a live event pulses. Nothing bounces or moves for decoration.

**The tokens** (`src/app/globals.css` `@theme`): `--ease-out-circ` `cubic-bezier(0.32, 0.72, 0, 1)` (quick to start, gentle to stop; the curve vaul uses for its 0.5 s slide), `--duration-fast` 150 ms, `--duration-default` 250 ms, `--duration-slow` 400 ms. The switches, the side panels and the sliders (the Language switch, the admin's `AdminSegmented`) use `--ease-out-circ` by name (the `ease-out-circ` class); the rest of the code uses none of them yet (see Known drift). The switch and side-panel timings are owner rulings: switches slide in 250 ms on `cubic-bezier(0.32, 0.72, 0, 1)` (R5), and the side panels slide in 300 ms and out 250 ms on the same curve (#917 round 3, "way too fast, slow them down a little"). Open, not decided: whether the named tokens become the standard for new work.

**What moves:**

- Color changes on buttons and the hover fill: 150 ms.
- Switches (R5): 250 ms on `--ease-out-circ`, knob and fill together (`duration-250 ease-out-circ`, `src/components/FilterPanel.tsx`).
- The side panels (Filters from the left; the phone Menu and Saved from the right): slide in 300 ms and out 250 ms on `--ease-out-circ`, the dim fading in step (`duration-300` / `duration-250 ease-out-circ`, the opening frame from `starting:` (CSS `@starting-style`)). A closing panel stays mounted, `inert`, until its slide ends, still showing what it showed when it closed (Saved stays Saved, the Filters Events row and count stay) though the parent resets that state on close (`usePresence` and `useLastOpen`, `src/lib/usePresence.ts`), and only when the browser reports `prefers-reduced-motion: no-preference`; with reduced motion it appears and goes at once. The Menu's 280-pixel dropdown on inside pages from 768 wide doesn't slide.
- The phone sheet: vaul's own drag physics and 0.5 s ease, open and close.
- The bottom bar sliding sideways when the side panel opens: 300 ms.
- The map flying to an event: 0.8 s.
- **`pfm-pulse`** (2 s, repeating): the you-are-here dot breathes, scale 1 to 1.2, opacity 1 to 0.7.
- **`pfm-event-ring`** (2.4 s, repeating, #758): two rings half a cycle apart spread and fade from an event pin while it is going on; `transform` and `opacity` only.
- A pin grows a little under the pointer (0.1 s), only where there is a real mouse (`(hover: hover) and (pointer: fine)`), so a phone never keeps one stuck.

**Reduced motion:** one rule in `src/app/globals.css`: under `prefers-reduced-motion: reduce` every animation and transition finishes in 0.01 ms; everything still happens, it just appears. Beyond that: the Near me spinner stops (`motion-reduce:animate-none`), loading words pulse only with motion on (`motion-safe:animate-pulse`), the map, the card's scroll and the guided tour jump instead of fly (`prefersReducedMotion()`, `src/lib/useMediaQuery.ts`), and the event rings become a still halo (the NOW label is words, so nothing is lost).

**Don't:** a brightening or dimming filter on hover (R2; the slight press dim is allowed); anything that moves on its own except the two live signals (you are here, an event on now).

## Wording

- **Plain, warm, second person.** Talk to one neighbor: "Tap the star on any place to save it." No marketing voice, no jargon. SNAP and WIC are fine: that's what people call them.
- **Sentence case** for buttons, headings and labels (Back to map, Show details). Title Case only for proper nouns and the category names as the data spells them (Food Pantry, Blessing Box).
- **Say place, never venue, to the public.** Spanish says lugar. Admin copy may say venue; code keeps `venue`.
- **Verb first on buttons**, saying what happens: Submit suggestion, Remove from map, Show 24 places. Never OK, Yes or Submit alone.
- **Numbers** as digits (Show 12 places, Step 3 of 9); counts after a middle dot (Food pantry · 48); miles to one decimal under 10, whole miles above (`formatMiles`).
- **Times:** place hours lower case with no :00 (9am, Opens at 2pm); event times as on the event card (2 PM, Today 2 PM), always Pueblo time.
- **Punctuation:** a real ellipsis (…), never three dots. Straight apostrophes. An exclamation mark only on a thank-you. **No long dash** in anything a person reads: use a period, a comma or a colon. The one dash is the short one between two times (`9am – 1pm`), and a time range never splits across lines.
- **Errors** say what went wrong and what to do, with a fallback when there is one ("…try again, or email us directly at suggestions@pueblofoodmap.com."). Never vague, never a code, never an apology.
- **Empty pages** say what's missing and how to fill it.
- **Every string ships in English and Spanish** (`src/lib/i18n.ts`, Spanish in `src/lib/i18n.es.ts`). Spanish uses tú (Toca la estrella, Intenta de nuevo), not usted. Spanish runs longer: controls wrap or shorten cleanly at 320 wide.
- **Accessible names are copy too:** `aria-label`s go through the same files and describe the action (Close menu), not the element.

## Accessibility

These hold on every page and are checked before the owner sees anything.

- **Tap size:** at least 48 by 48 CSS pixels, with room so neighbors aren't mis-tapped (WCAG 2.2's 24 pixels is the legal floor, not ours). Enlarge with padding or an invisible `::before` / `::after`, never by shrinking the look. Text links inside a sentence are exempt.
- **Visible focus:** a 2-pixel `sage-500` ring, 2 pixels out (inset on bars and rows), at least 3 to 1 on the paper and on the hover fill. Never remove an outline without replacing it.
- **Native elements:** real `<button>`, `<a>`, `<label htmlFor>`, `<dialog>`, `<dl>`, `role="switch"` on a button. Dialogs trap focus and give it back; side panels on a computer do not trap.
- **Contrast floors:** body words ink 700 on bone 50 (13.7 to 1, past AAA); every other word 4.5 to 1, every edge and icon 3 to 1 against its real background. Write the ratio next to any new color. A control that can't be used is exempt, but it must still say why.
- **Labels on icon-only buttons:** a translated `aria-label`, and a `title` where a pointer is likely.
- **Color is never the only sign:** states have words or shape too.
- **Text boxes 16 pixels on a phone**, so iOS never zooms the page.
- **Announcements:** results, thanks and errors through `role="status"` or `role="alert"`; countdowns that tick (event badges, the strip) are deliberately not live regions.
- **Keyboard order matches the screen.** Half-shown sheet content is out of the Tab order until the sheet opens.
- **Reduced motion** is respected everywhere (Animation).
- **No sideways scroll** at 320 to 390 wide; text never overruns or breaks mid-word.

## Patterns

A pattern is a job that comes up on many pages and uses several components. Words are the live ones, copied from `src/lib/i18n.ts` and `src/lib/i18n.es.ts` unless the row names another file. Numbers and names in them (24 places, Step 2 of 7, a place name) are examples filled into the live templates. Live words that break a wording rule are shown as they are, in code type, and listed under Known drift.

### Page layout: public pages

- **When:** every page the Menu opens. Live as is.
- **Screens:** About this map, All places, Food help programs, Privacy; the hub pages (Food pantries, Blessing boxes, Community gardens, SNAP and WIC stores); the four forms (Suggest a place, Send us feedback, Report an issue, Share an event); the same pages in Spanish under `/es`.
- **Steps:**
  1. Top bar: one link, Back to map. Nothing else.
  2. Title in Fraunces. On a form page one line under it says what the form is for (kept: the no-subtitle ruling is for the admin).
  3. One column, 512 pixels at most, on bone 50. No sidebar, no pictures.
  4. Short sections with plain headings, lists of places, questions and answers.
  5. The site footer, then the bottom bar floating at the foot.

| English | Spanish | Where |
|---|---|---|
| Back to map | Volver al mapa | Top bar of every inside page |
| Know a food resource we're missing? Tell us about it. | ¿Conoces un recurso alimentario que nos falta? Cuéntanos. | Under Suggest a place |
| `Compliments, bug reports, or feature ideas — we want to hear it.` | `Felicitaciones, reportes de problemas o ideas — queremos escucharte.` | Under Send us feedback (breaks the no-long-dash rule) |
| Help us keep this information accurate. | Ayúdanos a mantener esta información actualizada. | Under Report an issue |

- **Don't:** a hero picture and two columns. Pictures cost slow phones data, and a second column fights the map for room.

### Page layout: admin pages

- **When:** every admin page. Live as is (#926). English only.
- **Screens:** Dashboard, Blessing Boxes, Places, Events, Activity (owner only); Add a venue, Edit a place, Add event, Edit event; sign-in has its own one-box page; a page that fails to load shows the admin error page.
- **Steps:**
  1. The Admin menu across the top, counts on tabs with work waiting, Add place at the end. Its Pueblo Food Map Admin is the page's one `h1` (Fraunces 24).
  2. Every page has a title: Fraunces 20, the `h2` (`pageTitleClass`). Section titles are Fraunces 18 (`h3`), a small group heading inside a section Public Sans 14 semibold (`h4`). No line under the title (owner's ruling).
  3. One page body (`pageBodyClass`): 16 at the sides on a phone, 32 from 640, 24 between parts. On a form page everything, title included, sits in one 672-pixel column (`formPageBodyClass`); Activity and the public's shared events use the full width.
  4. Summary boxes (To review, Waiting to publish); an empty one hides.
  5. The list or the form.
  6. The Publish bar on Places and the Dashboard when saved changes are waiting (it sits above the title).

| English | Where |
|---|---|
| Pueblo Food Map Admin | Top of every admin page (`src/components/AdminNav.tsx`) |
| Signed in as … | Under it, with the email |
| Hi <name> | The Dashboard's title |
| Blessing Boxes · Places · Events · Activity | The other list pages' titles |
| Edit <place name> | A place's edit page title |
| Add a venue | The new place page title |
| Add event · Edit event | The event form titles |
| This page didn't load | The admin error page (`src/app/(site)/admin/error.tsx`) |

- **Don't:** a line under the title that says nothing new.

### Forms

- **When:** someone types more than one thing. Live as is (Cancel beside Save is on every admin form, #926).
- **Screens:** public Suggest a place, Send us feedback, Report an issue, Share an event; admin Add a venue, a place's edit page, Add event, Edit event.
- **Steps:**
  1. One box per thing, label above it; "(optional)" in the label, a red star on required ones.
  2. Public forms check on send; each problem shows under its box and focus moves to the first.
  3. The send button says what it sends, reads Verifying… while the human check runs and Sending… while it sends, and can't be pressed twice.
  4. Sent: the form is replaced by Thank you! and what happens next, with Back to map.
  5. Failed: a red box at the top, everything typed stays, Try again under the send button.
  6. Admin: Cancel beside Save, a third of the row, on every form. It saves nothing and goes where Save would land: Places (or the To review list when a place's form was opened from a review), or Events from the event form. While a save runs Cancel is off, so nobody leaves while the save still lands.
  7. Admin, someone else saved first: the red box says so and offers Reload; nothing typed is cleared until Reload.

| English | Spanish | Where |
|---|---|---|
| Submit suggestion | Enviar sugerencia | Suggest a place, the send button |
| Verifying… | Verificando… | Send button while the human check runs |
| Sending… | Enviando… | Send button while it sends |
| Thank you! | ¡Gracias! | Replaces the form once sent |
| Your suggestion has been submitted. We review all suggestions and will add verified places to the map. | Tu sugerencia ha sido enviada. Revisamos todas las sugerencias y agregaremos los lugares verificados al mapa. | Under Thank you! |
| Your email is used only to follow up on your submission. It is never sold or shared. | Tu correo solo se usa para darte seguimiento. Nunca lo vendemos ni compartimos. | Under every email box |
| Save changes | (admin, English only) | A place's edit page (`src/components/AddVenueForm.tsx`) |
| Saving… | (admin) | Admin save button while it saves |
| Cancel | (admin) | Beside the save buttons on every admin form |
| Someone else changed this place since you opened it. Reload to see their changes. | (admin) | Red box at the top, with Reload (`src/app/api/admin/venues/[id]/route.ts`) |

- **Don't:** Save on its own, where the only way out is the browser's back button.

### Errors

- **When:** a box is filled in wrong, a send or save failed, the map can't load. Live as is.
- **Screens:** every public and admin form; the map screen when the map can't load; admin publish, approve, archive, sign-in; an admin page that fails to load (the admin error page).
- **Steps:**
  1. A wrong box: a red edge and a line under it saying what to put in; focus moves to the first.
  2. A failed send or save: a red box at the top says it wasn't sent and offers Try again; public forms also give an email address. What was typed stays.
  3. Too many sends: say how long to wait.
  4. Something can't work on this phone: fall back and say so, not as an error. When the map can't load, the list shows with a plain line.
  5. Admin: the red line or box says what did not happen, then what to do (`failureLineClass`, `failureBoxClass`); it stays on screen. No admin message says "Something went wrong".
  6. Admin, the page itself failed to load: the admin error page says nothing was changed and offers Try again (a reload) and the way back to the Dashboard. It never shows the error's text.
  7. Never a fading pop-up for a failure, never a code.

| English | Spanish | Where |
|---|---|---|
| Please enter a place name. | Por favor ingresa el nombre del lugar. | Under an empty Place name |
| Please enter a valid email address. | Por favor ingresa un correo electrónico válido. | Under an email box |
| Something went wrong | Algo salió mal | Title of the red box on public forms (vague: breaks a rule) |
| Your suggestion couldn't be sent. Please try again, or email us directly at suggestions@pueblofoodmap.com. | No se pudo enviar tu sugerencia. Por favor intenta de nuevo, o escríbenos directamente a suggestions@pueblofoodmap.com. | Under it |
| Too many submissions from this address. Please try again in an hour. | Demasiados envíos desde esta dirección. Por favor intenta de nuevo en una hora. | Too many sends |
| `Couldn't verify you're human — please retry.` | No pudimos verificar que eres humano. Por favor intenta de nuevo. | Under the human check (long dash in English) |
| Map unavailable | Mapa no disponible | Over the list when the map can't load |
| The interactive map can't load on this device, so we're showing the list instead. | El mapa interactivo no se puede cargar en este dispositivo, así que mostramos la lista. | Under it |
| Map needs a connection | El mapa necesita conexión | Offline, with "The list still works." |
| The place was not saved. Try again. | (admin) | A place's form (`src/components/AddVenueForm.tsx`) |
| The place was not removed. Try again. | (admin) | Remove from map, in its confirm (`src/components/ArchiveVenueButton.tsx`) |
| The code was not sent. Try again. | (admin) | Sign-in (`src/components/AdminLoginForm.tsx`) |
| Couldn't load events. Check your connection and try again. | (admin) | Events, with Retry (`src/components/EventsList.tsx`) |
| This page didn't load | (admin) | The admin error page's title |
| Nothing was changed. Try again, or go back to the Dashboard. | (admin) | Under it, with Try again and Go to the Dashboard |

- **Don't:** a code in a pop-up that fades. Nobody can act on it.

### Empty states

- **When:** a list has nothing in it, yet or after a search or filter. Live as is.
- **Screens:** Saved, the list view, the search box, the events list; admin Events, Places, Blessing Boxes, Activity, a box's check-ins and host emails, Dashboard charts.
- **Steps:**
  1. Say what's missing in a short line.
  2. Say how to fill it, or give the one button that does.
  3. After a search or filter, offer the way out: Clear filters, or categories to try.
  4. At most a 28-pixel line icon in `ink-400` above the words. No pictures.
  5. Admin summary boxes with nothing in them hide.
  6. Admin lists show one shared empty box (`emptyStateClass`: white, level 1 like the cards around it, a `bone-200` edge, centred `ink-500` words, 48 above and below); after a filter, Clear filters sits in it, an outline button. Dashboard charts keep a line inside their card.

| English | Spanish | Where |
|---|---|---|
| No saved places yet | Todavía no tienes lugares guardados | Saved, empty |
| Tap the star on any place to save it. It will show up here. | Toca la estrella en cualquier lugar para guardarlo. Aparecerá aquí. | Under it |
| No places match your filters. | Ningún lugar coincide con tus filtros. | List view, nothing left |
| Clear filters | Borrar filtros | The button under it; clears the search words too |
| No matches for "…" | Sin resultados para "…" | Under the search box |
| Try a category instead: | Prueba una categoría: | Above the category buttons |
| No events coming up | No hay eventos próximos | The events list, with Show places again |
| No events yet. | (admin) | Admin Events, with "Add a one-day giveaway, a turkey drive or a pop-up distribution." and Add event (`src/components/EventsList.tsx`) |
| No places match your search or filters. | (admin) | Admin Places after a filter, with Clear filters (`src/components/VenueListView.tsx`); "No places yet." with none at all |
| No boxes match these filters. | (admin) | Admin Blessing Boxes after a filter, with Clear filters (`src/components/AllBoxesTable.tsx`) |
| No blessing boxes yet. | (admin) | With "Add a place with the category Blessing Box and it shows up here." |
| No activity matches these filters. | (admin) | Activity, with Clear filters when the address carries a filter (`src/components/ActivityLog.tsx`) |
| No check-ins yet. · No host emails on file yet. | (admin) | A box's edit page, each with a line saying how it fills |
| No visitor data yet for this period. | (admin) | A Dashboard chart |

- **Don't:** "Results of what? What now?": an empty page with no reason and no way out.

### Waiting and loading

- **When:** anything that takes longer than a blink. Live as is.
- **Screens:** the map loading and Near me locating; every send and save button; a box card loading; the Share an event address and flyer checks.
- **Steps:**
  1. The map loading: a plain `bone-100` block with Loading map… gently pulsing (still with motion off).
  2. A button that started something fades, says what it's doing and can't be pressed twice.
  3. Near me while locating: its icon becomes a spinner, it can't be pressed, a hidden line says Locating…; its word stays Near me.
  4. A spinner only inside the control that started the wait. Never over the whole map, no grey placeholder shapes. The page never jumps.
  5. A real ellipsis (…), never three dots.

| English | Spanish | Where |
|---|---|---|
| Loading map… | Cargando mapa… | Where the map will be |
| Locating… | Localizando… | Hidden line while Near me works |
| Sending… | Enviando… | Every public send button |
| Loading… | Cargando… | A box card while it loads |
| Checking the address… | Revisando la dirección… | Share an event, the address box |
| Adding your flyer… | Agregando tu volante… | Share an event, the flyer |
| Saving… | (admin) | Admin save buttons |
| Approving… | (admin) | Approve all date-only updates |

- **Don't:** a spinner over the whole map, saying nothing.

### Confirming a risky action

- **When:** the action changes what the public sees or can't easily be undone (taking a place off the map, publishing, hiding a photo). Live as is on the admin (#926, the On-page confirm entry).
- **Screens:** every admin site asks on the page: Remove from map, Archive this venue on a change card, Publish, Approve all date-only updates, Archive event, Remove this flyer. The one browser pop-up left is on the public site, a box photo's report (Known drift).
- **Steps:**
  1. The first tap opens the confirm right where the button was, on the page. Never the browser's pop-up.
  2. It names the thing and says exactly what happens and what doesn't.
  3. Two buttons, 48 tall: half the row each from 640 wide, stacked full width on a phone. Cancel first (on top on a phone), so Enter never removes anything.
  4. The risky button names the action: Remove from map, not Yes or OK. Removals are red; Publish and Approve all are green.
  5. While it works it says what it is doing (Removing…) and can't be pressed twice; a failure says what did not happen.
  6. In a Reject, Remove photo or Decline step, too, Cancel comes first and the red Confirm second.

| English | Where |
|---|---|
| Remove <place name> from the map? | Remove from map, on a place's edit page (`src/components/ArchiveVenueButton.tsx`) |
| It will stop appearing on the next publish. Its record is kept, not deleted, and this can be reviewed later. | Under it; then Cancel and Remove from map (Removing…) |
| It leaves the map right away. Its record is kept, not deleted, and this can be reviewed later. | Under it instead, for a blessing box (boxes are live, no Publish) |
| This place is removed from the map. | In place of the button once it is off the map (no Danger zone heading) |
| Archive <place name>? | Archive this venue, on a data change that removes a place (`src/components/ProposalCard.tsx`) |
| It stops showing on the public map at the next publish. Its record is kept, not deleted. | Under it; then Cancel and Archive this venue (Archiving…) |
| Publish 2 new places and 5 edited places to the public map? | Publish (`src/components/PublishPanel.tsx`) |
| 1 place will be removed. This opens a change request on GitHub that merges on its own. | Under it (the first sentence only when places are removed); then Cancel and Publish (Publishing…) |
| Approve all 6 date-only updates? | Approve all on Places (`src/components/ToReviewSummaryBox.tsx`; "Approve 200 date-only updates?" at 200 or more, the most one press sends) |
| These only update the last-verified date. Real changes are not included. | Under it; then Cancel and Approve 6 updates (Approving…) |
| Archive this event? | Archive event, on an event's edit page (`src/components/EventForm.tsx`) |
| It leaves the map and the list of live events, and stays in the admin history. | Under it; then Cancel and Archive event (Archiving…) |
| Remove this flyer? | Remove, under an event's flyer (`src/components/EventFlyerField.tsx`) |
| The event stays. Only the picture is removed. | Under it; then Cancel and Remove flyer (Removing…) |
| Cancel | The safe button, always first |
| Hide this photo and send it for review? (¿Ocultar esta foto y enviarla para revisión?) | Public, reporting a box photo; still a browser pop-up (`src/components/ReportPhotoButton.tsx`) |

- **Don't:** "Are you sure? Yes / No." Nobody knows what Yes does, and the risky button comes first.

### Picking several

- **When:** narrowing the map to several kinds of place, or to open now, SNAP or WIC. The Filters panel is the one place on the site that picks several; no list ticks rows to act on them together. Live as is (every row is a switch, see Filters panel).
- **Steps:**
  1. Filters opens a panel from the left over the dimmed map.
  2. Each switch applies at once; the map changes beside the panel; no Apply step.
  3. The choices stay when the panel closes, and the Filters button counts them.
  4. It closes on the orange Show 24 places, which says what you'll see (the owner kept it in place of Done); the ×, Escape, a tap on the map and a swipe left also close it.
  5. Clear all takes every choice off and leaves the search words alone.
  6. No pop-up after a change: the map is the confirmation.

| English | Spanish | Where |
|---|---|---|
| Filters | Filtros | The search bar button and the panel title |
| Filters, 2 on | Filtros, 2 activos | The button while filters are on |
| Show only | Mostrar solo | Heading over Open now, Accepts SNAP, Accepts WIC |
| Kind of place | Tipo de lugar | Heading over the categories |
| Clear all | Borrar todo | Top of the panel |
| Show 24 places | Mostrar 24 lugares | The orange button that closes it |
| Show 3 events | Mostrar 3 eventos | The same button while Events is on |
| Close filters | Cerrar filtros | The ×, for screen readers |

- **Don't:** an Apply button that holds the choices back. The map should change as you choose.

### Search and filter

- **When:** finding a place by name or narrowing the map, on the map screen and the list view. Live as is.
- **Steps:**
  1. One search bar at the top: the magnifier, the words box, Filters at its right end. No Search button.
  2. Matches show as you type, with a count; the row under them shows every match as a list.
  3. Filters narrow by kind, open now, SNAP and WIC (Picking several).
  4. Map or list: the row under the empty search box, and a line at the top of the Menu.
  5. The view is not in the address: search words, filters and map or list are lost on a refresh and can't be shared. A link can carry one place (`?venue=`), one event (`?event=`), and Near me, Boxes and the tour from inside pages (`/?near=1`, `/?boxes=1`), which are taken out of the address once used. Open: whether the view should go in the address.
  6. Two clears: Clear filters in an empty list clears filters and search words; Clear all in the Filters panel clears filters only.

| English | Spanish | Where |
|---|---|---|
| Search | Buscar | Grey words in the empty box |
| Search places | Buscar lugares | The box's name for screen readers |
| 3 places match | 3 lugares coinciden | Over the matches as you type |
| See all 3 matches as a list | Ver los 3 resultados en una lista | Under the matches |
| See all places as a list | Ver todos los lugares en una lista | Under the empty, tapped-in box |
| Back to the map | Volver al mapa | The same row in the list view |

- **Don't:** a Go button to press before anything happens.

### Finding food near me

- **When:** the first thing most visitors do. Live as is.
- **Screens:** the welcome screen (first visit), the map after the phone answers, Near me in the bottom bar.
- **Steps:**
  1. Welcome screen: Find food near me and Encuentra comida cerca de mí, one orange button per language; a tap also picks the language. Take a tour under them, then the line about location.
  2. The phone asks whether the site may use its location.
  3. Yes: the map moves to you.
  4. No: the card says Location is off and points to what still works (tap a pin, or the list). No Try again, because the phone would say no again. It says where to turn location on.
  5. Tried and couldn't (too long, often indoors): We couldn't find you, with Try again first.
  6. Outside Pueblo County: a small clay note at the bottom of the map.
  7. Near me does the same again, with its spinner. Nothing about the location is saved.

| English | Spanish | Where |
|---|---|---|
| Find food near me | Encuentra comida cerca de mí | The two orange welcome buttons |
| We only use your location to show food nearby. Nothing is saved. | Solo usamos tu ubicación para mostrar alimentos cercanos. Nada se guarda. | Under them |
| Take a tour | Ver cómo funciona | Under the buttons |
| Location is off | Ubicación desactivada | Card title, the phone said no |
| No problem, you can still find food. | No hay problema, aún puedes encontrar comida. | Its first line |
| To use your location next time, turn it on in your browser or phone settings. | Para usar tu ubicación la próxima vez, actívala en la configuración del navegador o del teléfono. | At its foot |
| We couldn't find you | No pudimos encontrarte | Card title, the phone couldn't |
| Your phone took too long to find where you are. This happens a lot indoors. | Tu teléfono tardó demasiado en encontrar dónde estás. Esto pasa mucho bajo techo. | Its first line on a timeout |
| Your phone couldn't work out where you are right now. | Tu teléfono no pudo saber dónde estás en este momento. | Its first line otherwise |
| Tap any pin on the map to see hours and directions. | Toca cualquier punto del mapa para ver horarios y cómo llegar. | Ends both cards |
| Try again | Intentar de nuevo | Couldn't-find-you card only |
| See all places as a list | Ver todos los lugares en una lista | Both cards |
| Your location is outside Pueblo County | Tu ubicación está fuera del condado de Pueblo | The clay note on the map |

- **Don't:** drop the visitor on the map with no explanation. Before the card, more than half of them left (`src/components/LocationHelpCard.tsx` header).

### Getting directions

- **When:** someone picked a place and wants to get there. Live as is (hover changes are in the Direction buttons entry).
- **Screens:** every place card (map and the place's page); the phone's route strip and steps sheet; a box card (the address is the link); an event card (one orange button).
- **Steps:**
  1. Walk, Bus, Drive in one row, the same width, 48 tall.
  2. Walk draws the walking route on our map; it needs the location, and a line says so under the row if the phone won't share it.
  3. On a phone the card shrinks to the route strip: the place, distance and time, Clear walking route, Steps, Show card.
  4. Steps shows one turn at a time with Previous turn and Next turn, a count, the distance to the turn, what comes next, and All turns. Turn words come from the map service in the visitor's language.
  5. Open in Google Maps under the turns.
  6. Bus and Drive open Google Maps in a new tab, starting from where you are.

| English | Spanish | Where |
|---|---|---|
| Walk | Caminar | The route button |
| Bus | Autobús | Opens Google Maps |
| Drive | Manejar | Opens Google Maps |
| Walking directions to <place> (opens on map) | Cómo llegar caminando a <place> (se muestra en el mapa) | Walk, for screen readers |
| Share your location to see walking directions. | Comparte tu ubicación para ver cómo llegar a pie. | Under the row when location is off |
| 0.6 mi walk | 0.6 mi caminando | The route's distance, then · 13 min |
| Clear walking route | Eliminar ruta a pie | Walk while a route is on, and the strip |
| Steps | Pasos | On the strip |
| Show card | Mostrar tarjeta | On the strip |
| Step 2 of 7 | Paso 2 de 7 | Over the current turn |
| In 280 ft | En 280 pies | Distance to the turn |
| You have arrived | Has llegado | The last step |
| Previous turn / Next turn | Giro anterior / Siguiente giro | The two arrows, for screen readers |
| All turns | Todos los giros | Opens the whole list |
| Open in Google Maps | Abrir en Google Maps | Under the turns |
| Get directions | Cómo llegar | The event card's orange button |

- **Don't:** three underlined links in one row. On a real walk nobody found Steps (#537).

### English and Spanish

- **When:** always. Every word a visitor sees or hears has a Spanish twin; the admin is English only. Live as is.
- **Steps:**
  1. Every visible word and screen-reader name lives in `src/lib/i18n.ts` with the Spanish in `src/lib/i18n.es.ts`, never typed into a component. A test checks both have every key.
  2. The welcome screen picks the language with one tap.
  3. The Menu's Language / Idioma row: EN and ES, never flags.
  4. The `/es` pages are fully Spanish, titles too. A visitor on an English page who picked Spanish sees Ver en español → in the Menu; the site never moves them on its own.
  5. Spanish says tú. Spanish runs longer: wrap or shorten at 320 wide, never cut words.
  6. SNAP and WIC stay as they are: they are the programs' names.

| English | Spanish | Where |
|---|---|---|
| Near me · Saved · Boxes · Help · Menu | Cercanos · Guardados · Cajas · Ayuda · Menú | The bottom bar |
| Open now | Abierto ahora | A place card's hours line |
| `Hours unknown — call ahead` | `Horario desconocido — llama antes` | A place with no known hours (long dash: breaks a rule) |
| Link copied | Enlace copiado | After Share |
| Language / Idioma | Language / Idioma | The Menu row, the same in both on purpose |
| Ver en español → | Ver en español → | The Menu, for an English-page visitor who picked Spanish |

- **Don't:** flags. A flag stands for a country, not a language.

## Adding to the system

- **A shared component** is anything used on two or more screens. It gets an entry in Components (status, what it's for, when to use something else, versions and states, sizes, wording, everyone, the file) in the same change that builds it. A one-off stays out, but follows the foundations.
- **Reuse before writing:** check the entries here, `src/lib/interactionStyles.ts`, `src/lib/adminCardStyles.ts`, `src/components/formClasses.ts` and `src/components/PublicForm.tsx` before writing new class strings. Never reference a class or token that isn't defined.
- **A new color or size** goes into `@theme` in `src/app/globals.css` first, then into this file's frontmatter (and the name map in `scripts/check-design-drift.mjs` if it's a new kind), then `npm run design:drift`. Write its contrast ratio next to it.
- **A new floating element** joins an existing rung of the Layering table and is added to that table.
- **A new control on the map screen** follows Safe zones; anything else on the map is a redesign and goes to the owner as a mockup first.
- **A visual change** gets a mockup the owner can see before it is built (the design-system pages, or a preview link). Nothing is final until the owner has seen it.
- **After every edit to this file:** `npm run design:lint` (0 errors) and `npm run design:drift`.

## Low-end device guardrails (#233)

Pueblo Food Map serves people facing food insecurity, who are more likely to be on an average, older mid-range Android on a slower connection than on a new iPhone. Every UI change is checked against this profile before merge, and any new control on the home / map screen must fit a safe zone below.

**Target profile:**

- **Device:** an average mid-range Android, 2 to 3 years old: a modest chip, little memory.
- **Viewport:** design and test at **360 pixels wide**, at short heights with the browser's own bars showing (a real phone loses 80 to 140 pixels of height to them). Chrome DevTools' "Moto G Power" (360 by 740) or a 360 by 640 custom size; not a tall 360 by 800 that never happens with the address bar visible.
- **Network:** **Slow 4G** (DevTools preset, about 400 kilobits a second down, 400 ms or more round trip).
- **Input:** a thumb on glass, one hand.

**Touch targets:** at least **48 by 48 CSS pixels**, spaced so neighbors aren't mis-tapped. WCAG 2.2 SC 2.5.8's 24 by 24 is the compliance floor, not this project's target: 24 passes only with 24 pixels of clear space around it, which a crowded map screen can't promise, and Android and Apple both recommend about 48 / 44 for thumbs. Enlarge a smaller control with padding or an invisible `::before` / `::after`, never by shrinking the look. #659 and #827 brought every public control to 48 except the places listed under Known drift; the wide-screen (1536 and up) bottom bar items stay 44, where a pointer is the norm.

**Thumb reach:** main actions sit low and centred. That is why the bottom bar replaced the old top-left hamburger and the old `top: 72px` locate pill (`docs/bottom-nav-spec.md` §1). Nothing important is pinned to the top corners.

**Browser bars and safe areas** (#530, #536, #541; the settled facts, encoded in `src/app/globals.css`):

- A `position: fixed; bottom: 0` element **already sits fully above iOS Safari's toolbar**, expanded or collapsed, in Safari and Chrome, measured on a real iPhone (#541). Do not add a `100vh - 100dvh` "toolbar reserve" on top of `bottom: 0`: that was #530 and #536's mistake, which lifted bottom chrome 40 to 74 pixels too high and covered the Mapbox logo. `env(safe-area-inset-bottom)` alone is correct, and is all `--bottom-nav-clearance` users add.
- `env(safe-area-inset-bottom)` reads 0 while the toolbar is expanded, so it is an add-on, not a substitute; every bottom-pinned control needs it.
- `100vh` sizes to the largest viewport (toolbar collapsed); `100svh` to the smallest (toolbar expanded) and never changes as the toolbar animates. Anything pinned to the bottom that sizes by height sizes against `--viewport-small` (`100vh`, with a `100svh` override behind `@supports`), never a bare `vh`. The one exception is the phone sheet's height, which matches vaul's `window.innerHeight`-based snap math with `100dvh` (see `src/components/BottomSheet.tsx`).
- `env(safe-area-inset-*)` needs `<meta name="viewport" content="... viewport-fit=cover">`, or the insets read 0.
- Write a plain `vh` fallback line before an `svh` or `dvh` line: an unknown unit drops the whole declaration in older browsers.

**Legibility:** body text stays ink 700 on bone 50. **Any text `<input>` is at least 16 pixels on a phone** (iOS Safari zooms the page for anything smaller); the search bar's input is `text-base` on phones and `md:text-sm` from 768, and every new phone input follows that.

**Page-weight budget:** measured 2026-09-24 against `dev.pueblofoodmap.com`'s `/` (welcome screen and bottom bar, default state; the live map loads lazily behind the welcome screen, #226), 360 by 740, mobile Chrome user agent, Playwright with Chrome DevTools Protocol `Network.loadingFinished` `encodedDataLength` (real transferred bytes), `networkidle` plus a 1.5 s settle:

| Metric | 2026-09-24 | Budget |
|---|---|---|
| Total transfer | 380 KB | **460 KB or less** |
| JavaScript transfer | 287 KB | **340 KB or less** |
| Requests | 32 | not gated (a request spike with a byte spike is the real signal) |

The budget is the measurement plus about 20%. Re-measure the same way (viewport, user agent, host, settle time) before changing either number. No CI gate enforces it yet.

**Weak-phone test loop** (also in `CONTRIBUTING.md`'s pre-ship list): every UI change is checked at 360 by 740 and 375 by 667 in DevTools device mode, with 4x CPU slowdown and Slow 4G, watching for console errors and sideways scroll. A real mid-range Android or iOS Safari is better when one is to hand.

### Safe zones

Measured at 360 by 740, default state (no place open):

```
y=0    +-------------------------------------+
       | Search bar 328x48 at (16,16)        |  top, safe-area-inset-top aware
       |   Filters icon 44x44 at (300,18),   |  (SearchBar.tsx: env(safe-area-inset-top))
       |   48x48 tap area via ::before       |
y=80   +-------------------------------------+
       |                                     |
       |        live Mapbox map              |  Do NOT add floating buttons here.
       |  (pan, zoom and pin taps own it)    |  The old top-centre LocateButton at
       |                                     |  top: 72px was retired for this reason
       |                                     |  (docs/bottom-nav-spec.md 1 and 6).
y=665  +-------------------------------------+
       | Mapbox credits (i + logo), lifted   |  required by Mapbox's terms, not resizable
       | 8px above the bar (globals.css)     |
       | Bottom bar: 5 items, 64 tall, y=665 |  full width already spoken for
y=729  +-------------------------------------+  12px + safe-area-inset-bottom below
```

- **There is no free space on the map itself** between the search bar and the bottom bar. A floating button there repeats the LocateButton mistake (`docs/bottom-nav-spec.md` §6) and risks covering a pin or the Mapbox credits.
- **The two zones that are free:** (1) inside the search bar row, right of Filters, for a control that is really about search: draw it 44 like Filters and give it a 48 by 48 tap area with an invisible `::before`, not a taller bar (the bar is 48 on phones since #233, because an `<input>` can't carry a `::before`); (2) inside the bottom bar as a sixth labelled item, accepting narrower cells (five items are about 57 to 67 wide; about 57 still clears 48 down to 320 wide). A new floating pill anywhere else is a **redesign**: take it to the owner with a mockup first, as Boxes (#516) and Filters (#539) were.
- **The happening-today strip (#761) is an approved exception** (owner-approved mockup, 2026-10-10): directly under the search bar, `absolute` with the bar's gutters, 520 wide from 768 and `rightInset` clearance for the side panel, at `top = max(1rem, safe-area-top) + 56px` on phones and `+ 60px` from 768 (the bar is 48 on phones, 52 from 768; the gap is 8 at both). At 360 by 740 it is y=72 to 120, 48 tall: 6.5% of the height, only while an event is on or later today. Out of flow, so it never shifts the map or jumps when it arrives. It touches none of the search bar, Filters, the Mapbox controls or the bottom bar. z 700: the search popovers (999) drop over it, the card (800) sits above it. It hides while any card is open (a tall sheet reaches `MAP_PEEK_PX`, 100 from the top) and returns when the card closes. Map view only. Any further element at the top of the map needs its own approved mockup.
- A control that must sit on the map (a future zoom control) goes bottom right, stacked above the Mapbox credits with the same `--bottom-nav-clearance` math the credits use; never a top corner, never over the credits.

## Map chrome

- **Mapbox attribution:** see-through (`background: transparent`, `box-shadow: none`, `opacity: 0.8`, `ink-400`), one row: the compact "i" then the logo at 65 by 20 (the smallest size Mapbox's attribution guide lists). Below 1536 wide it is lifted 8 pixels above the bottom bar, from the bar's real position (`env(safe-area-inset-bottom)` + `--bottom-nav-clearance` + 8), so it is never covered.
- **Hover tooltip** (`.pfm-tooltip`): see Map pins.
- **You are here:** the custom `.pfm-user-dot` with `pfm-pulse` replaces Mapbox's blue dot entirely; a "You are here" label shows beside it while the location is known.
- **Welcome-screen scrim:** frosted and see-through, `rgba(182, 172, 139, 0.25)` with `backdrop-filter: blur(4px)` (tunable through `--splash-scrim-opacity` and `--splash-scrim-blur`, which fall back to those defaults). The live map shows faintly behind. `.splash-text-outline` (a 1-pixel white halo in 8 directions) on the wordmark and purpose line, `.splash-text-outline-sm` (0.5 pixel, 4 directions) on the small print; the button words get none.
- **Sponsor credit:** not on the map. "Sponsored by Pueblo Food Project" is the sage card at the top of the Menu.

## Layering (z-index)

One ladder for everything that floats over the map, lowest first. A new floating element joins a rung that's here and is added to this table in the same change; it never gets a number of its own. Small numbers (`z-10`) inside one card only stack things inside it and aren't on the ladder.

| z | What | Where |
|---|---|---|
| 2 | Mapbox's own credits corners (from `mapbox-gl.css`) | `src/components/Map.tsx` |
| 2 / 3 / 4 | Event star pins: coming up, going on now, selected. Place pins use the default stacking, so every event pin sits above them | `src/components/EventMarker.tsx` |
| 700 | The list view; the happening-today strip (never on screen together) | `src/components/ListView.tsx`, `src/components/EventStrip.tsx`, `src/components/MapWrapper.tsx` |
| 800 | The phone sheet | `src/components/BottomSheet.tsx`, `src/components/DirectionButtons.tsx` |
| 900 | The computer side panel; the walking-route strip | `src/components/DesktopSidePanel.tsx`, `src/components/DesktopVenueWindow.tsx`, `src/components/RouteStrip.tsx` |
| 999 | Search popovers: results, no matches, the map / list row | `src/components/SearchResultsPopover.tsx`, `src/components/EmptySearchPopover.tsx`, `src/components/ViewSuggestion.tsx` |
| 1000 | The search bar; the bottom bar at 1536 wide and up | `src/components/SearchBar.tsx`, `src/components/bottomNavShared.tsx` |
| 1001 | The Menu backdrop; the outside-the-county note; the no-events notice | `src/components/HamburgerMenu.tsx`, `src/components/MapWrapper.tsx`, `src/components/EventsEmptyNotice.tsx` |
| 1002 | The Menu panel | `src/components/HamburgerMenu.tsx` |
| 1003 | The bottom bar below 1536 wide, above the Menu so its own button can close it (on phones the full-screen Menu unmounts the bar instead, `src/lib/overlayRegistry.ts`) | `src/components/bottomNavShared.tsx` |
| 1004 / 1005 | Filters backdrop / panel | `src/components/FilterPanel.tsx` |
| 1100 / 1101 | The location help card; the Share an event preview sheet's backdrop and sheet | `src/components/LocationHelpCard.tsx`, `src/components/ShareEventForm.tsx` |
| 9000 | The welcome screen | `src/components/SplashScreen.tsx`, `src/app/(site)/HomePageClient.tsx` |
| 9500 | The guided tour, over everything once the welcome screen is gone | `src/components/GuidedTour.tsx` |
| top layer | The photo viewer: a native `<dialog>` with `showModal()`, above every number by design | `src/components/PhotoViewer.tsx` |

Not checked: the home page's skip links take `z-50` when focused (`src/components/HomeShell.tsx:84`), under the search bar's 1000; whether the bar ever covers them hasn't been looked at in a browser.

## Live surfaces not on shared parts

These are live but not drawn on the design-system pages. They follow the foundations; when one is touched, bring it onto the shared parts and give it an entry if it's used on two screens.

- **Food help programs** open-and-close program cards: `src/components/ResourcesContent.tsx` (its own hand-written sizes on several controls).
- **About and Privacy** page bodies: `src/components/AboutContent.tsx`, `src/components/PrivacyContent.tsx`.
- **The list view** and its place rows: `src/components/ListView.tsx`, `src/components/VenueCard.tsx`; the events section `src/components/EventListSection.tsx`.
- **Share an event** form, its preview sheet (z 1100 / 1101, the navy Preview tag) and address check: `src/components/ShareEventForm.tsx`, `src/components/ShareEventPreview.tsx`, `src/components/ShareEventPageContent.tsx`.
- **The guided tour:** `src/components/GuidedTour.tsx`, `src/lib/guidedTour.ts` (dims to 55%).
- **Box alert pages:** `src/components/AlertsConfirmContent.tsx`, `src/components/AlertsStopContent.tsx`.
- **The map loading block and stand-ins:** `src/components/MapLoadingFallback.tsx`, `src/components/MapScreenStandIn.tsx`, `src/components/MapErrorBoundary.tsx`, `src/components/StaticLocationMap.tsx`.
- **Admin extras:** not drawn on the design pages, but on the shared admin parts since #926 (cards, fields, buttons, tags, the empty box, the slider and the on-page confirm): the owner's activity log (`src/components/ActivityLog.tsx`, `/admin/activity`), `src/components/SourceSwitchPanel.tsx`, `src/components/HostAlertsAdminPanel.tsx`, `src/components/BoxCheckinsAdminPanel.tsx`, `src/components/EventFlyerField.tsx`.
- **The boxes that need love** list on the public Blessing box activity page: `src/components/BoxNeedLoveList.tsx` (public, not admin).

## Known drift

Where the live code differs from the rules above. Fix an item when you're in its file; don't copy it. Line numbers are from the design-system pages (2026-11-08) and may move.

**Names nothing defines** (checked: every `var(--...)` and every class built on our color, font, ease and duration names under `src/`, plus the `pfm-*`, `splash-*` and `nav-*` classes against `src/app/globals.css`):

- `pfm-tooltip--location` (`src/components/Map.tsx:619`) has no CSS rule; the "You are here" label is styled by `.pfm-tooltip` alone.
- No other broken names. `--panel-right-inset` and `--pin` are set at runtime by style props; `--splash-scrim-opacity` and `--splash-scrim-blur` are deliberately unset with fallbacks. `duration-fast`, `duration-default` and `duration-slow` are not classes Tailwind makes from `@theme`; the code doesn't use them.

**Stale claims in the previous version of this file:**

- Map pins do not use CSS `filter: drop-shadow()`: the shadow is drawn in the SVG (`src/components/PinShadow.tsx`, #722).
- Submit buttons are not `h-11`: public send buttons are 48 tall, and so is every admin button (#926; the admin's short set is gone).
- There is not one field style: there are four copies of the same look: `INPUT_BASE` in `src/components/PublicForm.tsx:33-42`, the admin's `inputBase` in `src/components/formClasses.ts` (48 tall with an `ink-400` edge since #926, so it no longer matches the public copies), `SELECT_CLASS` in `src/components/BoxNumbersPanel.tsx:37`, and the inline field classes in `src/components/AdoptBoxForm.tsx:177` and `src/components/BoxAlertSignupForm.tsx:162`.
- The bottom bar's icons are not 24 and 20: `ICON_CLASS = "shrink-0 size-6 2xl:size-5"` (`src/components/bottomNavShared.tsx:86`) measures 32 on phones and 24 on large screens (the spacing trap; its own comment says 24), and the large-screen bar sits 32 up (`2xl:bottom-6`) where the spec says 24.
- Two colored edge stripes break the no-stripes rule: today's line in the hours (`src/components/HoursList.tsx`) and the location help card's top band (`src/components/LocationHelpCard.tsx`). The Hours list entry shows them as live; whether to keep them is not decided. The monospace times in the hours list stay.
- Code comments that point to parts of this file that are gone: "DESIGN.md Forms > Submit" (now Public form fields and buttons) in `scripts/check-banned.mjs:27`; the `filtersButton` component token (now `buttonPrimary` and `switchOn`) in `src/components/RouteStrip.tsx:50`. Also `src/components/EventCardBody.tsx:39` says the action button shows on ended or cancelled cards; the code at `:412` hides it there. And the export list at the top of `src/components/formClasses.ts` calls the `ink-400` text-box edge "3:1 on white"; it is 5.9 to 1 (the comment beside `inputBorder` has it right).

**The spacing trap, live:** `size-6` 32 (`src/components/bottomNavShared.tsx:86`); `h-5 w-5` 24 for route step icons and arrows (`src/components/DirectionButtons.tsx:227`, `:357`); `w-8 h-8` 48 for the Donate heart's circle (`src/components/HamburgerMenuContent.tsx:238`); `h-10` 64 for the thank-you's Back to map (`src/components/PublicForm.tsx:233`); `px-5 pt-5` 24 for the place card's padding (`src/components/VenueCardBody.tsx`).

**Under the 48-pixel floor:**

- Place pins tap at 44: `MIN_HIT_SIZE = 44` (`src/components/VenueMarker.tsx:42`).
- See all matches row 46 (`src/components/SearchResultsPopover.tsx:242`).
- Route strip: Clear walking route and Show card about 32 (`src/components/RouteStrip.tsx:112`), Steps 36 (`:122`), the steps sheet's × 36 by 36 (`:306-308`).
- The event strip's "+2" is `min-w-9`, 36 wide, under 360 (`src/components/EventStrip.tsx:100`).
- Public fields about 42 tall on a phone, 38 on a computer (`src/components/PublicForm.tsx:33`); the box period select about 42 (`src/components/BoxNumbersPanel.tsx:34-38`). Admin fields are 48 (#926).
- Checkboxes: the phone's own 16-pixel box with a row about 20 tall (`src/components/SuggestForm.tsx:36`). Admin tick boxes are 20 pixels in 48-tall rows (#926).
- All places name links about 24 tall, no `min-h-12` (`src/components/VenuesDirectoryContent.tsx:127-133`).
- Not found button 40 tall (`src/components/NotFoundContent.tsx:47`); on a 360 phone its padding (`p-8` 48 and `p-6` 32, `:33-34`) leaves the words about 200 wide.

**Contrast fails:**

- The public text-box edge, `bone-300` on white, 1.6 to 1 where an edge needs 3 to 1: `src/components/PublicForm.tsx:81`, `src/components/BoxNumbersPanel.tsx`, the box card forms. The admin's text boxes moved to `ink-400` (5.9 to 1) in #926; the public forms were outside that work, so the two now differ.
- A Filters switch that's off, `bone-300` on bone 50, 1.5 to 1 (`src/components/FilterPanel.tsx:139`).
- Orange keyboard rings, 2.2 to 1 on bone 50 (`src/components/FilterPanel.tsx:453`, `src/components/SplashScreen.tsx:218`, `:243`). The admin's Add place now takes the green ring.
- Box status words on `bone-100` (the pill without a photo): Stocked 4.4 to 1, Running low just under 4.5 (`src/components/BoxCardBody.tsx:184`, `src/lib/blessingBoxes.ts:430-436`).

**Off the scales:**

- Type: 13, 15 and 18 pixels written by hand on the location help card (`src/components/LocationHelpCard.tsx:154-193`); two title sizes for one job (`text-3xl` in `src/components/AboutContent.tsx:70`, `text-2xl` in `src/components/SuggestPageContent.tsx:33` and `src/components/VenueContent.tsx:121`); the box card forms' 12-pixel labels (`src/components/AdoptBoxForm.tsx:166`) and the period box's 12-pixel label.
- Corners: plain `rounded` (4 pixels) on small things on the public pages (none left in the admin since #926); `rounded-[14px]` by hand; `rounded-t-[20px]` on the share preview sheet (`src/components/ShareEventForm.tsx:552`).
- Shadows: black-based shadows by hand on the side panel (`0 8px 32px rgba(0,0,0,0.18)`, `src/components/DesktopSidePanel.tsx:175`), the Menu (22% and 18%, `src/components/HamburgerMenu.tsx:290`, `:315`) and Filters (22%, `src/components/FilterPanel.tsx:304`); the share preview backdrop at 45% (`src/components/ShareEventForm.tsx:548`). The Menu panel is also `white` and, as a dropdown, an 8-pixel radius.
- Motion: of the four motion tokens only `--ease-out-circ` is used by name, by the switches, side panels and sliders (`src/app/globals.css:96-99`); live color changes are `duration-150` (some 100, the side-panel shift 300) on Tailwind's default curve `cubic-bezier(0.4, 0, 0.2, 1)`.

**Other:**

- The keyboard sees only the browser's outline on box activity's Previous and Next.
- The event page draws its own copy of the flyer (`src/components/EventPage.tsx:124-145`) instead of `src/components/EventFlyer.tsx`.
- The browser's own `window.confirm` still asks on the public site, when someone reports a box photo (`src/components/ReportPhotoButton.tsx:29`). The admin has none left (#926); the public pop-up was outside that work.
- The admin's list filters are not in the address: the Blessing Boxes status chips, Sponsor slider and search, and the Places chips once pressed, are lost on a refresh and can't be shared (only the Dashboard period and the Activity filters are kept). Left out of #926 on purpose; the same open question as the public view (Search and filter).
- Two different things on the event form say Cancel: the Cancel link beside Save (leave the form, save nothing) and the red Cancel event in Danger zone (mark the event cancelled). They sit apart, but the words are the same.
- Admin words that don't yet say what to do: "Visitor numbers are unavailable right now." and "Usage numbers are unavailable right now." on the Dashboard have no Try again; Activity's empty line says "No activity matches these filters." even with no filter set.
- The link preview image (`public/og-image.png`) runs the word Map past the cream half onto the green map under a pin, and has a gradient stripe along its top: it breaks two logo rules.
- The About page's mission sentence has a long dash; the brand note uses a comma there.
- Live words that break the wording rules (vague or a long dash), not rewritten: `Something went wrong` (`src/lib/i18n.ts`, the public forms' red box title and the box alert pages); long dashes in the Send us feedback line, `Couldn't verify you're human — please retry.` and `Hours unknown — call ahead` (both languages). The admin's messages were rewritten in #926: none says "Something went wrong" or uses a long dash.
