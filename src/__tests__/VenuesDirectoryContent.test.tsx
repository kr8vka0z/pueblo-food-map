/**
 * VenuesDirectoryContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component renders EN by default and ES when
 * wrapped in a LocaleProvider set to "es" (#289), including per-venue hours
 * text and the category section headings. groupVenuesByCategory itself is
 * covered by src/__tests__/venues.test.tsx — this file only exercises
 * rendering, not grouping.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import VenuesDirectoryContent from "@/components/VenuesDirectoryContent";
import type { Venue } from "@/types/venue";

// PageNav (bottom nav + drawer) has its own test; stub it so this page test
// doesn't need next/navigation or matchMedia.
vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));

const FIXTURE_GROUPS = [
  {
    category: "pantry" as const,
    items: [
      {
        id: "v1",
        name: "Test Pantry",
        category: "pantry" as const,
        lat: 38.27,
        lng: -104.6,
        address: "1 Test St, Pueblo, CO",
        source: "test",
        last_verified: "2026-01-01",
      } satisfies Venue,
    ],
  },
];

describe("VenuesDirectoryContent — locale", () => {
  test("renders English heading and category label with no provider (default locale)", () => {
    render(<VenuesDirectoryContent groups={FIXTURE_GROUPS} />);
    expect(
      screen.getByRole("heading", { level: 1, name: t("venues.heading", "en") }),
    ).toBeDefined();
    expect(screen.getByText(t("category.full.pantry", "en"))).toBeDefined();
    expect(screen.getByText(t("venues.noHours", "en"))).toBeDefined();
  });

  test("renders Spanish heading and category label when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <VenuesDirectoryContent groups={FIXTURE_GROUPS} />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("venues.heading", "es") }),
    ).toBeDefined();
    expect(screen.getByText(t("category.full.pantry", "es"))).toBeDefined();
    expect(screen.getByText(t("venues.noHours", "es"))).toBeDefined();
  });
});
