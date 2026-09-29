/**
 * SiteFooter OSM attribution tests (#133 4.5).
 *
 * SiteFooter is shared by every non-map utility page (/venues, /about,
 * /privacy, /suggest, ...) — this proves the ODbL credit link renders with
 * the correct href in both locales.
 *
 * #689 PR 2: `renderClientToggleEs` mocks useLocale() to locale="es",
 * tree="en" — a client-side cookie toggle to Spanish on an EN-tree page.
 * `<LocaleProvider initialLocale="es">` (still used below) now ALSO sets
 * tree="es" (LocaleContext.tsx derives it) — that's the real /es tree, a
 * DIFFERENT scenario with different, correct hrefs (localizedHref rewrites
 * mirrored links to /es/...). Trap 2 in #689's brief is exactly this
 * distinction: "localizedHref must key on the ROUTE TREE ... not the
 * user-switchable client locale."
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as LocaleContext from "@/lib/LocaleContext";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import SiteFooter from "@/components/SiteFooter";
import { OSM_COPYRIGHT_URL } from "@/lib/osmAttribution";

function renderClientToggleEs() {
  vi.spyOn(LocaleContext, "useLocale").mockReturnValue({
    locale: "es",
    tree: "en",
    setLocale: vi.fn(),
  });
  return render(<SiteFooter />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SiteFooter — OSM attribution", () => {
  test("renders an OpenStreetMap copyright link (EN)", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: t("osm.attribution", "en") });
    expect(link.getAttribute("href")).toBe(OSM_COPYRIGHT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("renders the ES translation (client-side toggle, EN tree)", () => {
    renderClientToggleEs();
    expect(screen.getByRole("link", { name: t("osm.attribution", "es") })).toBeDefined();
  });
});

// SEO/AEO plan Phase 0: the footer is the crawlable path to /venues (and from
// there every /venue/<id>) and to /resources.
describe("SiteFooter — crawl links", () => {
  test("links to /venues and /resources (EN)", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: t("footer.venues", "en") }).getAttribute("href")).toBe("/venues");
    expect(screen.getByRole("link", { name: t("footer.resources", "en") }).getAttribute("href")).toBe("/resources");
  });

  test("the same EN hrefs when only the client locale (not the tree) is es", () => {
    renderClientToggleEs();
    expect(screen.getByRole("link", { name: t("footer.venues", "es") }).getAttribute("href")).toBe("/venues");
    expect(screen.getByRole("link", { name: t("footer.resources", "es") }).getAttribute("href")).toBe("/resources");
  });

  // #709: crawlable links to the three hub pages, in both trees.
  test("links to the three hubs (EN tree)", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: t("footer.foodPantries", "en") }).getAttribute("href")).toBe("/food-pantries");
    expect(screen.getByRole("link", { name: t("footer.snapWic", "en") }).getAttribute("href")).toBe("/snap-wic-stores");
    expect(screen.getByRole("link", { name: t("footer.gardens", "en") }).getAttribute("href")).toBe("/community-gardens");
  });

  test("rewrites the three hubs to /es/... on the real /es tree", () => {
    render(
      <LocaleProvider initialLocale="es">
        <SiteFooter />
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: t("footer.foodPantries", "es") }).getAttribute("href")).toBe("/es/food-pantries");
    expect(screen.getByRole("link", { name: t("footer.snapWic", "es") }).getAttribute("href")).toBe("/es/snap-wic-stores");
    expect(screen.getByRole("link", { name: t("footer.gardens", "es") }).getAttribute("href")).toBe("/es/community-gardens");
  });

  // #689 PR 2 — the real /es tree: hrefs rewrite to /es/... via localizedHref.
  test("rewrites to /es/venues and /es/resources on the real /es tree", () => {
    render(
      <LocaleProvider initialLocale="es">
        <SiteFooter />
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: t("footer.venues", "es") }).getAttribute("href")).toBe(
      "/es/venues",
    );
    expect(screen.getByRole("link", { name: t("footer.resources", "es") }).getAttribute("href")).toBe(
      "/es/resources",
    );
  });
});
