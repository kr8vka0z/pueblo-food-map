/**
 * VenueContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component (the highest-risk page in the repo —
 * see src/app/venue/[id]/page.tsx's own header comment) renders EN by
 * default and ES when wrapped in a LocaleProvider set to "es" (#289),
 * including the category label and the "View on the map" CTA that used to
 * be a hardcoded English string.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("VenueContent — OSM attribution", () => {
  test("shows an OpenStreetMap copyright link for an OSM-sourced venue", () => {
    render(<VenueContent venue={OSM_FIXTURE_VENUE} />);
    const link = screen.getByRole("link", { name: t("osm.attribution", "en") });
    expect(link.getAttribute("href")).toBe(OSM_COPYRIGHT_URL);
  });

  test("does not show it for a non-OSM-sourced venue", () => {
    render(<VenueContent venue={FIXTURE_VENUE} />);
    expect(screen.queryByRole("link", { name: t("osm.attribution", "en") })).toBeNull();
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
