/**
 * VenueMarker smoke tests — Mapbox Marker implementation.
 *
 * Minimum-viable test suite to keep CI green after the #45 rewrite.
 * Full test coverage (interaction, keyboard, a11y axe) is deferred to #48.
 *
 * NOTE: react-map-gl's Marker requires a MapContext. We mock it so
 * VenueMarker can render in jsdom without a real Mapbox GL context.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Venue } from "@/types/venue";

// ─── Mock react-map-gl/mapbox ─────────────────────────────────────────────────
// Marker just renders its children in a div; we don't need the real GL context.
vi.mock("react-map-gl/mapbox", () => ({
  default: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="mapgl">{children}</div>
  )),
  Marker: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  )),
}));

// ─── Mock mapbox-gl/dist/mapbox-gl.css ───────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

import VenueMarker from "@/components/VenueMarker";
import type { VenueCategory } from "@/types/venue";
import React from "react";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-venue",
    name: "Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Test St",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

const ALL_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
];

const EXPECTED_READABLE: Record<VenueCategory, string> = {
  pantry: "Food pantry",
  grocery: "Grocery store",
  convenience: "Convenience store",
  farm: "Farm",
  garden: "Community garden",
  edible_landscape: "Edible landscape",
  meal_site: "Meal site",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("VenueMarker", () => {
  describe("aria-label", () => {
    ALL_CATEGORIES.forEach((cat) => {
      test(`${cat}: includes venue name and readable category`, () => {
        const venue = makeVenue({ category: cat, name: "My Venue" });
        render(
          <VenueMarker
            venue={venue}
            selected={false}
            onClick={vi.fn()}
          />,
        );
        const btn = screen.getByRole("button");
        expect(btn).toHaveAttribute(
          "aria-label",
          expect.stringContaining("My Venue"),
        );
        expect(btn).toHaveAttribute(
          "aria-label",
          expect.stringContaining(EXPECTED_READABLE[cat]),
        );
      });
    });

    test("includes formatted distance when distanceMiles provided", () => {
      const venue = makeVenue({ name: "Close Pantry" });
      render(
        <VenueMarker
          venue={venue}
          selected={false}
          distanceMiles={1.3}
          onClick={vi.fn()}
        />,
      );
      const btn = screen.getByRole("button");
      expect(btn).toHaveAttribute(
        "aria-label",
        expect.stringContaining("1.3 mi"),
      );
    });

    test("omits distance when distanceMiles not provided", () => {
      const venue = makeVenue({ name: "Far Pantry" });
      render(
        <VenueMarker
          venue={venue}
          selected={false}
          onClick={vi.fn()}
        />,
      );
      const btn = screen.getByRole("button");
      // Should not contain a distance pattern
      expect(btn.getAttribute("aria-label")).not.toMatch(/\d+\.?\d* mi/);
    });
  });

  describe("click handler", () => {
    test("calls onClick when button is clicked", () => {
      const onClick = vi.fn();
      const venue = makeVenue();
      render(
        <VenueMarker
          venue={venue}
          selected={false}
          onClick={onClick}
        />,
      );
      screen.getByRole("button").click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("visual state", () => {
    test("selected marker wraps a Marker with a button child", () => {
      const venue = makeVenue();
      const { container } = render(
        <VenueMarker
          venue={venue}
          selected={true}
          onClick={vi.fn()}
        />,
      );
      // Marker mock renders a [data-testid=marker] div containing the button
      expect(container.querySelector("[data-testid='marker']")).toBeTruthy();
      expect(container.querySelector("button")).toBeTruthy();
    });

    test("non-selected marker also renders a button", () => {
      const venue = makeVenue();
      const { container } = render(
        <VenueMarker
          venue={venue}
          selected={false}
          onClick={vi.fn()}
        />,
      );
      expect(container.querySelector("button")).toBeTruthy();
    });
  });
});
