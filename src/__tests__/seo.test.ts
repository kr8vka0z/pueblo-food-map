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
import { SITE_URL, SITE_NAME, OG_IMAGE, buildPageMetadata } from "@/lib/site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { venues } from "@/data/venues";

// ─── sitemap ─────────────────────────────────────────────────────────────────

describe("sitemap", () => {
  test("returns an array of entries", () => {
    const entries = sitemap();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  test("root URL is present", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    // Root may be SITE_URL bare or SITE_URL + "/"
    const hasRoot =
      urls.includes(SITE_URL) || urls.includes(`${SITE_URL}/`);
    expect(hasRoot).toBe(true);
  });

  test("every URL is absolute and starts with SITE_URL", () => {
    const entries = sitemap();
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  test("/suggest is included", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/suggest`);
  });

  test("/feedback is included", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/feedback`);
  });

  test("/privacy is included", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/privacy`);
  });

  test("no duplicate URLs", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
  });

  // PR2 (#164 6.3/6.4) — venue URLs are now included
  test("includes venue URLs (length > 4)", () => {
    const entries = sitemap();
    expect(entries.length).toBeGreaterThan(4);
  });

  test("contains at least one /venue/ URL for a real venue id", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    const firstVenueUrl = `${SITE_URL}/venue/${venues[0].id}`;
    expect(urls).toContain(firstVenueUrl);
  });

  test("all venue URLs start with SITE_URL/venue/", () => {
    const entries = sitemap();
    const venueEntries = entries.filter((e) =>
      e.url.includes("/venue/"),
    );
    expect(venueEntries.length).toBe(venues.length);
    for (const entry of venueEntries) {
      expect(entry.url.startsWith(`${SITE_URL}/venue/`)).toBe(true);
    }
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
});
