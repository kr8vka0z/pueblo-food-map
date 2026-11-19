# SEO / AEO plan

Status (2026-11-19): **Phases 0, 2, 3 and 4 have shipped; Phases 1 and 5 are ongoing
(Kyle).** The 2026-11-19 review (§8) scores the plan against real Search Console
data and lists what to do next. Kyle's decisions are in §6. v1 was written from the code alone; v2 (2026-09-28)
added a live audit of pueblofoodmap.com, the non-prod hosts, search results and
competing directories. Each phase's own **Status** line below records what shipped
and where.

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
| 9 | Crawler access is **fine** (no longer true for PerplexityBot since 2026-10-22; see §8 finding 2). OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, ClaudeBot, GPTBot, Googlebot and bingbot all get 200. Prod `robots.txt` is our own (no Cloudflare managed prefix). | v1 Phase 0.4 is done; drop it. | Was an open question |

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
| A one-off event | "free turkey giveaway Pueblo", "pueblo food event this weekend", a shared flyer link | `/event/[id]` (+ `/es`, #762: Event structured data, dynamic, in the sitemap while upcoming, `noindex` a week after it ends) |
| Area | "food pantry Pueblo West", "food bank 81001" | deferred (see Phase 3) |
| Eligibility | "do I need ID for a food pantry in Pueblo" | `/about` and `/resources` FAQ |

---

## 3. Phases

### Phase 0: Get crawled and measured (one small PR + dashboard tasks, do first)

**Status:** code items 1–4 shipped (#692, promoted to prod in #694). Items 5–7 are
done (2026-09-29). Item 8 is Kyle's.

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

5. **Search Console and Bing Webmaster Tools** — **done 2026-09-29.** Both are
   live. Google Search Console is a domain property, verified with a DNS TXT
   record in Cloudflare. The sitemap is submitted to both: Google shows Success
   (234 URLs), Bing is still processing. Indexing is requested in Google for
   `/`, `/food-pantries`, `/snap-wic-stores` and `/es`. Bing matters because
   ChatGPT search and Copilot use its index.
6. **IndexNow** — **done 2026-09-29.** Cloudflare Crawler Hints (a zone toggle)
   is on.
7. **GitHub repo description** — **done 2026-09-29.** It no longer says "POC";
   it's one plain sentence about the live service.
8. **Baseline prompt panel.** Ask ChatGPT, Perplexity, Google (AI Overview) and
   Copilot the fixed questions below, drawn from §2. Record who gets cited. Re-run monthly.
   The 2026-09-28 web-search baseline is in §1: we are cited for none of them.
   Keep the wording fixed between runs, or month-to-month results stop being comparable.

   English (12):
   1. Where is a food pantry near me in Pueblo, CO?
   2. Where can I get free food in Pueblo, Colorado today?
   3. What are the hours for the Bessemer Mobile Food Pantry in Pueblo?
   4. Which churches in Pueblo have a food bank?
   5. Which stores in Pueblo take EBT?
   6. Does Walmart in Pueblo take WIC?
   7. How do I apply for SNAP in Pueblo County?
   8. Where are the blessing boxes in Pueblo?
   9. Are there community gardens in Pueblo, CO?
   10. Is there a soup kitchen in Pueblo?
   11. Are there any free food events in Pueblo this weekend?
   12. Do I need an ID to get food from a food pantry in Pueblo?

   Spanish (4; added 2026-10-25 once the `/es` pages were confirmed indexed, #763):
   13. ¿Dónde hay una despensa de comida cerca de mí en Pueblo, Colorado?
   14. ¿Dónde puedo conseguir comida gratis hoy en Pueblo?
   15. ¿Qué tiendas en Pueblo aceptan EBT o WIC?
   16. ¿Necesito identificación para recibir comida en una despensa de Pueblo?

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

### Phase 3: Hub pages for the queries people type — live on prod 2026-09-29 (#709)

**Status:** live on prod 2026-09-29 via promotion #713 (issue #709). PR #710 built
`/food-pantries`, `/snap-wic-stores`, `/community-gardens` (each with an `/es`
twin) and the `/resources` FAQ. PR #712 built item 2, `/blessing-boxes` (+ `/es`):
force-dynamic, 2 D1 reads at request time, noindex on read failure; prod listed
28 live boxes at launch. `/meal-sites` waits until there's more than one meal
site; by-day and area/ZIP pages stay deferred (item 6). See ARCHITECTURE.md
"Hub pages". Counts at launch: 33 pantries, 50 SNAP, 8 WIC (the "49 WIC" below
is stale; the pages compute counts from data). The new Spanish strings are on
the #689 `[CHECK]` review list. Follow-up: footer tap targets (#711).

Static, server-rendered, `buildPageMetadata`, ItemList JSON-LD, a short FAQ,
linked from `/venues`, the footer and the `/` nav block, and in the sitemap.
Verify each on staging (a green build doesn't prove a page serves).

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

**Follow-up:** Google indexing of the `/es` pages confirmed 2026-10-25 (#763),
and four Spanish questions are in the Phase 0 prompt panel. Bing is not checked
yet (Kyle deferred it).
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

5. **`/llms.txt`** (cheap, unproven; shipped 2026-09-29, see "2026-09-29 audit follow-ups") and a published **open dataset**
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
- New `generateStaticParams` pages: verify on staging (a green build doesn't
  prove they serve), and add to the `deploy-prod.yml` smoke test.
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
| Search Console / Bing Webmaster Tools | Kyle sets them up later (Phase 0 item 5). **Done 2026-09-29** (see Phase 0). |
| `/blessing-boxes` read-only list | Approved; REVIEW.md updated. |
| Flat hub URLs (`/food-pantries`) | Approved. |
| Partner outreach | Kyle, working from [`seo-outreach.md`](seo-outreach.md). |
| Hours / phone data pass (Phase 1) | Kyle, in progress; out of scope for code PRs. |
| Spanish `/es` tree (Phase 4) | **P1**, specced in #689 — live on prod 2026-09-28 (#695, #697, #698 via #702). The `[CHECK]` native-speaker review is still open on #689. |

---

## 7. 2026-09-29 audit follow-ups

- **`/llms.txt`** shipped in this PR: a static `public/llms.txt`, smoke-tested in
  `deploy-prod.yml`. It has no counts, so it can't go stale.
- **Home mobile LCP.** The splash line was the slow element: its code loaded
  only after hydration, through several rounds of chunk fetches. It is now in
  the first chunk wave, and PostHog no longer downloads its unused surveys
  bundle. Numbers and what's left are in this PR's description.
- **`/about` contact:** done in this PR. It now shows `hello@pueblofoodmap.com`
  (no personal name, per Kyle), and the Organization JSON-LD carries the same
  `email`. A Wikidata item for the Organization is filed as a P2 issue.
- **`/es` indexing check:** Google done 2026-10-25 (#763). **First AI
  prompt-panel run:** not yet done; the questions are in Phase 0 item 8.
- **`/` was already indexed on 2026-09-29**, but the brand query still ranks the
  GitHub repo first. That's authority, so it's Phase 5 work, not a code fix.

---

## 8. 2026-11-19 review

**Sources:** Google Search Console for 2026-08-01 to 2026-11-18 (Search Analytics
API through the server's `gsc query`), URL Inspection of all 236 sitemap URLs, a
curl crawl of every sitemap URL, Lighthouse mobile on three pages, Cloudflare Web
Analytics referrers, and the published venue data in `src/data/published-venues.ts`.
**Not measured:** AI citations and Bing rankings. Perplexity, Google, DuckDuckGo,
Brave and Mojeek all served a CAPTCHA or a 403 to the server, Bing from the server
returned off-topic results, and there is no Bing Webmaster Tools API key for this
site. One indirect check: an AI web-search tool (not from the server) returned no
pueblofoodmap.com page for "Pueblo Food Map", "food pantry Pueblo CO", "blessing
boxes Pueblo Colorado map" or "stores that take EBT Pueblo Colorado"; it cited
feedam.org, directory.plentiful.org, foodpantries.org, KOAA and
mapping.littlefreepantry.org instead. The prompt panel (Phase 0 item 8) must be
run from a normal browser.

### 8.1 Scorecard against §4

| Signal | Target | 2026-11-19 |
|---|---|---|
| Brand query shows the site | #1 | **Unmeasured, probably not met.** Search Console reports no "pueblo food map" searches; Google hides rare queries, and `/` gets 10 clicks from searches it doesn't name. The AI web-search check above didn't find the site for its own name. "pueblo food" and "pueblofood" (445 impressions, around 7th, 0 clicks) show **`/es/about`**, not `/` or `/about`. |
| Indexed venue pages | ≥ 100 of 107 | **Not met: 94 of 107** (Spanish: 90 of 107). **All 13 missing English pages are pantries**, 13 of 33, among them Bessemer Mobile Food Pantry, Pueblo Cooperative Care Center and the county USDA distribution: 9 "Discovered – currently not indexed", 4 unknown to Google. Every store and garden page is indexed. Hubs: all indexed. |
| Pantries with hours | ≥ 90% | **Not met: 16 of 33 (48%).** 42 of 63 stores have no hours either. |
| Impressions / clicks trending up | up | **Met.** 41 impressions and 1 click in the week of 09-14; 863 and 16 in the week of 11-09. |
| AI-referred visits | tracked | **None visible.** Web Analytics samples about 1 in 10 visits, so a handful could hide. No chatgpt.com, perplexity.ai, copilot or gemini referrer in Web Analytics since launch. Last 30 days (sampled): direct ~310 visits, Google ~90, Gmail app ~50, Facebook ~60, Bing ~10. |
| Cited in AI answers | most of 16 | **Not measured.** The panel has never run. |
| Rich-result errors | none | None seen, but venue pages fail Lighthouse's meta-description check (finding 1). |

### 8.2 What people search when Google shows us

4,854 impressions and 79 clicks in total (CTR 1.6%). Google names the query for
2,133 of those impressions; the rest are hidden for privacy. Mobile is 76% of
impressions and sits around 8th; desktop sits around 29th.

| Intent | Queries | Impressions | Clicks | Best examples (impressions, typical position) |
|---|---|---|---|---|
| Store names and other searches (anything not below) | 256 | 869 | 0 | "valley market" (285, ~10), "save a lot hours pueblo co" (70, ~31, lands on `/venues`), "loaf n jug avondale" (28, ~7) |
| Free food / pantry / food bank | 203 | 681 | 9 | "food banks near me" (59, ~8, 5 clicks), "food pantry near me" (53, ~10), "free food bank pueblo, co open today" (39, ~10) |
| "pueblo food" / "pueblofood" | 4 | 450 | 0 | all land on `/es/about` |
| EBT / SNAP / WIC | 32 | 101 | 0 | "does loaf and jug take ebt" (31, ~8) |
| Blessing boxes | 9 | 27 | 5 | "blessing boxes near me" (12, ~5) |
| Spanish | ~10 | ~15 | 0 | "despensas cerca de mi" (~75th) |

Clicks by page: `/food-pantries` 23 (1,258 impressions), `/blessing-boxes` 20
(130), `/` 10, `/snap-wic-stores` 4, `/venues` 2 (605 impressions). Takeaways:

- **The pantry hub and the blessing-box hub do the work.** "Near me" searches
  find `/food-pantries` in the top 10 on phones. Blessing boxes have the best
  click rate on the site (15%).
- **Store pages bring a third of named impressions and no clicks.** People
  searching "valley market" want the store, not us. That is fine; the EBT
  questions on those same pages ("does loaf and jug take ebt") are the
  on-mission part, and they get no clicks either.
- **City-named queries rank poorly.** "food pantry pueblo co" (~28th),
  "pueblo food banks" (~27th), "commodities pueblo co" (~47th), "pueblo soup
  kitchen" (~52nd). The established directories win these.
- **Spanish pages barely rank.** `/es/food-pantries` sits around 36th, and
  Spanish venue pages sometimes show for English searches around 20th to 50th.

### 8.3 Findings, ranked

1. **[Both] Venue and blessing-box pages put their title, description, canonical
   and hreflang in `<body>`, not `<head>`.** It happens on about half of all
   responses, at random, whoever asks: ten requests in a row for one venue page
   gave the tags in the body 6 times as Googlebot, 4 as bingbot and 6 as a
   browser. The other half are correct. A crawl of all 236 sitemap URLs caught
   it on every venue page (EN and ES) and on `/blessing-boxes` and
   `/es/blessing-boxes`: the tags arrive in a streamed `<div hidden id="S:0">`
   chunk after the body starts. Pages whose metadata is
   synchronous (`/`, `/about`, the other hubs) are fine. **This arrived with the
   vinext move (live 2026-10-25), and Google is already losing the canonical:**
   URL Inspection shows a declared canonical on every indexed venue page Google
   last crawled up to 2026-10-25, and on none of the 40 it crawled from
   2026-10-27 on (`/blessing-boxes` too), while hub pages crawled after that date
   keep theirs. The share grows with every recrawl. Crawlers that don't run
   JavaScript (Bing, which ChatGPT search and Copilot use, Perplexity, link
   previews) get no title, description or canonical in the head about half the
   time. Likely cause: the async `generateMetadata` in
   `src/app/(site)/venue/[id]/page.tsx` (and its `/es` twin and the force-dynamic
   blessing-box hub) is streamed by vinext. Fix: render that metadata in the
   head, and add a check to `scripts/check-pages-serve.sh` that fails when
   `<title>` or `rel="canonical"` comes after `</head>`. **Fixed 2026-11-19 in
   v1.5.2 (hotfix #948, PR #949):** `htmlLimitedBots: /.*/` in `next.config.ts`
   turns streaming metadata off, and the CI check exists. On prod, 150 requests
   (5 pages × Googlebot, bingbot and a browser × 10) all had the tags in the head.
2. **[AI] Cloudflare blocks PerplexityBot (403) at the edge.** Tested with the
   bot's user-agent string from a home connection, so a real Perplexity crawler
   may be treated differently, but the 403 matches the zone's
   `ai_training: disallow` bot setting (switched on 2026-10-22), which blocks
   training crawlers at the edge and is known to catch PerplexityBot, a search
   crawler. GPTBot, ClaudeBot and
   CCBot also get 403; they are training crawlers, so that matches the "no
   training" decision. OAI-SearchBot, ChatGPT-User, Claude-SearchBot,
   Perplexity-User, Googlebot and bingbot get 200. **Fixed 2026-11-19:** a
   Cloudflare WAF custom rule lets `PerplexityBot` skip the bot block
   (PerplexityBot now 200; GPTBot, ClaudeBot and CCBot still 403).
3. **[Google] 13 of 33 pantry pages are not in Google**, while every store page
   is (scorecard). Hours don't explain it (6 of the 13 have hours), and they are
   not newer: they date from the same July and September imports as the indexed
   pantries. They are linked from `/food-pantries` and in the sitemap, so Google
   has found them and chosen not to index them yet. Related: two old pantry URLs
   whose ids changed still get impressions and now 404
   (`/venue/plentiful-minnequa-vfw-post-3641-9faa99be`, whose new id is one of
   the 13, and `/venue/plentiful-care-and-share-food-bank-for-southern-colorado-main-location-4a362e63`).
   Fix: after finding 1 ships, 301 the renamed id to its new page, request
   indexing for the 13 in Search Console's URL Inspection (Kyle; Google offers
   no API for this), and recheck in two weeks with the URL Inspection sweep.
4. **[Google] "pueblo food" shows `/es/about`.** Both About pages are indexed,
   each under its own canonical, so this is Google's ranking choice, not a merge;
   it has picked `/es/about` since October (297 impressions in October, 182 so
   far in November, against 7 and 12 for `/about`). The cause is a hypothesis:
   `/` has 104 visible words and nothing that reads as a description of Pueblo
   Food Map, and the two About pages are near-identical twins titled just
   "About" and "Acerca de"; the Spanish one, which gets no clicks from English
   searchers, wins the tie. Fix: a short visible intro on `/`
   ("Pueblo Food Map: free food, SNAP stores and blessing boxes across Pueblo
   County"), and an `/about` title that leads with the purpose.
5. **[Both] The venue meta description drops the hours.**
   `buildVenueMetaDescription` (`src/lib/venueSummary.ts`) skips any sentence that
   doesn't fit 160 characters, and the hours sentence is usually the long one.
   Live example, Lynn Gardens: "…is a free food pantry at 3804 W. Pueblo Blvd,
   Pueblo, CO 81005. Last verified October 2026." Hours are the main thing
   people search a place for. Fix: a compact hours form ("Thu 9–11am") that
   comes before "Last verified".
6. **[Google] Store pages lose "[store] hours" searches to `/venues`.** Save-A-Lot's
   own page has hours, but its title and description don't say so; `/venues` lists
   every venue's hours on one 2,259-word page and wins. `/snap-wic-stores` shows
   no hours at all, although `hubHours()` already exists and the pantry hub uses
   it. Fix: show hours on the SNAP hub; put "hours" in store titles when known.
7. **[Google] 25 Loaf 'N Jug pages, 12 with the exact same title** ("Loaf 'N Jug,
   Pueblo, CO: Accepts SNAP/EBT"); also 7-Eleven ×5 and Alta Convenience ×3. Fix:
   add the street to the title when the name repeats.
8. **[Both] Valley Market, the most-shown venue page (319 impressions), is the
   thinnest.** No address (it shows raw coordinates), no hours, no phone; the
   whole page is one sentence. It is outside Pueblo city. Data fix in the admin.
9. **[Google] Structured-data errors.**
   - 24-hour stores emit `opens: "00:00", closes: "00:00"` (56 slots);
     schema.org's 24-hour form is `closes: "23:59"` (`slotToIsoTimes`,
     `src/lib/hours.ts`).
   - Lynn Gardens has weekly Thursday hours *and* a 2nd/4th-Thursday irregular
     schedule; the JSON-LD says every Thursday. Fix the data, or skip
     `openingHoursSpecification` when `hours_irregular` is set.
   - 30 of 33 pantries put `directory.plentiful.org` in `url`/`sameAs`, a
     third-party listing, not the operator's site.
10. **[Google] Small gaps.** `/venues` has a generic title ("All Food Resources")
   and no ItemList; hubs have no BreadcrumbList; static URLs have no `lastmod`;
   the sitemap lists the root without its trailing slash while the canonical has
   it; `/boxes/activity` (a 7-word client shell) is in the sitemap.
11. **[AI] `public/llms.txt` says pantries are listed "with hours"**; half aren't.
12. **[Both] Authority is still zero.** None of the nine partner pages in
    `seo-outreach.md` links to us (the county page blocks bots, so unknown), and
    there is no Wikidata item (#716). City-named queries won't move without this.
13. **[Google] Speed is not the problem.** Lighthouse mobile: 0.99–1.00
    performance, LCP 0.9 s, CLS 0 on `/`, `/food-pantries` and a venue page.

### 8.4 Action plan

**Critical (blocks search engines and AI from reading pages):**
- ~~Venue and blessing-box metadata in `<head>` (finding 1).~~ Done 2026-11-19
  (v1.5.2, #949).
- ~~Let PerplexityBot through the Cloudflare bot block (finding 2).~~ Done
  2026-11-19.

**High impact (this quarter):**
- Phase 1 hours pass, now covering stores too: 17 pantries and 42 stores without
  hours (Kyle, admin).
- Hours in venue meta descriptions; hours on `/snap-wic-stores`; "hours" in store
  titles (findings 5, 6). One code PR.
- Visible intro on `/` and a purpose-led `/about` title (finding 4). Same PR.
- Request indexing for the 13 missing pantry pages once finding 1 is live
  (finding 3, Kyle in Search Console).
- Partner outreach, Pueblo Food Project first (Phase 5, Kyle).

**Quick wins (one small PR plus a few admin edits):**
- Street in duplicate store titles; JSON-LD 24-hour and irregular-hours fixes;
  `/venues` title and ItemList; hub breadcrumbs; sitemap tidy-up; `llms.txt`
  wording (findings 7, 9, 10, 11).
- Valley Market address, hours and phone (finding 8, admin).
- First prompt-panel run from a normal browser (Phase 0 item 8), and a Bing
  Webmaster Tools API key for PFM so Bing can be checked like Google.

**Long term:**
- Open dataset (the 62 OpenStreetMap-sourced rows carry ODbL attribution and
  share-alike terms); Wikidata after first outside coverage (#716); by-day pantry
  pages once hours reach 90%.
- Phase 2 item 6 (keep or `noindex` the store pages): **keep them.** Google
  indexes them and they answer EBT questions; fix their titles instead.
