/**
 * AdminBoxesMap tests — same react-map-gl mocking convention
 * src/__tests__/Map.test.tsx already established (mock the whole module;
 * jsdom has no real WebGL context). Covers: a marker per entry with the
 * right status color/label, click navigates to the box's edit screen, the
 * legend lists every status, and the "map unavailable" fallback when the
 * Mapbox token isn't configured.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BoxHealthEntry } from "@/lib/boxHealth";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  return {
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "mapgl-root" }, children),
    Marker: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "mapbox-marker" }, children),
    AttributionControl: () => null,
  };
});

import AdminBoxesMap from "@/components/AdminBoxesMap";

function makeEntry(overrides: Partial<BoxHealthEntry> = {}): BoxHealthEntry {
  return {
    venueId: "box-1",
    name: "Blessing Box - Routt",
    address: "216 W Routt Ave",
    lat: 38.27,
    lng: -104.6,
    health: { status: "ok", latest: null, daysSinceLastReport: null },
    caretaker: null,
    removedOn: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockPush.mockReset();
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "pk.test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AdminBoxesMap", () => {
  test("renders a marker per entry, labeled with its status, and a legend covering every status", () => {
    render(<AdminBoxesMap entries={[makeEntry({ health: { status: "empty", latest: null, daysSinceLastReport: 2 } })]} />);

    const marker = screen.getByRole("button", { name: "Blessing Box - Routt — Empty" });
    expect(marker).toBeDefined();
    for (const label of ["OK", "Low", "Empty", "Problem", "Quiet"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  test("clicking a marker navigates to the box's edit screen", async () => {
    render(<AdminBoxesMap entries={[makeEntry()]} />);

    await userEvent.click(screen.getByRole("button", { name: /Blessing Box - Routt/ }));

    expect(mockPush).toHaveBeenCalledWith("/admin/venues/box-1/edit");
  });

  test("falls back to a plain message when the Mapbox token isn't configured", () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    render(<AdminBoxesMap entries={[makeEntry()]} />);

    expect(screen.getByText(/Map unavailable/)).toBeDefined();
    expect(screen.queryByTestId("mapgl-root")).toBeNull();
  });
});
