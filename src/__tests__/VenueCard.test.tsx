/**
 * VenueCard — category label locale coverage.
 *
 * WHY this file exists: the category name on a venue card was rendered from
 * the raw English `categoryLabels` map instead of the translation table, so a
 * Spanish reader got "Food Pantry" on a card whose every other line was
 * Spanish. The Spanish strings (`category.full.*`) already existed in
 * src/lib/i18n.ts — nothing was reading them here. Same bug was live in
 * BottomSheet, DesktopVenueWindow and the map's hover tooltip.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueCard from "@/components/VenueCard";
import type { Venue } from "@/types/venue";

const pantry: Venue = {
  id: "test-pantry-1",
  name: "Test Pantry",
  category: "pantry",
  lat: 38.25,
  lng: -104.6,
  address: "123 Main St, Pueblo, CO 81003",
  source: "pfp",
  last_verified: "2026-05-14",
};

describe("VenueCard — category label follows the active locale", () => {
  test("renders the English category by default", () => {
    render(<VenueCard venue={pantry} isSelected={false} onClick={vi.fn()} />);
    expect(screen.getByText(/Food Pantry/)).toBeDefined();
  });

  test("renders the Spanish category when locale is es", () => {
    render(<VenueCard venue={pantry} isSelected={false} onClick={vi.fn()} locale="es" />);
    expect(screen.getByText(/Despensa de alimentos/)).toBeDefined();
    expect(screen.queryByText(/Food Pantry/)).toBeNull();
  });
});
