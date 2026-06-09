/**
 * ListView tests (#129)
 *
 * Full-screen list view overlay — renders venues, shows count header,
 * fires onSelect, and handles empty state with clear-filters button.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ListView from "@/components/ListView";
import type { Venue } from "@/types/venue";

// ─── Fixture ─────────────────────────────────────────────────────────────────

const FIXTURE_VENUES: Array<Venue & { distanceMiles: number }> = [
  {
    id: "venue-1",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.26,
    lng: -104.6,
    address: "101 E 5th St, Pueblo, CO 81001",
    source: "manual",
    last_verified: "2025-01-01",
    distanceMiles: 0.3,
  },
  {
    id: "venue-2",
    name: "Main Street Grocery",
    category: "grocery",
    lat: 38.255,
    lng: -104.61,
    address: "200 N Main St, Pueblo, CO 81003",
    source: "manual",
    last_verified: "2025-01-01",
    distanceMiles: 0.8,
  },
  {
    id: "venue-3",
    name: "Westside Garden",
    category: "garden",
    lat: 38.25,
    lng: -104.62,
    address: "300 W 4th St, Pueblo, CO 81003",
    source: "manual",
    last_verified: "2025-01-01",
    distanceMiles: 1.2,
  },
];

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("ListView — renders venue list", () => {
  test("renders each venue's name", () => {
    render(
      <ListView
        venues={FIXTURE_VENUES}
        selectedVenueId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.getByText("Westside Garden")).toBeDefined();
  });

  test("renders count/sorted header with venue count", () => {
    render(
      <ListView
        venues={FIXTURE_VENUES}
        selectedVenueId={null}
        onSelect={vi.fn()}
      />,
    );
    // Matches the "{count} places near you" key — 3 venues
    expect(screen.getByText(/3 places near you/i)).toBeDefined();
  });

  test("renders 'Sorted by distance' text", () => {
    render(
      <ListView
        venues={FIXTURE_VENUES}
        selectedVenueId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/sorted by distance/i)).toBeDefined();
  });
});

// ─── Interaction ─────────────────────────────────────────────────────────────

describe("ListView — venue selection", () => {
  test("clicking a venue row calls onSelect with that venue id", () => {
    const onSelect = vi.fn();
    render(
      <ListView
        venues={FIXTURE_VENUES}
        selectedVenueId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Eastside Pantry"));
    expect(onSelect).toHaveBeenCalledWith("venue-1");
  });

  test("clicking a different venue row calls onSelect with its id", () => {
    const onSelect = vi.fn();
    render(
      <ListView
        venues={FIXTURE_VENUES}
        selectedVenueId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Westside Garden"));
    expect(onSelect).toHaveBeenCalledWith("venue-3");
  });
});

// ─── Empty state ─────────────────────────────────────────────────────────────

describe("ListView — empty state", () => {
  test("shows empty message when venues=[]", () => {
    render(
      <ListView
        venues={[]}
        selectedVenueId={null}
        onSelect={vi.fn()}
      />,
    );
    // "No places match your filters." — empty.title key
    expect(screen.getByText(/no places match/i)).toBeDefined();
  });

  test("shows clear button when showClearFilters=true and onClearFilters provided", () => {
    const onClearFilters = vi.fn();
    render(
      <ListView
        venues={[]}
        selectedVenueId={null}
        onSelect={vi.fn()}
        showClearFilters={true}
        onClearFilters={onClearFilters}
      />,
    );
    const clearBtn = screen.getByRole("button", { name: /clear filters/i });
    expect(clearBtn).toBeDefined();
  });

  test("clicking clear button calls onClearFilters", () => {
    const onClearFilters = vi.fn();
    render(
      <ListView
        venues={[]}
        selectedVenueId={null}
        onSelect={vi.fn()}
        showClearFilters={true}
        onClearFilters={onClearFilters}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  test("does NOT show clear button when showClearFilters=false", () => {
    render(
      <ListView
        venues={[]}
        selectedVenueId={null}
        onSelect={vi.fn()}
        showClearFilters={false}
        onClearFilters={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /clear filters/i })).toBeNull();
  });
});

// ─── ES locale ───────────────────────────────────────────────────────────────

describe("ListView — ES locale", () => {
  test("renders ES count text", () => {
    render(
      <ListView
        venues={FIXTURE_VENUES}
        selectedVenueId={null}
        onSelect={vi.fn()}
        locale="es"
      />,
    );
    expect(screen.getByText(/3 lugares cerca de ti/i)).toBeDefined();
  });
});
