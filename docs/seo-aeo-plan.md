# SEO / AEO plan

Status: **draft v2** (2026-09-28). Kyle's decisions are in §6. v1 was written from the code
alone; v2 adds a live audit of pueblofoodmap.com, the non-prod hosts, search
results and competing directories. Nothing here is scheduled yet; each phase
becomes one issue (and, where it's code, one PR into `dev`) once agreed.

**Goal:** when someone in Pueblo County searches, or asks an AI assistant, "where
can I get free food near me / today / that takes SNAP", the answer names a
specific place and cites pueblofoodmap.com. This should work in English and in
Spanish.

- **SEO** is ranking in classic search results (Google, Bing).
- **AEO** (answer-engine optimization) is being the *source* that AI answers
  quote and link to (Google AI Overviews, ChatGPT search, Perplexity, Copilot,
  Claude, Siri). They mostly draw on the same crawls, so SEO is the base layer.
  AEO adds answer-shaped copy, complete facts, fresh dates and third-party
  mentions.

---

## 1. What changed from v1

The v1 plan's direction holds. The live audit changes the **order**: the biggest
problems are not missing schema or missing hub pages, they are that crawlers
can barely reach the venue pages, and that the pages they do reach are missing
the one fact people search for (hours).

| # | Finding (verified live, 2026-09-28) | Impact | v1 had it? |
|---|---|---|---|
| 1 | **The site doesn't appear in web search.** Searches for "pueblofoodmap.com", "Pueblo Food Map", a venue name, and "blessing boxes Pueblo map" return the GitHub repo and PRs, never the site. | Nothing else matters until this is fixed. | No (v1 couldn't reach the web) |
| 2 | **The internal link graph is almost empty in server HTML.** `/` has zero `<a>` links (just an `sr-only` h1 and the map). Venue pages link only to `/`. `/venues`, the only page linking to all 107 venues, is linked from **no** page's server HTML; it's only in the hamburger menu, which isn't in the DOM until opened. `SiteFooter` has no `/venues` link and venue pages have no footer. | Crawlers can find venue pages only via the sitemap, and treat them as orphans (weak ranking, "Discovered – not indexed"). | No |
| 3 | **20 of 33 pantries show no hours at all**; no published venue has `hours_irregular`. Example: Bessemer Mobile Food Pantry's page has an address and a phone number, nothing else. Other sites answer the same query with "2nd Friday, 10 AM–3:45 PM", and list different phone numbers than ours. | The #1 query for a specific place is "[name] hours". Answer engines cite findhelp.org and nwsoco.org instead. | Partly (as a copy problem, not a data problem) |
| 4 | `/boxes` is in the sitemap and **404s** (confirmed). | Sitemap error in Search Console. | Yes |
| 5 | **28 `/box/<id>` URLs are in the sitemap**, but each is a client-side redirect shell ("Loading…", 26 words, no h1, no JSON-LD, self-canonical). | Search Console reports these as redirects or soft 404s; they waste crawl and dilute sitemap trust. | No |
| 6 | **Non-prod hosts are indexable.** `dev.pueblofoodmap.com` and `pueblo-food-map.kyle-boyd.workers.dev` serve `Allow: /` and no `noindex`. Canonicals do point at prod, which limits the damage, but staging carries unpublished data. | Duplicate or incorrect pages can be indexed. | No |
| 7 | The Organization JSON-LD has `sameAs: [pueblofoodproject.org, pueblofoodmap.com]`. Listing itself is a no-op, and there's no `logo` or `areaServed`. | Weak entity signal. | Partly |
| 8 | **No inbound links from the obvious partners.** Pueblo Food Project (the org the map is built for), Pueblo County's food-assistance page and the blessing-box org don't link to pueblofoodmap.com. PFP's own `/foodfinder/` page is currently a **404**. | Authority is the main AEO lever, and it's at zero. | As a to-do only |
| 9 | Crawler access is **fine**. OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, ClaudeBot, GPTBot, Googlebot and bingbot all get 200. Prod `robots.txt` is our own (no Cloudflare managed prefix). | v1 Phase 0.4 is done; drop it. | Was an open question |

What's already good (unchanged from v1): `buildPageMetadata` on every page, self-canonicals (including `/`), a sitemap with `lastmod`, venue JSON-LD with geo and weekly hours, FAQPage on `/about`, ItemList on `/`, a server-rendered `/venues`, and `www` → apex 301.

### Competitive landscape

These are what currently win "food pantry Pueblo" and are cited by AI answers:
feedam.org (36 listings, one page, with hours, requirements and "offers"),
findhelp.org, Care and Share's Food Locator, needhelppayingbills.com, the
Pueblo County food-assistance page, and the Pueblo Star Journal's resources
page. For blessing boxes it's pueblocountyblessingboxes.com, JustServe and
Facebook posts. Our edge is the things they lack: verified dates, a map with
bus directions, live box status, and Spanish. Our gap is completeness of hours
and zero authority.

---

## 2. Target queries

Unchanged from v1. They're the test set for every phase and for measurement (§4).

| Intent | Example queries (EN / ES) | Best landing page after this plan |
|---|---|---|
| Find food now | "food pantry near me Pueblo", "free food Pueblo CO today", "despensa de comida Pueblo" | `/food-pantries` (+ `/es/…` in Phase 4) |
| Specific place | "[pantry name] hours", "[church] food bank Pueblo" | `/venue/[id]` |
| SNAP / WIC | "stores that take EBT Pueblo", "does [store] take EBT", "how to apply for SNAP Pueblo County" | `/snap-wic-stores`, `/venue/[id]`, `/resources` |
| Category | "blessing box Pueblo", "community gardens Pueblo", "soup kitchen Pueblo" | category hubs |
| Area | "food pantry Pueblo West", "food bank 81001" | deferred (see Phase 3) |
| Eligibility | "do I need ID for a food pantry in Pueblo" | `/about` and `/resources` FAQ |

---

## 3. Phases

### Phase 0: Get crawled and measured (one small PR + dashboard tasks, do first)

**Status:** code items 1–4 are built on `claude/seo-aeo-plan-review-ss66kh`
(PR into `dev`). Items 5–8 are Kyle's.

Code (one PR into `dev`):

1. **Give crawlers a path to every venue.**
   - Add `/venues` (and `/resources`) to `SiteFooter`.
   - Render `SiteFooter` on `/venue/[id]`. Replace "← Back to map" with a
     breadcrumb (Home › Food pantries › Name) that has matching
     `BreadcrumbList` JSON-LD.
   - On `/`, extend the existing server-rendered `sr-only` block with a real
     `<nav>`: links to `/venues`, `/resources`, `/about` and one link per
     category. It stays accessible, it's not hidden-text spam (screen-reader
     users get the same links), and the map UI doesn't change.
2. **Clean the sitemap.** Remove `/boxes` and all `/box/<id>` entries. Add
   `noindex` to `/box/[id]`'s metadata (it's a redirect shell by design, per
   REVIEW.md). Add a test that every static sitemap URL resolves to a real route.
   Consider dropping `/suggest`, `/feedback` and `/privacy` from the sitemap as
   well; they're low value but harmless.
3. **`noindex` every non-prod host.** Add an `X-Robots-Tag: noindex` header in
   `custom-worker.ts` whenever the host isn't `pueblofoodmap.com`. Read the host
   from the request; don't add a new var. Deliberately **no** robots.txt
   `Disallow` there: a crawler has to fetch a page to see its noindex, and
   drop anything it already indexed. Add a `deploy-prod.yml` smoke assertion
   that prod does **not** send the header, because a mistake here would
   deindex the whole site.
4. **Organization JSON-LD.** Drop the self `sameAs` and PFP (a different
   organization) from `sameAs`; keep the GitHub repo there. Add `logo` and
   `areaServed: Pueblo County`. Record PFP as the WebSite's
   `sourceOrganization` ("built for and with Pueblo Food Project").

Dashboard and ops (no code):

5. **Search Console and Bing Webmaster Tools** (Kyle, later). Verify via a DNS TXT record in
   Cloudflare, submit the sitemap, and **request indexing** for `/`, `/venues`,
   `/resources` and `/about`. Bing matters because ChatGPT search and Copilot
   use its index. Bing WMT can import from Search Console in one step.
6. **IndexNow**: turn on Cloudflare Crawler Hints (a zone toggle).
7. **GitHub repo description.** It still says "POC", and the GitHub page is
   what search currently shows for our name. Rewrite it as one plain sentence
   about the live service.
8. **Baseline prompt panel.** Ask ChatGPT, Perplexity, Google (AI Overview) and
   Copilot 12 fixed questions from §2. Record who gets cited. Re-run monthly.
   The 2026-09-28 web-search baseline is in §1: we are cited for none of them.

### Phase 1: Complete the facts (admin data work, the highest AEO value)

**Parked:** Kyle is already doing this data pass; nothing here needs a PR. Kept
for context, because Phase 2's summary sentence and Phase 3's by-day pages
depend on it.

No schema or copy can fix a page with no hours. This is admin work in the
existing tools, not a PR.

1. **Hours for the 20 pantries that have none**, including monthly schedules
   via `hours_irregular` (#400 shipped the support). Start with the mobile
   pantries (Bessemer etc.), whose schedules are public on the operators' own
   sites.
2. **Reconcile phone numbers** with the operator's own site where they differ
   (Bessemer: ours differs from BAND's and NeighborWorks'). A wrong number
   costs more trust than a missing one.
3. Publish, then confirm `last_verified` updates. This data work also feeds the
   Phase 3 by-day pages.

Target: ≥ 90% of pantries with hours before Phase 3's by-day pages ship.

### Phase 2: Make each venue page the best answer — live on prod 2026-09-28 (#704)

**Status:** live on prod 2026-09-28 via promotion #707 (PRs #705 and #706, issue #704). Summary
sentence, richer JSON-LD, intent titles, and Nearby all shipped in
`src/lib/venueSummary.ts` — see ARCHITECTURE.md "Answer-first venue pages"
for the mechanism. `hours_irregular` coverage is code-complete but untested
against real data: no published venue has that field set yet (Phase 1 is
still in progress), so that path is covered only by a synthetic fixture.

1. **An answer-first summary sentence**, built only from verified fields. For
   example: *"Bessemer Mobile Food Pantry is a free food pantry at 215 Canal
   St, Pueblo, CO 81004. It's open the 2nd Friday of each month, 10 AM–3:45
   PM. Last verified Sept 2026."* Cover `hours_irregular` in words, since
   JSON-LD can't express it. For stores: *"7-Eleven on West Northern Avenue
   accepts SNAP/EBT."* This answers "does X take EBT" directly.
2. **Richer JSON-LD.** Use the summary as `description` (today every pantry says
   `"Food Pantry in Pueblo, CO."`). Add `sameAs` with the venue's own `url`,
   `isAccessibleForFree` for pantries, meal sites and gardens, SNAP as
   `paymentAccepted` where confirmed, and the breadcrumb from Phase 0. Use a
   more specific `@type` than `LocalBusiness` where schema.org has one.
   Everything goes through `serializeJsonLd`.
3. **Titles with intent terms:** `"{Name} – Food Pantry in Pueblo, CO"`; the
   template appends the brand.
4. **"Nearby" links:** the 3–5 nearest venues of the same category.
5. Show **"Last verified"** near the top, not under "Sources & data".
6. **The 46 convenience-store pages:** keep them indexed (they answer EBT
   questions once item 1 lands), and watch them in Search Console. If most
   stay "Crawled – not indexed" after two months, `noindex` them rather than
   let them drag down site quality.

### Phase 3: Hub pages for the queries people type (one PR)

**Status:** PR A (#709) built `/food-pantries`, `/snap-wic-stores`,
`/community-gardens` (each with an `/es` twin) and the `/resources` FAQ. Items 2
(`/blessing-boxes`) and `/meal-sites` are later PRs. See ARCHITECTURE.md "Hub pages".
Live counts today: 33 pantries, 50 SNAP, 8 WIC (the "49 WIC" below is stale; the
pages compute counts from data).

Static, server-rendered, `buildPageMetadata`, ItemList JSON-LD, a short FAQ,
linked from `/venues`, the footer and the `/` nav block, and in the sitemap.
Verify each on staging (the `staticAssetsIncrementalCache` trap).

1. **`/food-pantries`**: all pantries with the day/time summary from Phase 2,
   and a "how pantries work" FAQ. This is the page meant to beat feedam.org.
2. **`/blessing-boxes`**: a read-only list of live boxes, linking into the map
   card. This is real demand ("blessing box Pueblo"), and it fixes the `/boxes`
   gap properly. **Approved:** REVIEW.md now lists it as a read-only exception
   to the "no separate box page" rule (no check-in, photo or adopt controls).
3. **`/snap-wic-stores`**: the 50 SNAP and 49 WIC venues.
4. **`/community-gardens`** (gardens + edible landscapes), and **`/meal-sites`**
   once there's more than one.
5. **A FAQ on `/resources`** with FAQPage schema: how to apply for SNAP/WIC in
   Pueblo County, what to bring to a pantry, and emergency food today.
6. **By-day pantry pages** ("open Saturday") only after Phase 1 hits its
   coverage target. **Area/ZIP pages are deferred**: at 33 pantries, most areas
   would be thin near-duplicates.

URLs are flat (`/food-pantries`, not `/venues/pantries`); Kyle approved that.

### Phase 4: Spanish that search engines can see — live on prod 2026-09-28 (P1, specced in #689)

**Status:** live on prod via promotion #702 (PR 1 #695, PR 2 #697 + fixes #698).
Kyle released it before the native-speaker `[CHECK]` review; the 139 lines to
review are listed on #689 and are still open. Corrections ship as ordinary
`i18n.ts` PRs.

**Full spec: #689** (two PRs: a root-layout restructure, then the `/es`
tree). Kyle made it P1 on 2026-09-28, so it ran alongside Phases 0–3 rather
than after them. PR 1 (#695) merged to `dev` 2026-09-28: route groups +
shared `RootShell`, no behavior change. PR 2 shipped the `/es` tree itself:
`/`, `/venues`, `/venue/<id>` (all 107), `/resources` and `/about` each have
a Spanish twin under `/es`, server-rendered (`<html lang="es">`, Spanish
`<title>`/description/OG, JSON-LD with `inLanguage: "es"`), with two-way
`hreflang` + `x-default` on both trees and matching sitemap entries. Any
future Phase 3 hub still ships with its `/es` twin in the same PR, per the
original plan.

Summary of what shipped: an `/es/...` mirror of the public pages with
Spanish metadata and JSON-LD (`inLanguage: "es"`) and two-way `hreflang` +
`x-default`, also in the sitemap. The language toggle becomes a real
cross-tree link on a mirrored page; **no server-side redirect on `/`**, so
no `Accept-Language` auto-redirect — a visitor with an `es` cookie on `/`
keeps today's client-side Spanish plus a "Ver en español" link to `/es`.
Prerendered paths roughly doubled (~115 → ~230); `/es` smoke tests and a
`lang="es"` body check are in `deploy-prod.yml`.

**Follow-up (not a PR):** once GSC/Bing are live, confirm the `/es` pages
are indexed, and add 3–4 Spanish questions to the monthly AI prompt panel.
Native-speaker review of the `[CHECK]`-marked Spanish copy the mirrored
pages render (see the PR 2 issue comment on #689) should land before PR 2
promotes to `main`.
(Quote Pueblo County's Hispanic share only from current ACS data.)

### Phase 5: Authority (ongoing, starts in parallel with Phase 0)

The partner links are worth more than any on-page change. In order of value
and likelihood:

1. **Pueblo Food Project.** Its `/foodfinder/` page is a 404 right now. Offer
   pueblofoodmap.com as that page's content or target, and ask for a link from
   `/foodpantries/` and the homepage.
2. **Pueblo County Public Health's food-assistance page**, **Pueblo Star
   Journal's "resources for neighbors in need"** page (already cited by answer
   engines), 2-1-1 Colorado, Care and Share, the library, and PCC/CSU Pueblo
   basic-needs pages.
3. **Pueblo County Blessing Boxes** (pueblocountyblessingboxes.com / RMSER): a
   two-way link, since our map shows their boxes live.
4. **Organization entity:** real `sameAs` profiles once they exist (social, a
   Wikidata item).
The full contact list is in [`seo-outreach.md`](seo-outreach.md). Kyle is
doing the outreach.

5. **`/llms.txt`** (cheap, unproven) and a published **open dataset**
   (JSON/CSV linked from `/about`) to earn reuse and citations.

---

## 4. Measuring it

| Signal | Source | Target |
|---|---|---|
| Brand query ("Pueblo Food Map") shows the site | Google and Bing | #1 within a month of Phase 0 |
| Indexed venue pages | Search Console / Bing WMT coverage | ≥ 100 of 107 |
| Pantries with hours | admin data | ≥ 90% |
| Impressions / clicks for the §2 queries | Search Console, Bing WMT | trending up month over month |
| AI-referred visits (chatgpt.com, perplexity.ai, copilot, gemini referrers) | Cloudflare Web Analytics (never PostHog for unique visitors, per AGENTS.md) | tracked from the baseline |
| Cited in AI answers | monthly prompt panel | most of the 12 questions |
| Rich-result errors | Rich Results Test / Search Console | none |

---

## 5. Guardrails (from AGENTS.md / ARCHITECTURE.md / REVIEW.md)

- `buildPageMetadata` for every page; `serializeJsonLd` for every JSON-LD block.
- New static dynamic-route pages depend on `staticAssetsIncrementalCache`.
  Verify on staging, and add to the `deploy-prod.yml` smoke test.
- No server-side redirect on `/`.
- The non-prod `noindex` must be host-checked and smoke-tested on prod; getting
  it wrong deindexes the site.
- Copy comes only from verified data. Never generate claims (eligibility, "no ID
  needed") about a venue we haven't confirmed.
- Blessing Box interactions stay on the map card (REVIEW.md); a hub page lists
  and links, nothing more.

## 6. Decisions (Kyle, 2026-09-28)

| Question | Decision |
|---|---|
| Search Console / Bing Webmaster Tools | Kyle sets them up later (Phase 0 item 5). |
| `/blessing-boxes` read-only list | Approved; REVIEW.md updated. |
| Flat hub URLs (`/food-pantries`) | Approved. |
| Partner outreach | Kyle, working from [`seo-outreach.md`](seo-outreach.md). |
| Hours / phone data pass (Phase 1) | Kyle, in progress; out of scope for code PRs. |
| Spanish `/es` tree (Phase 4) | **P1**, specced in #689 — live on prod 2026-09-28 (#695, #697, #698 via #702). The `[CHECK]` native-speaker review is still open on #689. |
