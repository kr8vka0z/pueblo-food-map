/**
 * StaticLocationMap tests (#678) — URL shape (center, pin, color), the two
 * placeholder states (no token / invalid coordinates), and the Google Maps
 * link.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StaticLocationMap, { buildStaticMapUrl } from "@/components/StaticLocationMap";

describe("buildStaticMapUrl", () => {
  test("centers on the given coordinates, at zoom 13.5, 420x240@2x", () => {
    const url = buildStaticMapUrl(38.27, -104.6, "blessing_box", "tok123");
    expect(url).toContain("(-104.6,38.27)/-104.6,38.27,13.5/420x240@2x");
    expect(url).toContain("access_token=tok123");
  });

  test("pin color matches the category's public-map color (blessing_box -> raspberry)", () => {
    const url = buildStaticMapUrl(38.27, -104.6, "blessing_box", "tok123");
    expect(url).toContain("pin-l+C2447B(");
  });

  test("a different category gets its own color (pantry -> cranberry)", () => {
    const url = buildStaticMapUrl(38.27, -104.6, "pantry", "tok123");
    expect(url).toContain("pin-l+BE2D45(");
  });

  test("no category selected yet falls back to a neutral pin color", () => {
    const url = buildStaticMapUrl(38.27, -104.6, "", "tok123");
    expect(url).toContain("pin-l+6A645A(");
  });
});

describe("StaticLocationMap", () => {
  const ORIGINAL_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL_TOKEN;
    vi.unstubAllGlobals();
  });

  test("valid coordinates: renders the map image and a Google Maps link", () => {
    render(<StaticLocationMap lat={38.27} lng={-104.6} category="blessing_box" name="Routt Box" address="216 W Routt Ave" />);
    const img = screen.getByRole("img", { name: "Map of Routt Box at 216 W Routt Ave" });
    expect(img.getAttribute("src")).toContain("pin-l+C2447B(-104.6,38.27)");
    const link = screen.getByRole("link", { name: "Open in Google Maps" });
    expect(link.getAttribute("href")).toContain("destination=38.27%2C-104.6");
  });

  test("missing coordinates: shows the placeholder, no image", () => {
    render(<StaticLocationMap lat={null} lng={null} category="pantry" name="" address="" />);
    expect(screen.getByText("Add coordinates to see the map.")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("invalid latitude (out of range): shows the placeholder", () => {
    render(<StaticLocationMap lat={200} lng={-104.6} category="pantry" name="X" address="Y" />);
    expect(screen.getByText("Add coordinates to see the map.")).toBeDefined();
  });

  test("no Mapbox token configured: fails soft with an 'unavailable' message", () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "";
    render(<StaticLocationMap lat={38.27} lng={-104.6} category="pantry" name="X" address="Y" />);
    expect(screen.getByText("Map unavailable right now.")).toBeDefined();
  });
});
