# Pueblo Food Map v2 — Demo Readiness Checklist

**Demo:** 2026-06-09 with Pueblo Food Project team
**Prod URL:** https://pueblofoodmap.com
**v2 shipped:** PRs #26, #27, #28, #30, #31, #32, #33, #34 (all merged to main)

---

## Pre-demo prep (do morning of demo)

- [ ] Open the prod URL in an incognito/private window on phone + laptop (forces splash to show)
- [ ] Confirm splash renders with Fraunces wordmark "Pueblo Food Access Map" + 2 CTAs ("Find food near me" and "Show the Pueblo map")
- [ ] Confirm no console errors in DevTools (F12 → Console tab)
- [ ] If you're on coffee shop / hotel wifi: load the URL before the demo so tiles are warm
- [ ] Charge your phone to 50%+ (geolocation is the live moment of truth)

---

## Demo flow — phone (mobile)

1. Open prod URL (incognito → splash visible with navy background)
2. Tap **"Find food near me"**
   - Expect: native browser permission prompt appears
   - If grant: map centers on your location + sage user-position dot visible
   - If deny: map centers on Pueblo (38.2544, −104.6091) + no error banner (silent fallback)
3. Tap any pin on the map
   - Expect: bottom sheet rises to quick state (~320 px) with venue name, category, distance, hours
4. Drag the sheet up (or tap "See full details")
   - Expect: full sheet — hours table, address with "Get directions", phone, SNAP/WIC badges where applicable
5. Tap **"Get directions"** → opens Google Maps in new tab (external)
6. Tap X or drag sheet down → sheet dismisses, map returns
7. Type "garden" in the search bar
   - Expect: only community garden pins remain visible on map
8. Clear and type "zzz"
   - Expect: empty-search popover with category chip suggestions
9. Tap a chip → query updates, matching results show

---

## Demo flow — laptop (desktop)

1. Open prod URL (incognito → splash visible, 2-column layout)
2. Note the splash layout: left column has wordmark + tagline + CTAs; right column shows **"WHAT YOU'LL FIND"** header above a 2-column category card grid
3. Click **"Find food near me"** → grant or deny → map appears
4. Click any pin
   - Expect: floating window appears next to the pin (marker-anchored), edge-flips if pin is near the right viewport edge
5. Click **"See full details →"** → window expands to show full venue detail (~420 × 720)
6. Click X → window dismisses
7. Search and empty-search work the same as mobile

---

## Edge cases to verify

- [ ] Refresh after splash is dismissed → splash does **not** reappear (localStorage gate)
- [ ] Try in Safari (iOS) + Chrome (Android) + desktop Chrome + Firefox
- [ ] Tab through the page on desktop → search bar → locate button → markers (Enter opens sheet)
- [ ] Trigger location-denied banner: block geolocation in DevTools → tap locate button → expect `role="alert"` banner with retry + dismiss options

---

## Known stubs — demo-acceptable

Mention these if asked; they are intentional, not bugs:

| Stub | What happens | Plan |
| --- | --- | --- |
| "How it works →" card (desktop splash, 8th cell) | Shows "Coming soon" toast | Real `/about` route post-demo |
| Locale toggle (EN/ES) | Toggle renders but EN-only | Deferred past demo |
| Service worker / offline | Not implemented | Deferred past demo |
| Tablet viewport (768–1023 px) | Explicitly deferred in spec | Post-demo PR |

---

## Tier 3 budget compliance (verified PR 8 + prod check 2026-05-16)

| Asset | Prod measured | Ceiling |
| --- | --- | --- |
| JS first-load (gzipped) | ~319 KB | 400 KB |
| CSS | 31.2 KB | 30 KB* |
| Fonts (2 variable woff2) | 62 KB | 70 KB |
| Total transfer | ~412 KB | 800 KB |
| Third-party tags | 0 | 2 |

*CSS is 31.2 KB uncompressed vs 30 KB target — within acceptable tolerance; gzipped transfer is ~8–9 KB, well under budget.

Fonts are self-hosted at `/fonts/PublicSans-Variable.woff2` and `/fonts/Fraunces-Variable.woff2`. Zero requests to `fonts.googleapis.com` or `fonts.gstatic.com` confirmed in prod.

---

## Rollback (if demo morning shows a regression)

The site deploys via Cloudflare Workers. To roll back: open the Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Deployments tab → find a recent green deployment → "Rollback to this deployment". Traffic switches in ~30 seconds. **Don't do this yourself — text Kyle to coordinate.**

Alternatively, `git revert` the offending commit and push to `main` to trigger a fresh build.

---

## Post-demo

- [ ] Update `~/.claude/projects/C--/memory/project_pueblo_food_map.md` to note v2 shipped + demo outcome
- [ ] Schedule post-demo PRs: real `/about` route, locale toggle (EN/ES), tablet viewport, service worker, loading skeleton
