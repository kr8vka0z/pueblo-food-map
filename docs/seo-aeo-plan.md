# SEO / AEO plan

Status: **draft, for discussion** (2026-09-27). Nothing here is scheduled yet;
each workstream below becomes its own issue once agreed.

**Goal:** when someone in Pueblo County searches, or asks an AI assistant, "where
can I get free food near me / today / that takes SNAP", the answer names a
specific place and cites pueblofoodmap.com. This should work in English and in
Spanish.

- **SEO** is ranking in classic search results (Google, Bing).
- **AEO** (answer-engine optimization) is being the *source* that AI answers
  quote and link to. That covers Google AI Overviews, ChatGPT search, Perplexity,
  Copilot, Claude and Siri. They mostly draw on the same crawl, so good SEO is the
  base layer. AEO adds answer-shaped copy, clean structured data, fresh
  dates and third-party mentions.

---

## 1. Where we are (baseline audit)

Issue #164 and the SEO PRs that followed it already did the fundamentals. Much of
this is better than most local-directory sites:

| Area | State | Where |
|---|---|---|
| Per-page metadata + OG/Twitter image | ✅ every public page, via `buildPageMetadata` | `src/lib/site.ts` |
| Self-canonicals | ✅ per page; deliberately none at root | `layout.tsx` |
| Sitemap | ✅ static routes + 107 venues (with `lastModified`) + live boxes | `src/app/sitemap.ts` |
| robots.txt + AI-bot policy | ✅ answer-engine crawlers allowed, bulk-training scrapers blocked | `src/app/robots.ts` |
| Per-venue pages | ✅ 107 statically generated `/venue/[id]` pages | `src/app/venue/[id]` |
| JSON-LD | ✅ WebSite + Organization `@graph` (sitewide), ItemList (`/`), LocalBusiness/GroceryStore/etc. with geo + hours (venues), FAQPage (`/about`) | `src/lib/venueSchema.ts` |
| Crawlable (non-map) index | ✅ `/venues`, server-rendered, grouped by category | `src/app/venues` |
| Homepage for non-JS crawlers | ⚠️ `sr-only` `<h1>` + ItemList only; the body is the Mapbox canvas | `src/app/page.tsx` |
| Spanish | ❌ visible body only. Metadata, JSON-LD and URLs are English-only; no `/es`, no `hreflang` (#287, #386) | ARCHITECTURE.md "Known bilingual limitation" |
| Measurement | ❓ nothing in the repo shows whether Search Console / Bing Webmaster Tools are set up | |

**Bug found during the audit:** `sitemap.ts` lists `https://pueblofoodmap.com/boxes`,
but no `src/app/boxes/page.tsx` exists (only `/boxes/activity` and `/box/[id]`).
The sitemap is sending crawlers to a 404. (This is from reading the code; the live
site isn't reachable from the environment this was written in.)

---

## 2. Target queries

These are the searches and questions we want to own. They're the test set for
every workstream and for measurement (§4).

| Intent | Example queries (EN / ES) | Best landing page today | Gap |
|---|---|---|---|
| Find food now | "food pantry near me Pueblo", "free food Pueblo CO today", "despensa de comida Pueblo" | `/` (map, JS-only) or `/venues` | No "open today"/by-day answer; no Spanish URL |
| Specific place | "[pantry name] hours", "[church] food bank Pueblo" | `/venue/[id]` | Thin copy; generic JSON-LD `description` |
| SNAP / WIC | "stores that take EBT Pueblo", "WIC grocery Pueblo", "how to apply for SNAP Pueblo County" | `/resources`, filtered map | No SNAP/WIC landing page; `/resources` has no FAQ schema |
| Category | "community gardens Pueblo", "soup kitchen Pueblo", "blessing box Pueblo" | `/venues#…` | No dedicated category pages |
| Area | "food pantry Pueblo West", "food bank 81001", "east side Pueblo food" | none | No neighborhood/ZIP grouping |
| Eligibility | "do I need ID for a food pantry in Pueblo" | `/about` FAQ | Answer exists; buried on About |

---

## 3. Workstreams

Ordered by value for the effort. Phase 0 is cheap and unblocks measurement, so it
goes first.

### Phase 0: Fix, verify, measure (small, do first)

1. **Remove `/boxes` from the sitemap**, or build the page if a boxes index is
   planned. Add a test that every static sitemap URL maps to a real route.
2. **Search Console + Bing Webmaster Tools.** Verify the domain property (a DNS
   TXT record in Cloudflare), submit `sitemap.xml`, and check indexing coverage
   for the 107 venue pages. Bing matters for AEO specifically, because ChatGPT
   search and Copilot draw on Bing's index.
3. **IndexNow via Cloudflare Crawler Hints.** This is a zone toggle, with no app
   code. Bing/Yandex then re-crawl changed pages right after an admin Publish.
4. **Check the Cloudflare bot settings** ("Block AI bots" / AI Crawl Control /
   managed robots.txt) aren't overriding `robots.ts` and blocking the answer-engine
   crawlers we deliberately allow (OAI-SearchBot, PerplexityBot, Claude-SearchBot,
   Google). These are dashboard settings, so they're invisible to this repo.
5. **Baseline "prompt panel."** Ask ChatGPT, Perplexity, Google (AI Overview) and
   Copilot about 12 fixed questions from §2. Record whether PFM is cited and who
   is cited instead. Re-run it monthly.

### Phase 1: Make venue pages the best answer (medium)

The 107 venue pages are the site's main SEO asset. Today each one is mostly a data
card, and the JSON-LD `description` reads `"Food pantry in Pueblo, CO."` for all
33 pantries.

1. **Answer-first summary sentence**, built from data we already have. For example:
   *"St. X Food Pantry is a free food pantry at 123 Main St, Pueblo, CO 81003.
   Open Tuesdays 10 AM–12 PM and the 4th Saturday of each month. Last verified
   Sept 2026."* This is the sentence answer engines lift. It must come only from
   verified fields, never invented detail. It should also cover `hours_irregular`,
   which JSON-LD can't express (#400).
2. **Richer JSON-LD:** use the summary as `description`; add `sameAs` (the venue's
   own `url`), `isAccessibleForFree` for pantries/meal sites/boxes, SNAP/WIC as
   `paymentAccepted` / `amenityFeature` where confirmed, and a `BreadcrumbList`
   (Home › Food pantries › Venue). Every node still goes through `serializeJsonLd`.
3. **Titles with intent terms:** `"{Name} · Food Pantry in Pueblo, CO"` rather than
   a bare name. The `%s · Pueblo Food Map` template already appends the brand.
4. **Internal links:** "Other food pantries nearby" (3–5 nearest by geo) on each
   venue page. This links venue pages to each other and helps users.
5. **Freshness signal:** show "Last verified" prominently; answer engines weight
   dated facts.

### Phase 2: Landing pages for the queries people type (medium)

Add static, server-rendered hub pages that answer one intent each. They reuse
`groupVenuesByCategory`-style pure helpers and the same static + `dynamicParams =
false` pattern (so the `staticAssetsIncrementalCache` constraint applies).

1. **Category hubs**, for example `/food-pantries`, `/meal-sites`,
   `/community-gardens`, `/snap-wic-stores`, `/blessing-boxes` (the last one fixes
   the `/boxes` gap properly). Each gets an intro paragraph, the list, an ItemList
   JSON-LD and a short FAQ.
2. **By-day pantry pages** ("food pantries open Saturday in Pueblo"). Pantry hours
   are weekly-static, so these can be prerendered. A live "open today" filter
   stays client-side.
3. **Area pages.** Only publish these where there are enough venues (for example
   at least 5) to avoid thin, near-duplicate pages. Candidates: Pueblo West, the
   East Side, Downtown/81003, and Bessemer/81004.
4. **FAQ on `/resources`** with FAQPage schema: how to apply for SNAP/WIC in Pueblo
   County, what to bring to a pantry, and emergency food today. These are
   high-volume informational queries where a clear, cited answer wins AEO.
5. Link every hub from `/venues` and the footer/nav so none is orphaned, and add
   each one to the sitemap.

### Phase 3: Spanish that search engines can see (large, needs a decision)

Pueblo County has a large Hispanic population (about 4 in 10 residents; confirm
against current ACS data before we quote it anywhere). Spanish queries currently
reach English-only metadata. ARCHITECTURE.md already names an `/es` route tree as
the only real fix.

- Add a `/es/...` mirror of the public pages, with Spanish `<title>`, description,
  OG and JSON-LD (`inLanguage: "es"`), plus `hreflang` alternates (`en`, `es`,
  `x-default`) in both directions and in the sitemap.
- Keep the current cookie toggle for people browsing, but have it navigate
  between `/` and `/es/`. Hard constraint: **no server-side redirect on `/`**
  (AGENTS.md), so no auto-redirect by `Accept-Language`.
- Risks: this doubles the prerendered path count, it depends on the OpenNext
  static cache override, and `deploy-prod.yml`'s smoke tests need an `/es` case.
  Treat it as its own epic with its own staging check.

### Phase 4: Authority and machine-readability (ongoing)

1. **Citations and links from sources answer engines trust:** Pueblo County DHS,
   Care and Share Food Bank, 2-1-1 Colorado, Pueblo City-County Library, PCC/CSU
   Pueblo basic-needs pages, the Pueblo Food Project, and local news. One link from
   a `.gov` or food-bank resource page is worth more than any on-page change.
2. **Organization entity:** fill in `sameAs` with the real profiles (social, the
   GitHub repo, and a Wikidata item if one gets made), and add `logo` and
   `areaServed` (Pueblo County).
3. **`/llms.txt`:** a short, plain-text description of the site with links to
   `/venues`, the hubs and `/resources`. It costs little; how much any engine
   uses it is unproven.
4. **Open data:** consider publishing the venue dataset (for example a JSON/CSV
   file linked from `/about`). Datasets get reused and cited, which earns links.

---

## 4. Measuring it

| Signal | Source | Target |
|---|---|---|
| Indexed venue pages | Search Console coverage | all 107 indexed |
| Impressions / clicks for the §2 queries | Search Console, Bing WMT | trend up month over month |
| AI-referred visits (chatgpt.com, perplexity.ai, copilot, gemini referrers) | Cloudflare Web Analytics (unique visitors: never PostHog, per AGENTS.md) | tracked from baseline |
| Cited in AI answers | monthly prompt panel (Phase 0.5) | cited for most of the 12 questions |
| Rich-result eligibility | Rich Results Test / Search Console enhancements | no errors |

---

## 5. Guardrails (from AGENTS.md / ARCHITECTURE.md)

- Use `buildPageMetadata` for every new page and `serializeJsonLd` for every JSON-LD
  block.
- New static dynamic-route pages rely on `open-next.config.ts`'s
  `staticAssetsIncrementalCache`. Verify them on staging, not just with a green
  build, and consider adding them to the `deploy-prod.yml` smoke test.
- No server-side redirect on `/`.
- Content must come from verified data. Never generate claims (eligibility, "no ID
  needed") about a specific venue that we haven't confirmed.

## 6. Open questions for Kyle

1. Are Search Console and Bing Webmaster Tools already set up? If so, what do
   coverage and top queries show?
2. Is the `/es` tree (Phase 3) in scope this quarter, or is Phases 0–2 in English
   the first milestone?
3. Are new top-level URLs (hub pages) OK, and do you prefer names like
   `/food-pantries` or a nested `/venues/pantries`?
4. Which partner organizations could realistically link to us (Phase 4.1)?
