/**
 * Operator attribution tests — issue #63.
 *
 * Verifies:
 *   1. DesktopVenueWindow renders "Operated by Pueblo Food Project" (with link)
 *      when venue.operator is set — in both quick and expanded views.
 *   2. DesktopVenueWindow renders nothing operator-related when venue.operator
 *      is undefined (pantry, grocery, etc.)
 *   3. BottomSheet quick-summary and full-detail both render the operator line.
 *   4. BottomSheet omits the line when venue.operator is undefined.
 *   5. All 10 pfpVenues in venues.ts have operator: "Pueblo Food Project".
 *   6. No non-PFP venue in the combined venues list has an operator field.
 *   7. i18n: ES locale shows "Operado por Pueblo Food Project".
 *
 * Mock strategy:
 *   DesktopVenueWindow requires a mapboxMap instance to compute position.
 *   We pass a minimal stub (project → {x:0,y:0}; getContainer → offsetWidth/Height 1000;
 *   on/off are no-ops) so position is deterministic and the component renders.
 *
 *   BottomSheet uses vaul (Drawer). vaul renders a portal; we wrap tests in a
 *   simple div with createPortal behaviour captured via @testing-library/react
 *   render (baseElement covers portals). Pass snap via snap-point advance.
 *
 *   react-map-gl/mapbox is not used by these components — no mock needed here.
 */

import { describe, test, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── jsdom shims required by vaul ────────────────────────────────────────────
// vaul's Drawer.Content calls event.target.setPointerCapture() in onPointerDown.
// jsdom does not implement setPointerCapture / releasePointerCapture on Element.
// Without these stubs, every userEvent interaction with a vaul Drawer produces
// an unhandled TypeError that escapes the test boundary and fails the run.
beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
});

import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import BottomSheet from "@/components/BottomSheet";
import { pfpVenues, venues } from "@/data/venues";
import type { Venue } from "@/types/venue";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-venue",
    name: "Test Venue",
    category: "garden",
    lat: 38.254,
    lng: -104.62,
    address: "123 Test St, Pueblo, CO",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

/** Minimal mapboxgl.Map stub for DesktopVenueWindow position logic. */
const mockMapboxMap = {
  project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
};

// ─── DesktopVenueWindow — quick view ─────────────────────────────────────────

describe("DesktopVenueWindow — operator attribution (quick view)", () => {
  test("shows operator line when venue.operator is set", () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.getByText("Pueblo Food Project")).toBeDefined();
    expect(screen.getByText(/Operated by/)).toBeDefined();
  });

  test("operator name is a link to pueblofoodproject.org", () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    const links = screen.getAllByRole("link");
    const operatorLink = links.find(
      (l) => l.getAttribute("href") === "https://pueblofoodproject.org/",
    );
    expect(operatorLink).toBeDefined();
    expect(operatorLink?.getAttribute("target")).toBe("_blank");
    expect(operatorLink?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("omits operator line when venue.operator is undefined (pantry)", () => {
    const venue = makeVenue({ category: "pantry", operator: undefined });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.queryByText(/Operated by/)).toBeNull();
    expect(screen.queryByText("Pueblo Food Project")).toBeNull();
  });

  test("shows ES locale text: 'Operado por'", () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="es"
      />,
    );
    expect(screen.getByText(/Operado por/)).toBeDefined();
    // Org name stays as-is (proper noun)
    expect(screen.getByText("Pueblo Food Project")).toBeDefined();
  });
});

// ─── DesktopVenueWindow — expanded view ──────────────────────────────────────

describe("DesktopVenueWindow — operator attribution (expanded view)", () => {
  test("shows operator line in expanded view", () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={true}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.getByText(/Operated by/)).toBeDefined();
    expect(screen.getByText("Pueblo Food Project")).toBeDefined();
  });

  test("omits operator line in expanded view when undefined (grocery)", () => {
    const venue = makeVenue({ category: "grocery", operator: undefined });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={true}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.queryByText(/Operated by/)).toBeNull();
  });
});

// ─── BottomSheet — operator attribution (v3 boolean-toggle model) ─────────────
// The v3 BottomSheet removed the three-snap-point model (peek → quick → full).
// Operator attribution is now visible in the summary (collapsed) state — no
// interaction required to see it.

describe("BottomSheet — operator attribution (quick snap)", () => {
  test("shows operator line at quick snap when venue.operator is set", () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    render(
      <BottomSheet venue={venue} onClose={vi.fn()} locale="en" />,
    );
    expect(screen.getByText(/Operated by/)).toBeDefined();
    expect(screen.getByText("Pueblo Food Project")).toBeDefined();
  });

  test("omits operator line at quick snap when venue.operator is undefined", () => {
    const venue = makeVenue({ category: "pantry", operator: undefined });
    render(
      <BottomSheet venue={venue} onClose={vi.fn()} locale="en" />,
    );
    expect(screen.queryByText(/Operated by/)).toBeNull();
  });

  test("shows ES 'Operado por' at quick snap", () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    render(
      <BottomSheet venue={venue} onClose={vi.fn()} locale="es" />,
    );
    expect(screen.getByText(/Operado por/)).toBeDefined();
  });
});

// ─── BottomSheet — full snap (expanded detail) ───────────────────────────────

describe("BottomSheet — operator attribution (full snap)", () => {
  test("shows operator line at full snap", async () => {
    const venue = makeVenue({ operator: "Pueblo Food Project" });
    const user = userEvent.setup();
    render(
      <BottomSheet venue={venue} onClose={vi.fn()} locale="en" />,
    );
    // Operator is always visible (in summary), no interaction needed.
    expect(screen.getByText(/Operated by/)).toBeDefined();
    expect(screen.getByText("Pueblo Food Project")).toBeDefined();
    // It also stays visible after expanding
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.getByText(/Operated by/)).toBeDefined();
  });

  test("omits operator line at full snap when undefined", async () => {
    const venue = makeVenue({ category: "pantry", operator: undefined });
    const user = userEvent.setup();
    render(
      <BottomSheet venue={venue} onClose={vi.fn()} locale="en" />,
    );
    // No operator in summary
    expect(screen.queryByText(/Operated by/)).toBeNull();
    // Still absent after expanding
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.queryByText(/Operated by/)).toBeNull();
  });
});

// ─── Data integrity ───────────────────────────────────────────────────────────

describe("venues data — operator field integrity", () => {
  test("all 10 pfpVenues have operator: 'Pueblo Food Project'", () => {
    expect(pfpVenues).toHaveLength(10);
    const withOperator = pfpVenues.filter((v) => v.operator === "Pueblo Food Project");
    expect(withOperator).toHaveLength(10);
  });

  test("all 6 garden venues have operator set", () => {
    const gardens = pfpVenues.filter((v) => v.category === "garden");
    expect(gardens).toHaveLength(6);
    gardens.forEach((v) => {
      expect(v.operator).toBe("Pueblo Food Project");
    });
  });

  test("all 4 edible_landscape venues have operator set", () => {
    const landscapes = pfpVenues.filter((v) => v.category === "edible_landscape");
    expect(landscapes).toHaveLength(4);
    landscapes.forEach((v) => {
      expect(v.operator).toBe("Pueblo Food Project");
    });
  });

  test("no pantry venue in combined venues list has an operator field", () => {
    const pantries = venues.filter((v) => v.category === "pantry");
    expect(pantries.length).toBeGreaterThan(0);
    pantries.forEach((v) => {
      expect(v.operator).toBeUndefined();
    });
  });

  test("any grocery venue operator field, if present, is a non-empty string (not an OSM artifact)", () => {
    // issue #98: OSM-derived grocery venues may have operator set (e.g. "Walmart").
    // This invariant changed from "must be undefined" to "if set, must be clean string".
    const groceries = venues.filter((v) => v.category === "grocery");
    expect(groceries.length).toBeGreaterThan(0);
    groceries.forEach((v) => {
      if (v.operator !== undefined) {
        expect(typeof v.operator).toBe("string");
        expect(v.operator.length).toBeGreaterThan(0);
        expect(v.operator).not.toMatch(/osm/i);
        expect(v.operator).not.toMatch(/openstreetmap/i);
      }
    });
  });
});
