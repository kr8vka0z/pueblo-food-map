/**
 * VenueMarker smoke tests
 *
 * Tests the icon HTML output and aria-label content for all 7 categories.
 * Leaflet (L.divIcon) is mocked because jsdom has no DOM canvas/SVG render.
 */

import { describe, expect, test, vi, beforeEach } from "vitest";

// ─── Mock Leaflet ─────────────────────────────────────────────────────────────
// L.divIcon just records what it was passed. We inspect opts.html.
vi.mock("leaflet", () => ({
  default: {
    divIcon: vi.fn((opts: unknown) => ({ _iconOpts: opts })),
  },
}));

import L from "leaflet";
import { createVenueIcon } from "@/components/VenueMarker";
import type { VenueCategory } from "@/types/venue";

const ALL_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
];

const EXPECTED_COLORS: Record<VenueCategory, string> = {
  pantry:           "#BE2D45",
  grocery:          "#1F4E8C",
  convenience:      "#0F6573",
  farm:             "#92591D",
  garden:           "#2C5F4F",
  edible_landscape: "#58772B",
  meal_site:        "#6B3FA0",
};

const EXPECTED_READABLE: Record<VenueCategory, string> = {
  pantry:           "Food pantry",
  grocery:          "Grocery store",
  convenience:      "Convenience store",
  farm:             "Farm",
  garden:           "Community garden",
  edible_landscape: "Edible landscape",
  meal_site:        "Meal site",
};

const SAGE_500 = "#4A8466";

function getHtml(opts: ReturnType<typeof createVenueIcon>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (opts as any)._iconOpts.html as string;
}

beforeEach(() => {
  vi.mocked(L.divIcon).mockClear();
});

describe("createVenueIcon", () => {
  describe("default (not selected)", () => {
    ALL_CATEGORIES.forEach((cat) => {
      test(`${cat}: renders MapPin with correct category fill color`, () => {
        const icon = createVenueIcon({ category: cat });
        const html = getHtml(icon);

        expect(html).toContain(EXPECTED_COLORS[cat]);
        // MapPin SVG path element should be present
        expect(html).toContain("<svg");
        // White stroke for legibility
        expect(html).toContain("#FFFFFF");
      });

      test(`${cat}: aria-label contains readable category name`, () => {
        const icon = createVenueIcon({ category: cat });
        const html = getHtml(icon);

        expect(html).toContain(EXPECTED_READABLE[cat]);
      });

      test(`${cat}: aria-label includes venue name when provided`, () => {
        const icon = createVenueIcon({ category: cat, name: "Test Venue" });
        const html = getHtml(icon);

        expect(html).toContain("Test Venue");
        expect(html).toContain(EXPECTED_READABLE[cat]);
      });
    });

    test("container has tabindex='0' for keyboard focus", () => {
      const icon = createVenueIcon({ category: "pantry" });
      const html = getHtml(icon);
      expect(html).toContain('tabindex="0"');
    });

    test("container has role='img'", () => {
      const icon = createVenueIcon({ category: "grocery" });
      const html = getHtml(icon);
      expect(html).toContain('role="img"');
    });

    test("has drop-shadow filter", () => {
      const icon = createVenueIcon({ category: "farm" });
      const html = getHtml(icon);
      expect(html).toContain("drop-shadow");
    });

    test("does NOT include sage ring color in default state", () => {
      const icon = createVenueIcon({ category: "garden" });
      const html = getHtml(icon);
      // Sage ring should not appear unless selected
      expect(html).not.toContain(SAGE_500);
    });
  });

  describe("selected state", () => {
    test("includes sage ring color (#4A8466)", () => {
      const icon = createVenueIcon({ category: "pantry", selected: true });
      const html = getHtml(icon);
      expect(html).toContain(SAGE_500);
    });

    test("ring is a <circle> with stroke matching sage-500", () => {
      const icon = createVenueIcon({ category: "grocery", selected: true });
      const html = getHtml(icon);
      // SVG circle ring for selected state
      expect(html).toContain("<circle");
      expect(html).toContain(`stroke="${SAGE_500}"`);
      expect(html).toContain('stroke-width="4"');
    });

    test("still renders category fill color when selected", () => {
      const icon = createVenueIcon({ category: "meal_site", selected: true });
      const html = getHtml(icon);
      expect(html).toContain(EXPECTED_COLORS.meal_site);
    });

    test("selected container is larger than default", () => {
      const defaultIcon = createVenueIcon({ category: "pantry" });
      const selectedIcon = createVenueIcon({ category: "pantry", selected: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultOpts = (defaultIcon as any)._iconOpts;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectedOpts = (selectedIcon as any)._iconOpts;
      const [defaultW] = defaultOpts.iconSize as [number, number];
      const [selectedW] = selectedOpts.iconSize as [number, number];
      expect(selectedW).toBeGreaterThan(defaultW);
    });
  });

  describe("L.divIcon options", () => {
    test("className is empty string (no Leaflet default white box)", () => {
      createVenueIcon({ category: "pantry" });
      const call = vi.mocked(L.divIcon).mock.calls[0][0] as Record<string, unknown>;
      expect(call.className).toBe("");
    });

    test("iconAnchor pins bottom-center of the icon", () => {
      createVenueIcon({ category: "pantry" });
      const call = vi.mocked(L.divIcon).mock.calls[0][0] as Record<string, unknown>;
      const [anchorX, anchorY] = call.iconAnchor as [number, number];
      const [iconW, iconH] = call.iconSize as [number, number];
      // Bottom-center: x = half width, y = full height
      expect(anchorX).toBe(iconW / 2);
      expect(anchorY).toBe(iconH);
    });
  });
});
