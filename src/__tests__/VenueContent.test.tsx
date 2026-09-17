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

const FIXTURE_VENUE = venues[0];

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
