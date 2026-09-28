/**
 * SEO infrastructure tests — issue #164 (6.1 + 6.2)
 *
 * Covers:
 *   - sitemap: correct URLs, all static routes present, no duplicates
 *   - robots: sitemap pointer, allow / rule, /api/ disallow
 *   - site constants: canonical origin and OG image dimensions (fallback path
 *     because layout.tsx imports next/headers + globals.css which are
 *     unavailable in jsdom — tested via @/lib/site instead)
 */

import { describe, test, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_URL, SITE_NAME, OG_IMAGE, buildPageMetadata } from "@/lib/site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { venues } from "@/data/venues";

// ─── sitemap ─────────────────────────────────────────────────────────────────

describe("sitemap", () => {
  // sitemap() is synchronous again (SEO/AEO plan Phase 0 dropped its live D1
  // box read); `await` on a plain value is harmless, so these tests keep it.
  test("returns an array of entries", async () => {
    const entries = await sitemap();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  test("root URL is present", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    // Root may be SITE_URL bare or SITE_URL + "/"
    const hasRoot =
      urls.includes(SITE_URL) || urls.includes(`${SITE_URL}/`);
    expect(hasRoot).toBe(true);
  });

  test("every URL is absolute and starts with SITE_URL", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  test("/suggest is included", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/suggest`);
  });

  test("/feedback is included", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/feedback`);
  });

  test("/privacy is included", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/privacy`);
  });

  // SEO/AEO plan Phase 0: `/boxes` never existed (a 404 in every crawl), and
  // `/box/<id>` is a noindexed client-side redirect shell, not a page.
  test("lists no Blessing Box URLs", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).not.toContain(`${SITE_URL}/boxes`);
    expect(urls.filter((u) => u.startsWith(`${SITE_URL}/box/`))).toEqual([]);
  });

  // Guards the class of bug above: every non-venue URL must be served by a
  // real src/app/**/page.tsx. Every public EN page lives under the (site)
  // route group (#689 PR 1) — route groups don't change the URL. #689 PR 2
  // (design decision 10, "Emit the ES URLs ... for every mirrored route")
  // added /es entries, which live under src/app/es/ instead — this test is
  // updated to route each path to the tree it's actually served from,
  // rather than assuming (site) for everything.
  test("every static (non-venue) URL maps to a real page.tsx", async () => {
    const entries = await sitemap();
    const staticPaths = entries
      .map((e) => e.url.slice(SITE_URL.length) || "/")
      .filter((path) => !path.includes("/venue/"));
    expect(staticPaths.length).toBeGreaterThan(0);
    for (const path of staticPaths) {
      const isEs = path === "/es" || path.startsWith("/es/");
      const routeDir = isEs ? "src/app/es" : "src/app/(site)";
      const relativePath = isEs ? (path === "/es" ? "" : path.slice("/es".length)) : path;
      const pageFile = join(process.cwd(), routeDir, relativePath, "page.tsx");
      expect(existsSync(pageFile), `${path} → ${pageFile}`).toBe(true);
    }
  });

  test("every venue URL is a real venue id", async () => {
    const entries = await sitemap();
    const venueIds = entries
      .map((e) => e.url.slice(SITE_URL.length))
      .filter((path) => path.startsWith("/venue/"))
      .map((path) => path.slice("/venue/".length));
    const known = new Set(venues.map((v) => v.id));
    expect(venueIds.filter((id) => !known.has(id))).toEqual([]);
  });

  test("no duplicate URLs", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  // PR2 (#164 6.3/6.4) — venue URLs are now included
  test("includes venue URLs (length > 4)", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(4);
  });

  test("contains at least one /venue/ URL for a real venue id", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const firstVenueUrl = `${SITE_URL}/venue/${venues[0].id}`;
    expect(urls).toContain(firstVenueUrl);
  });

  // #689 PR 2 (design decision 10) added an /es twin for every venue, so
  // the count doubles and each entry must be under EXACTLY ONE of the two
  // valid venue prefixes — stricter than the pre-#689 assertion (single
  // prefix, single count), not weaker: it still fails on a stray URL under
  // neither tree, and now also fails if either tree's count is wrong.
  test("all venue URLs are under /venue/ (EN) or /es/venue/ (ES), one of each per venue", async () => {
    const entries = await sitemap();
    const venueEntries = entries.filter((e) => e.url.includes("/venue/"));
    expect(venueEntries.length).toBe(venues.length * 2);

    const enVenueUrls = venueEntries.filter((e) => e.url.startsWith(`${SITE_URL}/venue/`));
    const esVenueUrls = venueEntries.filter((e) => e.url.startsWith(`${SITE_URL}/es/venue/`));
    expect(enVenueUrls.length).toBe(venues.length);
    expect(esVenueUrls.length).toBe(venues.length);
    expect(enVenueUrls.length + esVenueUrls.length).toBe(venueEntries.length);
  });

  // S6 (#164 quick win) — venue entries carry a real lastModified so crawlers
  // can tell which venue pages actually changed, instead of re-crawling every
  // page as if it were equally fresh.
  test("every venue entry includes lastModified", async () => {
    const entries = await sitemap();
    const venueEntries = entries.filter((e) => e.url.includes("/venue/"));
    expect(venueEntries.length).toBeGreaterThan(0);
    for (const entry of venueEntries) {
      expect(entry.lastModified).toBeDefined();
    }
  });

  test("a venue's lastModified matches its last_verified date", async () => {
    const entries = await sitemap();
    const v = venues[0];
    const entry = entries.find((e) => e.url === `${SITE_URL}/venue/${v.id}`);
    expect(entry?.lastModified).toBe(v.last_verified);
  });

  // #689 PR 2 (design decision 10) — every mirrored route's sitemap entry
  // carries alternates.languages pointing at its counterpart.
  describe("es alternates (#689)", () => {
    test("/ and /es both point at each other", async () => {
      const entries = await sitemap();
      const en = entries.find((e) => e.url === SITE_URL);
      const es = entries.find((e) => e.url === `${SITE_URL}/es`);
      expect(en?.alternates?.languages).toEqual({ en: SITE_URL, es: `${SITE_URL}/es` });
      expect(es?.alternates?.languages).toEqual({ en: SITE_URL, es: `${SITE_URL}/es` });
    });

    test("/about and /es/about both point at each other", async () => {
      const entries = await sitemap();
      const en = entries.find((e) => e.url === `${SITE_URL}/about`);
      const es = entries.find((e) => e.url === `${SITE_URL}/es/about`);
      const expected = { en: `${SITE_URL}/about`, es: `${SITE_URL}/es/about` };
      expect(en?.alternates?.languages).toEqual(expected);
      expect(es?.alternates?.languages).toEqual(expected);
    });

    test("every venue's EN and ES entries point at each other", async () => {
      const entries = await sitemap();
      for (const v of venues) {
        const enUrl = `${SITE_URL}/venue/${v.id}`;
        const esUrl = `${SITE_URL}/es/venue/${v.id}`;
        const en = entries.find((e) => e.url === enUrl);
        const es = entries.find((e) => e.url === esUrl);
        expect(en?.alternates?.languages, enUrl).toEqual({ en: enUrl, es: esUrl });
        expect(es?.alternates?.languages, esUrl).toEqual({ en: enUrl, es: esUrl });
      }
    });

    test("non-mirrored routes (/suggest, /privacy, /feedback, /boxes/activity) have no alternates block", async () => {
      const entries = await sitemap();
      for (const path of ["/suggest", "/privacy", "/feedback", "/boxes/activity"]) {
        const entry = entries.find((e) => e.url === `${SITE_URL}${path}`);
        expect(entry?.alternates, path).toBeUndefined();
      }
    });

    test("an /es venue entry carries the same lastModified as its EN twin", async () => {
      const entries = await sitemap();
      const v = venues[0];
      const en = entries.find((e) => e.url === `${SITE_URL}/venue/${v.id}`);
      const es = entries.find((e) => e.url === `${SITE_URL}/es/venue/${v.id}`);
      expect(es?.lastModified).toBe(en?.lastModified);
      expect(es?.lastModified).toBe(v.last_verified);
    });
  });
});

// ─── robots ──────────────────────────────────────────────────────────────────

describe("robots", () => {
  test("sitemap points to SITE_URL/sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  test("at least one rule allows /", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const hasAllowRoot = rules.some((rule) => {
      if (!rule) return false;
      const allow = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
      return allow.includes("/");
    });
    expect(hasAllowRoot).toBe(true);
  });

  test("disallow includes /api/", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const hasDisallowApi = rules.some((rule) => {
      if (!rule) return false;
      const disallow = Array.isArray(rule.disallow)
        ? rule.disallow
        : [rule.disallow];
      return disallow.includes("/api/");
    });
    expect(hasDisallowApi).toBe(true);
  });

  // S7b (#164 quick win) — explicit AI-bot policy: /admin/ is never
  // crawlable content, bulk-training scrapers are blocked outright, and
  // citation/answer-engine crawlers are deliberately left uncovered by any
  // disallow-all rule so they fall under the permissive "*" allow.
  test("disallow includes /admin/", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const hasDisallowAdmin = rules.some((rule) => {
      if (!rule) return false;
      const disallow = Array.isArray(rule.disallow)
        ? rule.disallow
        : [rule.disallow];
      return disallow.includes("/admin/");
    });
    expect(hasDisallowAdmin).toBe(true);
  });

  test("blocks a bulk-training scraper (CCBot) entirely", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const blockedRule = rules.find((rule) => {
      if (!rule) return false;
      const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
      return agents.includes("CCBot");
    });
    expect(blockedRule).toBeDefined();
    const disallow = Array.isArray(blockedRule!.disallow)
      ? blockedRule!.disallow
      : [blockedRule!.disallow];
    expect(disallow).toContain("/");
  });

  test("does not block a citation crawler (GPTBot) with a disallow-all rule", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const targetedRule = rules.find((rule) => {
      if (!rule) return false;
      const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
      return agents.includes("GPTBot");
    });
    // GPTBot must not appear in the bulk-scraper block list — it's meant to
    // fall through to the permissive "*" rule instead.
    expect(targetedRule).toBeUndefined();
  });
});

// ─── site constants (metadata fallback path) ─────────────────────────────────
//
// WHY: layout.tsx imports next/headers (cookies) and globals.css — both
// unavailable in jsdom. Asserting the site constants is the specified
// fallback: it validates that the canonical origin is correct and the OG
// image is the expected 1200×630 asset without touching the server component.

describe("site constants", () => {
  test("SITE_URL is the canonical origin", () => {
    expect(SITE_URL).toBe("https://pueblofoodmap.com");
  });

  test("SITE_NAME is the correct brand", () => {
    expect(SITE_NAME).toBe("Pueblo Food Map");
  });

  test("OG_IMAGE.url is absolute", () => {
    expect(OG_IMAGE.url).toBe(`${SITE_URL}/og-image.png`);
  });

  test("OG_IMAGE width is 1200", () => {
    expect(OG_IMAGE.width).toBe(1200);
  });

  test("OG_IMAGE height is 630", () => {
    expect(OG_IMAGE.height).toBe(630);
  });

  test("OG_IMAGE type is image/png", () => {
    expect(OG_IMAGE.type).toBe("image/png");
  });
});

// ─── buildPageMetadata ────────────────────────────────────────────────────────
//
// WHY: Regression guard for the OG image shallow-merge bug. Next.js replaces
// (not deep-merges) a child openGraph object — so a subpage setting only
// {title,url} drops the inherited image. buildPageMetadata must emit the full
// object including images on every call.

describe("buildPageMetadata", () => {
  const m = buildPageMetadata({
    title: "Suggest a Venue",
    description: "d",
    path: "/suggest",
  });

  test("alternates.canonical is the page URL", () => {
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/suggest`);
  });

  test("openGraph.url is the page URL", () => {
    // openGraph is Metadata['openGraph'] — cast to access typed fields
    const og = m.openGraph as { url?: string };
    expect(og.url).toBe(`${SITE_URL}/suggest`);
  });

  test("openGraph.title is the page title", () => {
    const og = m.openGraph as { title?: string };
    expect(og.title).toBe("Suggest a Venue");
  });

  test("openGraph.images contains the brand OG image (regression guard)", () => {
    // images is OGImage | OGImage[] | string | string[] — normalise to array
    const og = m.openGraph as { images?: unknown };
    const images = Array.isArray(og.images) ? og.images : [og.images];
    const hasOgImage = images.some(
      (img) => img && typeof img === "object" && (img as { url?: string }).url === OG_IMAGE.url,
    );
    expect(hasOgImage).toBe(true);
  });

  test("twitter.card is summary_large_image", () => {
    const tw = m.twitter as { card?: string };
    expect(tw.card).toBe("summary_large_image");
  });

  test("twitter.images[0].url is the brand OG image URL", () => {
    const tw = m.twitter as { images?: Array<{ url?: string }> };
    expect(tw.images?.[0]?.url).toBe(OG_IMAGE.url);
  });

  // ─── #689 PR 2: locale + mirrored ───────────────────────────────────────

  test("default call (no locale/mirrored) has no alternates.languages", () => {
    // Regression guard: existing non-mirrored callers (/suggest, /privacy,
    // etc.) must keep getting no hreflang at all.
    expect(m.alternates?.languages).toBeUndefined();
  });

  test("default call keeps openGraph.locale en_US / alternateLocale es_US", () => {
    const og = m.openGraph as { locale?: string; alternateLocale?: string[] };
    expect(og.locale).toBe("en_US");
    expect(og.alternateLocale).toEqual(["es_US"]);
  });

  test("mirrored EN page emits hreflang en/es/x-default, x-default → EN", () => {
    const mm = buildPageMetadata({
      title: "About",
      description: "d",
      path: "/about",
      mirrored: true,
    });
    expect(mm.alternates?.languages).toEqual({
      en: `${SITE_URL}/about`,
      es: `${SITE_URL}/es/about`,
      "x-default": `${SITE_URL}/about`,
    });
  });

  test("mirrored ES page emits hreflang en/es/x-default and ES openGraph locale", () => {
    const mm = buildPageMetadata({
      title: "Acerca de",
      description: "d",
      path: "/es/about",
      locale: "es",
      mirrored: true,
    });
    expect(mm.alternates?.languages).toEqual({
      en: `${SITE_URL}/about`,
      es: `${SITE_URL}/es/about`,
      "x-default": `${SITE_URL}/about`,
    });
    expect(mm.alternates?.canonical).toBe(`${SITE_URL}/es/about`);
    const og = mm.openGraph as { locale?: string; alternateLocale?: string[] };
    expect(og.locale).toBe("es_US");
    expect(og.alternateLocale).toEqual(["en_US"]);
  });

  test("mirrored ES homepage (path /es) maps to EN / not /es-stripped-empty", () => {
    const mm = buildPageMetadata({
      title: "Inicio",
      description: "d",
      path: "/es",
      locale: "es",
      mirrored: true,
    });
    expect(mm.alternates?.languages).toEqual({
      en: SITE_URL,
      es: `${SITE_URL}/es`,
      "x-default": SITE_URL,
    });
  });

  test("non-mirrored ES-locale call (hypothetical) still has no alternates.languages", () => {
    const mm = buildPageMetadata({
      title: "x",
      description: "d",
      path: "/es/suggest",
      locale: "es",
    });
    expect(mm.alternates?.languages).toBeUndefined();
  });
});
