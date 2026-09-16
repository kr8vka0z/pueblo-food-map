# Pueblo Food Access Map — Bottom Navigation & View Switch Specification

**Status:** v1.0 — design approved by Kyle 2026-09-16. **Implemented** in #449 (PR to `dev`).
**§5 amended 2026-09-16 by Kyle:** cutover moved from `2xl` (1280px) to `2xl` (1536px) —
at 1280 the pill measured wider than the space beside the search box.
**Author:** Atlas (Claude Opus 5), 2026-09-16.
**Scope:** Replaces the floating navy hamburger button, the orange "Find food near me"
map banner, and the desktop "Pueblo Food Map" wordmark with a single persistent
navigation bar on phone/tablet and an inline navigation row on laptop. Restores the
Map/List switch inside the search box with both labels visible. Adds a fade band so the
Mapbox attribution and the sponsor line stay readable above the bar.
**Deliverable:** Component-level specification precise enough to implement without
further design decisions. Supersedes the mobile chrome described in
`docs/design-spec.md` §5 where the two conflict.

This document is the source of truth for this change. Each section states **the
decision** first, then **the rationale**.

Four decisions in here were never drawn in a mockup and so were never approved:
§4.3 (the switch drops its labels when a category chip is showing on a narrow phone),
§6 (`LocateButton` is deleted outright, not moved), §7 (Saved and Resources scroll the
existing drawer rather than becoming their own pages), and §10 (the bar and the band
both vanish while a venue card is open). Those are the four to read first.

---

## 0. TL;DR

| Surface | Before | After |
|---|---|---|
| Navy circular hamburger (44×44, top-left) | Present at every width | **Deleted at every width** |
| "Pueblo Food Map" wordmark (top-left) | Laptop only | **Deleted** |
| Map/List switch | Inside search box, "List" label hidden below `md` | Inside search box, **both labels visible at every width** |
| Orange "Find food near me" pill | Floating on the map at `top: 72px` | **Retired** — becomes "Near me" in the bar |
| Navigation | Hidden behind the hamburger menu | **Near me · Saved · Resources · Menu** |
| Navigation placement | — | Bottom bar below `2xl`; inline pill right of the search box at `2xl`+ |
| Mapbox mark + sponsor line | Bottom corners of the map | Lifted above the bar, with a soft fade band behind them |

Four changes are load-bearing and must ship together: deleting the hamburger is what
frees the horizontal room for both switch labels; the bar is what replaces the
hamburger's contents; the fade band exists only because the bar is there; and the
credits must move or the bar covers a licence obligation.

---

## 1. Design philosophy for this change

**The decision:** every destination a resident can reach is visible as a labelled
target in the thumb zone. Nothing that matters is behind an unlabelled icon.

**The rationale:** the current design puts the entire navigation — saved places,
assistance resources, language, about, feedback — behind one navy circle with no text
label. The `design` skill's `references/mobile.md` is explicit that a collapsed menu
button needs a visible text label, not an icon alone. A resident under food stress on a
borrowed phone should not have to discover a menu. The bar makes four things permanently
visible and named, and the one remaining collapsed surface ("Menu") carries its own
word.

Secondary: the bottom edge of the phone screen was empty. The locate button was measured
at `top: 72px` on mobile, not bottom-centre, contrary to two stale code comments. The
thumb-reachable region was unused.

---

## 2. Scope — files touched

| File | Change |
|---|---|
| `src/components/BottomNav.tsx` | **New.** The bar (phone/tablet) and the inline row (laptop). One component, two layouts. |
| `src/components/MapWrapper.tsx` | Remove hamburger + wordmark block; mount `BottomNav`; mount the fade band; raise map `padding.bottom`; retire the `LocateButton` mount. |
| `src/components/SearchBar.tsx` | Recompute right padding; drop the mobile `right-12` offset. |
| `src/components/ViewToggle.tsx` | Remove the `sr-only md:not-sr-only` label treatment; add the chip-present icon-only rule. |
| `src/components/HamburgerMenu.tsx` | Keep the drawer, delete its trigger button and its duplicate Map/List row; add an `initialSection` prop. |
| `src/components/LocateButton.tsx` | **Deleted.** Its state machine moves into `BottomNav`'s "Near me" item. |
| `src/components/ListView.tsx` | Bottom padding so the last card clears the bar. |
| `src/components/SponsorCredit.tsx` | Bottom offset clears the bar. |
| `src/app/globals.css` | Mapbox attribution control offset; fade-band custom properties. |
| `src/lib/i18n.ts` | Four new keys, EN + ES. |

No new dependency. No new route. No change to the venue `BottomSheet`, the map itself,
or any data path.

---

## 3. The bottom bar

### 3.1 Geometry and appearance

**The decision:**

```
position: fixed; left: 0; right: 0; bottom: 0;
height: 78px + env(safe-area-inset-bottom)   /* padding-bottom carries the inset */
background: var(--color-bone-50)
border-top: 1px solid var(--color-bone-200)
box-shadow: 0 -2px 12px rgba(26, 24, 23, 0.08)
z-index: 1003
```

Four equal-width flex items. Each is a `<button>` filling its cell (≥ 88px wide at
375px, comfortably past the 44px floor), laid out as a 24px icon above a 12px/700
label, 5px gap, centred.

Colours: inactive `var(--color-ink-500)`, active `var(--color-brand-navy)`.

**The rationale:** 78px is icon (24) + gap (5) + label line (14) = 43px of content with
17–18px of breathing room above and below — the smallest height that does not feel
cramped at a 12px label. `bone-50` rather than white keeps it inside the existing
palette; the hairline and the soft upward shadow are what separate it from the map
without drawing a hard line across the screen.

The safe-area inset is added as bottom padding rather than to `height` so the bar's
content stays at a fixed 78px and the extra space becomes dead zone under the home
indicator, which is what iOS expects.

### 3.2 Items

| Order | Label (EN) | Label (ES) | lucide icon | Behaviour |
|---|---|---|---|---|
| 1 | Near me | Cerca de mí | `locate` | Requests location, flies to it, re-centres if already located |
| 2 | Saved | Guardados | `heart` | Opens the drawer at the saved-places section |
| 3 | Resources | Recursos | `hand-helping` | Opens the `/resources` page *(amended 2026-09-16, see §7)* |
| 4 | Menu | Menú | `menu` | Opens the drawer at the top |

**On "Resources":** the label was "Get help" with a phone-handset icon in an earlier
round. Kyle rejected it — a handset plus "Get help" reads as emergency services. The
section lists 211, SNAP, WIC, Double Up and a hunger hotline, which is assistance
information, not a 911 surface.

**On the icon:** `hand-helping` (3 paths), not `hand-heart` (4 paths). `hand-heart`
was rendered at 21–25px in the mockups and is illegible at that size — the heart
collapses into the fingers. `hand-helping` reads cleanly at 24px.

### 3.3 Active state

**The decision:** a bar item is drawn active **only while its own panel is open**. In
the ordinary map or list view, no item is highlighted.

**The rationale:** these are not four pages. Three of them open the same drawer at
different scroll positions and one is a map action. Lighting one of them permanently
would claim a "you are here" that is not true. When the drawer is open at the Saved
section, "Saved" is active and that statement is accurate.

"Near me" additionally shows a transient state while locating (see §6).

---

## 4. The search-box view switch

### 4.1 Both labels, every width

**The decision:** `ViewToggle` at `size="md"` renders the text label on **both**
segments at every viewport width. The current `sr-only md:not-sr-only` treatment on the
inactive segment is removed.

**The rationale:** the navy hamburger circle occupied 44px at the right end of the
search row and forced the toggle inboard by 48px (`right-12`, documented in
`SearchBar.tsx` as load-bearing, not spacing). Deleting the circle returns that 48px.
Spending it on the word "List" removes the only genuinely ambiguous control on the
phone screen: a bare list glyph beside a map glyph asks the resident to guess.

### 4.2 Positioning and padding

**The decision:**

- `SearchBar.tsx` line ~282: `absolute right-12 md:right-1.5` → `absolute right-1.5`.
- `SearchBar.tsx` line ~243: `pr-[168px] md:pr-[190px]` → **one value at every width.**

**The rationale:** after the first change, the toggle is the same control at the same
6px inset at every width — so it must reserve one number, not two. Today's desktop
already renders exactly that configuration (both labels, `md:right-1.5`) and reserves
190px, so **190 is a value proven in production for this exact control**, and is the
value to write unless measurement says otherwise.

**Required verification before the number is committed:** load dev.pueblofoodmap.com at
1280 wide, read the toggle's real bounding box in both English and Spanish, and set the
padding to that width plus the 6px inset plus ~8px of slack. Then confirm at 375×812, in
both languages, that typed text never runs under the control. The last two layout bugs
in this area (#446, fixed by #448) were both arithmetic that looked right and rendered
wrong — do not ship a computed number here.

### 4.3 The category-chip case

**The decision:** when a category filter chip is showing **and** the viewport is under
400px, the toggle drops its text labels and renders icon-only, keeping the accessible
names via `sr-only`. Above 400px, or with no chip, both labels show.

**The rationale:** at 375px the pill is 343px wide. A chip takes `max-w-[26%]` ≈ 97px
plus 8px of gap, and the toggle reserves ~190px (§4.2), leaving **about 48px** for typed
text — five or six characters. That is an unusable field, so the labels yield in the one
case where the space is genuinely contested. Icon-only drops the toggle to roughly 84px
reserved, which returns the field to ~154px.

```
ponytail: one conditional, not a layout system. The 400px threshold is a measured
floor, not a breakpoint — if the chip's max-width ever changes, re-measure rather than
adjusting this number by eye.
```

### 4.4 The duplicate switch in the drawer

**The decision:** remove the `menu.view` Map/List row from `HamburgerMenu.tsx`.

**The rationale:** the switch is now permanently on screen inside the search box. Two
controls for one piece of state that can disagree visually is a bug waiting to be filed.

---

## 5. Breakpoints

**The decision:** the cutover is Tailwind `2xl` (1536px). *(Amended 2026-09-16 — was `2xl`, 1280px.)*

- Below `2xl`: bottom bar (`2xl:hidden`), fade band, credits lifted.
- `2xl` and above: no bar, no band, credits untouched in their existing corners. The four
  items render as a single white pill to the **right** of the centred search box
  (`hidden 2xl:flex`), matching the search box's height, radius, shadow and background,
  with the icon and label on one line rather than stacked.

**The rationale:** the search pill is a fixed 520px wide and centred, and the nav pill
starts 12px to its right (x = 50% + 272px). Measured on dev.pueblofoodmap.com after #449,
the pill is 387px wide in English and 414px in Spanish. At 1280px only 352px is free
(1280 − 912 − 16), so the original `2xl` cutover overflowed the screen — "Menu" cut off in
English, "Menú" gone in Spanish. At 1536px the pill starts at x1040 and 480px is free, so
both languages fit. At 820px (tablet) the gap is ~134px, so the tablet keeps the bar.
Cost accepted by Kyle: 1280–1535px laptops get the bottom bar.

A single cutover also means there is exactly one place in the codebase where this
decision lives, and it is an existing Tailwind breakpoint rather than a bespoke one.

---

## 6. "Near me" replaces the orange banner

**The decision:** delete `LocateButton.tsx`. Its variant logic moves into the "Near me"
bar item:

| Condition | Bar item shows |
|---|---|
| No permission yet, or permission denied | `locate` icon, label "Near me" — tap requests location |
| Request in flight | spinner in place of the icon, label unchanged, item disabled |
| Located and map centred on the resident | `locate` icon, label unchanged — tap is a no-op re-centre |
| Located and the map has drifted away | `locate-fixed` icon, label unchanged — tap flies back |

The label text never changes. Only the icon does.

**The rationale:** the orange pill was a floating banner sitting on the map at
`top: 72px`, directly under the search bar, in the worst position for a control that
asks for a permission. It also duplicated the splash screen's primary call to action
(`splash.cta.primary`, "Find food near me"), which stays exactly as it is — the splash
is where a first-time visitor is asked, and the bar is where a returning visitor
re-asks.

Keeping the label fixed while swapping the icon means the bar never reflows. A bar item
whose text changes width mid-interaction shifts its three neighbours, which reads as a
glitch.

**The one thing lost:** the orange pill was large, coloured and unmissable, and the bar
item is neither. This is accepted because the splash screen already carries the large
coloured version of the same request, and it is the splash — not the map — that a
first-time visitor sees first.

---

## 7. Saved and Resources reuse the drawer

> **Amended 2026-09-16 by Kyle — Resources is now its own page.** Seen on dev, Resources
> and Menu opened the same drawer and looked like the same button. Resources now links to
> `/resources` (`ResourcesContent.tsx`): one card per program — 2-1-1 Colorado, SNAP,
> WIC, Double Up Food Bucks, the Food Resource Hotline, Everyday Eats — saying what it
> is, what it's good for and how to get it, with call / text / website buttons. The
> drawer's five "Get help" links were replaced by a single "Food help programs" link to
> the same page, and `initialSection` lost `"help"`.
>
> **Amended 2026-09-16 by Kyle — Saved is its own view.** With nothing saved, the Saved
> section didn't render, so Saved opened the plain menu — again the same as Menu. The
> prop is now `view?: "top" | "saved"`. `"saved"` shows only the saved places (tap one to
> open it on the map), or an empty state — "No saved places yet / Tap the star on any
> place to save it" — when there are none; its header reads "Saved places". `"top"` is
> the menu, and no longer lists saved places. The original decision is kept for the record.

**The original decision:** `HamburgerMenu.tsx` keeps its drawer and its contents unchanged. It
gains one prop:

```ts
initialSection?: "top" | "saved" | "help";
```

On open, the drawer scrolls that section into view. Three bar items, one component,
three entry points. No new routes, no new screens, no duplicated content.

**The rationale:** `menu.saved.heading` (#132) and `menu.help.heading` with its five
links already exist, are already translated, and already work. Promoting them to
first-class destinations is a navigation problem, not a content problem. Building
`/saved` and `/resources` pages would mean two new routes, two new layouts, and two more
surfaces to keep in Spanish, to solve a problem that a scroll position solves.

```
ponytail: scroll-into-view is the whole mechanism. Ceiling: if either section ever
grows past a screenful of its own, it wants a real page. Upgrade path is a route per
section, with the drawer delegating.
```

---

## 8. The fade band

### 8.1 Values — strength 1, behind three custom properties

**The decision:** a non-interactive band sits directly above the bar. Its three
adjustable values are custom properties with strength-1 defaults, exactly as
`SplashScreen.tsx` does with `--splash-scrim-opacity` and `--splash-scrim-blur`:

```css
position: fixed;
left: 0;
right: 0;
bottom: calc(78px + env(safe-area-inset-bottom));   /* the bar's full height */
height: var(--nav-fade-height, 92px);
background: linear-gradient(
  to top,
  rgba(182, 172, 139, var(--nav-fade-alpha, 0.20)),
  rgba(182, 172, 139, 0)
);
backdrop-filter: blur(var(--nav-fade-blur, 3px));
-webkit-backdrop-filter: blur(var(--nav-fade-blur, 3px));
mask-image: linear-gradient(to top, #000 0%, #000 30%, transparent 100%);
-webkit-mask-image: linear-gradient(to top, #000 0%, #000 30%, transparent 100%);
pointer-events: none;
z-index: 999;
```

`aria-hidden="true"`. Rendered only below `2xl`, **and only in map mode** — in list mode
the band would be blurring a list of cards for no benefit at a per-frame cost.
`SponsorCredit` is already map-mode-only for the same reason (#129).

**The three presets that were rendered and compared:**

| Strength | `--nav-fade-height` | `--nav-fade-alpha` | `--nav-fade-blur` |
|---|---|---|---|
| **1 — lightest (shipping default)** | `92px` | `0.20` | `3px` |
| 2 — middle | `104px` | `0.30` | `5px` |
| 3 — strongest | `116px` | `0.40` | `8px` |

Kyle's instruction was "let's start with strength 1", so 1 is the default and moving to
2 or 3 is three number changes in one place, not a rebuild.

**The rationale:** `rgba(182, 172, 139, …)` is `bone-450`, taken directly from
`SplashScreen.tsx`'s frosted scrim rather than invented — the app already has a "soften
the map behind text" treatment and this is the same one at lower strength. Three
strengths were drawn and rendered in a real browser; Kyle picked the lightest.

The `mask-image` is what makes the band edgeless. Without it, `backdrop-filter` has a
hard cutoff at `height`, and a 1px line of blur-to-no-blur draws a visible seam across
the map. The mask holds the blur at full strength for the bottom 30% and fades it to
nothing over the top 70%, so there is no edge anywhere.

`pointer-events: none` is not optional — the band covers 92px of map directly above the
thumb zone, and without it every pan gesture that starts there would be swallowed.

### 8.2 Fallback

**The decision:**

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  /* --nav-fade-alpha: 0.30; no blur */
}
```

**The rationale:** without `backdrop-filter` the band is a bare tint and reads as
weaker than intended. Raising the alpha recovers the contrast. Nobody ends up with
unreadable text on either path.

### 8.3 Performance caveat

`backdrop-filter` is recomposited every frame while the map is being dragged. On older
or low-end Android this can cost measurable smoothness. The band is 92px tall and the
blur radius is 3px, so the cost is small, but it is not zero.

**If dragging measurably degrades on a real low-end device:** drop the
`backdrop-filter` line and set `--nav-fade-alpha: 0.30` — that is, ship the §8.2
fallback path to everyone. The gradient alone is a plain paint with no per-frame cost.
Do not attempt to toggle the blur dynamically based on frame timing; that is more
machinery than the problem is worth.

---

## 9. Credits above the bar

**The decision:**

- `SponsorCredit.tsx`: `bottom: 8` → `bottom: calc(78px + 12px + env(safe-area-inset-bottom))` below `2xl`; unchanged at `2xl`+.
- Mapbox attribution: `.mapboxgl-ctrl-bottom-left` gets the same offset in `globals.css`, scoped below `2xl`.
- Both keep `zIndex: 1000`, above the band (999) and below the bar (1003).

**The rationale:** **the Mapbox attribution is a licence condition.** Mapbox's terms
permit repositioning it; they do not permit hiding it. A bar drawn over it is not a
cosmetic problem, it is a compliance problem, and that is why this section exists rather
than being deferred.

The offset pattern is already in the codebase — `MapWrapper.tsx` line ~120 does the same
thing for the bottom-sheet peek bar, and the outside-county alert computes
`bottom: isMobile ? 88 + 12 + 52 : 24 + 52`. This follows that precedent rather than
inventing a second convention.

### Stacking order (below `2xl`)

| Layer | z-index |
|---|---|
| Map canvas and markers | 1–2 |
| Fade band | 999 |
| Mapbox attribution control | 1000 |
| Sponsor credit | 1000 |
| Search bar row | 1000 |
| Bottom bar | 1003 |
| List view | 700 (own stacking context) |
| Venue bottom sheet + scrim | vaul default, above all of the above |
| Splash screen | 9000 |

---

## 10. Interaction with the venue sheet

**The decision:** when the venue `BottomSheet` is open at any detent, the bar and the
band are both hidden.

**The rationale:** vaul renders the sheet modal with a scrim. A navigation bar drawn on
top of a scrim is either unreachable (behind it) or an escape hatch that bypasses the
modal (in front of it). Neither is right. The sheet already hides `SponsorCredit` when
fully expanded for the same reason; this extends the existing rule rather than adding a
new one.

**Map padding:** `MapWrapper`'s map `padding.bottom` increases by the bar's height below
`2xl`, so `fitBounds` and marker-fly animations stop centring results underneath the bar.

**List padding:** the bar persists in list mode, so `ListView` needs bottom padding of
`calc(78px + env(safe-area-inset-bottom))` below `2xl`. Without it the last venue card in
the list is unreachable — it scrolls to the bottom and stops under the bar. This is a
separate fix from the map padding above and is easy to miss, because the list only fails
on its final row.

---

## 11. Copy and translation

Four new keys in `src/lib/i18n.ts`:

| Key | EN | ES |
|---|---|---|
| `nav.nearMe` | Near me | Cerca de mí |
| `nav.saved` | Saved | Guardados |
| `nav.resources` | Resources | Recursos |
| `nav.menu` | Menu | Menú |

`splash.cta.primary` ("Find food near me") is unchanged and stays on the splash screen.
`menu.view` and its two option strings become unused when §4.4 lands; remove them in the
same change rather than leaving dead keys.

---

## 12. Accessibility

| Requirement | How it is met |
|---|---|
| Touch target ≥ 44px | Each bar item is ≥ 88 × 78px |
| Visible text label on every control | All four bar items carry their word; the view switch carries both words (except §4.3, where `sr-only` names survive) |
| Contrast | `ink-500` (`#5F5A52`) on `bone-50` and `brand-navy` on `bone-50` both clear AA at 12px/700 |
| No drag-only interaction (WCAG 2.5.7) | Every bar item is a tap. Nothing added here requires a gesture |
| Decorative layer not announced | Band is `aria-hidden` and `pointer-events: none` |
| Current state announced | The open panel's item carries `aria-current="true"`; the others do not |
| Focus order | The bar is the last landmark in DOM order, inside `<nav aria-label>`, so keyboard users reach the map and the search before it |

The bar is a net accessibility improvement over what it replaces: an unlabelled 44px
navy circle was the sole entry point to every secondary destination in the app.

---

## 13. Tests

In the style of `src/__tests__/SearchBarViewSwitch.test.tsx` — class-and-attribute
contract assertions, since jsdom has no layout engine and cannot measure any of the
geometry above.

1. `BottomNav` renders four items, each with a visible text label.
2. No item carries `aria-current` when no panel is open.
3. Opening the Saved panel sets `aria-current` on Saved and on nothing else.
4. "Near me" is disabled and shows the spinner while `isLocating` is true.
5. The band carries `aria-hidden="true"` and `pointer-events: none`.
6. `ViewToggle` at `size="md"` renders both labels as visible text (not `sr-only`) in the default case.
7. `HamburgerMenu` no longer renders a Map/List row.
8. `SponsorCredit`'s computed bottom offset includes the bar height below `2xl`.

Test 6 is the regression guard for the whole §4 premise — if a future change reinstates
`sr-only` on the inactive segment, that test fails.

---

## 14. Verification before merge

Automated gates:

```
npm run lint && npm run typecheck && npm run design:drift && npm run test:coverage
npm run build
```

`design:drift` is a blocking gate. If any new token is introduced, `globals.css`'s
`@theme` block is canonical and `DESIGN.md` mirrors it — never the reverse.

Manual, on dev.pueblofoodmap.com, because none of the following can be caught in jsdom:

1. **375 × 812, English and Spanish** — the view switch does not overlap the typed text, with and without a category chip active.
2. **375 × 812** — the Mapbox mark and the sponsor line are fully visible above the bar and legible over downtown at zoom 14 (the busiest map area).
3. **375 × 812** — a pan gesture starting inside the band's 92px pans the map.
4. **375 × 812, list mode** — scroll to the very bottom; the last venue card is fully visible and tappable, and there is no fade band over the list.
5. **820 × 1180** — the bar is present, not the inline row.
6. **1536 × 864** — the inline row is present, no bar, no band, credits in their original corners.
7. **Open a venue** — bar and band both disappear; closing restores them.
8. **Real low-end Android, if one is available** — drag the map with the band present and judge smoothness against §8.3.

Kyle sees it on dev before anything is promoted to production.

---

## 15. What this supersedes

- `docs/design-spec.md` §5 (mobile layout) where it describes the top-left hamburger
  and the floating locate banner.
- The stale comments in `MapWrapper.tsx` (file header, and line ~1236) describing the
  locate button as "top-right" and "bottom-center". Both were wrong before this change —
  the measured position was `top: 72px` on mobile — and both become moot when the
  component is deleted.
- PRs #446 and #448 currently on `dev` implement the view switch **without** the fade
  band, without the "Resources" rename, and with the navy hamburger still present. They
  must not be promoted to production as they stand.
