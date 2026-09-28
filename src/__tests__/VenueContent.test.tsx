/**
 * VenueContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component (the highest-risk page in the repo —
 * see src/app/(site)/venue/[id]/page.tsx's own header comment) renders EN by
 * default and ES when wrapped in a LocaleProvider set to "es" (#289),
 * including the category label and the "View on the map" CTA that used to
 * be a hardcoded English string.
 */

import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import VenueContent from "@/components/VenueContent";
import { venues } from "@/data/venues";
import { OSM_COPYRIGHT_URL } from "@/lib/osmAttribution";
import type { Venue } from "@/types/venue";

const FIXTURE_VENUE = venues[0];

// Literal fixture, not venues.find() — a real OSM-sourced venue's presence
// in published-venues.ts would make this test brittle against future
// publishes (#133 4.5).
const OSM_FIXTURE_VENUE: Venue = {
  id: "osm-fixture-grocery",
  name: "Fixture Grocery",
  category: "grocery",
  lat: 38.26,
  lng: -104.6,
  address: "123 Fixture St, Pueblo, CO 81001",
  source: "OpenStreetMap (way/549826775)",
  last_verified: "2026-05-12",
};

describe("VenueContent — locale", () => {
  test("renders English category label and CTAs with no provider (default locale)", () => {
    render(<VenueContent venue={FIXTURE_VENUE} />);
    expect(
      screen.getByText(t(`category.full.${FIXTURE_VENUE.category}`, "en")),
    ).toBeDefined();
    expect(screen.getByText(t("detail.getDirections", "en"))).toBeDefined();
    expect(screen.getByText(t("detail.viewOnMap", "en"))).toBeDefined();
    // Venue name/address are real data, not translated — always visible.
    expect(screen.getByRole("heading", { level: 1, name: FIXTURE_VENUE.name })).toBeDefined();
  });

  test("renders Spanish category label and CTAs when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <VenueContent venue={FIXTURE_VENUE} />
      </LocaleProvider>,
    );
    expect(
      screen.getByText(t(`category.full.${FIXTURE_VENUE.category}`, "es")),
    ).toBeDefined();
    expect(screen.getByText(t("detail.getDirections", "es"))).toBeDefined();
    expect(screen.getByText(t("detail.viewOnMap", "es"))).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: FIXTURE_VENUE.name })).toBeDefined();
  });
});

// ─── OSM attribution (#133 4.5) ────────────────────────────────────────────────
// The page's own OSM-only credit line moved into SiteFooter (SEO/AEO plan
// Phase 0), whose credit shows on every venue page, exactly once.

describe("VenueContent — OSM attribution", () => {
  test("shows one OpenStreetMap copyright link for an OSM-sourced venue", () => {
    render(<VenueContent venue={OSM_FIXTURE_VENUE} />);
    const links = screen.getAllByRole("link", { name: t("osm.attribution", "en") });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(OSM_COPYRIGHT_URL);
  });

  test("shows the footer's credit on a non-OSM venue too (same as /venues)", () => {
    render(<VenueContent venue={FIXTURE_VENUE} />);
    expect(screen.getAllByRole("link", { name: t("osm.attribution", "en") })).toHaveLength(1);
  });

  test("renders the ES translation", () => {
    render(
      <LocaleProvider initialLocale="es">
        <VenueContent venue={OSM_FIXTURE_VENUE} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: t("osm.attribution", "es") })).toBeDefined();
  });
});

// ─── Crawl links (SEO/AEO plan Phase 0) ────────────────────────────────────────

describe("VenueContent — breadcrumb and footer links", () => {
  test("breadcrumb: Map (/) › All places (/venues) › venue name (current page)", () => {
    render(<VenueContent venue={FIXTURE_VENUE} />);
    const nav = screen.getByRole("navigation", { name: t("breadcrumb.label", "en") });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/venues"]);
    expect(within(nav).getByText(FIXTURE_VENUE.name).getAttribute("aria-current")).toBe("page");
  });

  test("the page links to /venues and /resources from its footer", () => {
    render(<VenueContent venue={FIXTURE_VENUE} />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: t("footer.venues", "en") }).getAttribute("href")).toBe("/venues");
    expect(within(footer).getByRole("link", { name: t("footer.resources", "en") }).getAttribute("href")).toBe("/resources");
  });

  test("breadcrumb is localized in ES", () => {
    render(
      <LocaleProvider initialLocale="es">
        <VenueContent venue={FIXTURE_VENUE} />
      </LocaleProvider>,
    );
    const nav = screen.getByRole("navigation", { name: t("breadcrumb.label", "es") });
    expect(within(nav).getByRole("link", { name: t("breadcrumb.map", "es") })).toBeDefined();
  });
});
