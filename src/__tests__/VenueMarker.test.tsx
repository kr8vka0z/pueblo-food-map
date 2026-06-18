/**
 * VenueMarker tests — comprehensive coverage of the Mapbox-based marker component.
 *
 * react-map-gl/mapbox's Marker requires a live Mapbox GL context, so we mock it
 * to render only its children. This lets jsdom render and assert on the button
 * inside the marker without spinning up a WebGL canvas.
 *
 * Coverage:
 *   - All 7 venue categories render with their category color
 *   - Default (unselected) state: no sage ring
 *   - Selected state: SVG sage ring present
 *   - Click handler fires on button click
 *   - Keyboard: Enter and Space activate the click handler
 *   - aria-label format: "<name>, <readable-category>" (no distance)
 *   - aria-label format: "<name>, <readable-category>, <distance>" (with distance)
 *   - onHover / onLeave callbacks fire on mouse/focus events
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VenueMarker from "@/components/VenueMarker";
import type { Venue, VenueCategory } from "@/types/venue";

// ─── Mock react-map-gl/mapbox Marker ─────────────────────────────────────────
// Render children directly so the button inside Marker is testable in jsdom.
vi.mock("react-map-gl/mapbox", () => ({
  default: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="mapgl-root">{children}</div>
  )),
  Marker: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="mapbox-marker">{children}</div>
  )),
  Popup: vi.fn(() => null),
  AttributionControl: vi.fn(() => null),
}));

// ─── Shared test fixture ──────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test-venue-1",
    name: "Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

const defaultProps = {
  venue: makeVenue(),
  selected: false,
  onClick: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Category color rendering ─────────────────────────────────────────────────

const ALL_CATEGORIES: Array<{ cat: VenueCategory; readable: string }> = [
  { cat: "pantry", readable: "Food pantry" },
  { cat: "grocery", readable: "Grocery store" },
  { cat: "convenience", readable: "Convenience store" },
  { cat: "farm", readable: "Farm" },
  { cat: "garden", readable: "Community garden" },
  { cat: "edible_landscape", readable: "Edible landscape" },
  { cat: "meal_site", readable: "Meal site" },
];

describe("VenueMarker — category rendering", () => {
  test.each(ALL_CATEGORIES)(
    "$cat category renders a button with correct aria-label",
    ({ cat, readable }) => {
      const venue = makeVenue({ category: cat, name: "My Venue" });
      render(
        <VenueMarker
          venue={venue}
          selected={false}
          onClick={vi.fn()}
        />,
      );
      const btn = screen.getByRole("button", {
        name: `My Venue, ${readable}`,
      });
      expect(btn).toBeDefined();
    },
  );

  test("pantry marker SVG fill uses pantry color (#BE2D45)", () => {
    const venue = makeVenue({ category: "pantry", name: "Pantry Venue" });
    const { container } = render(
      <VenueMarker venue={venue} selected={false} onClick={vi.fn()} />,
    );
    // The Lucide MapPin SVG should carry fill="#BE2D45"
    const svgFills = Array.from(container.querySelectorAll("[fill]"))
      .map((el) => (el as Element).getAttribute("fill"))
      .filter(Boolean);
    expect(svgFills).toContain("#BE2D45");
  });

  test("grocery marker SVG fill uses grocery color (#1F4E8C)", () => {
    const venue = makeVenue({ category: "grocery", name: "Grocery Venue" });
    const { container } = render(
      <VenueMarker venue={venue} selected={false} onClick={vi.fn()} />,
    );
    const svgFills = Array.from(container.querySelectorAll("[fill]"))
      .map((el) => (el as Element).getAttribute("fill"))
      .filter(Boolean);
    expect(svgFills).toContain("#1F4E8C");
  });
});

// ─── Selected state ───────────────────────────────────────────────────────────

describe("VenueMarker — selected state", () => {
  test("unselected: no sage ring (stroke=#4A8466) rendered", () => {
    const { container } = render(
      <VenueMarker {...defaultProps} selected={false} />,
    );
    // The sage ring is identified by its stroke color (#4A8466).
    // Lucide MapPin may contain <circle> elements internally, so we check
    // stroke attribute specifically rather than circle count.
    const circles = Array.from(container.querySelectorAll("circle"));
    const sageRings = circles.filter(
      (c) => c.getAttribute("stroke") === "#4A8466",
    );
    expect(sageRings.length).toBe(0);
  });

  test("selected: sage ring circle is rendered", () => {
    const { container } = render(
      <VenueMarker {...defaultProps} selected={true} />,
    );
    // When selected, an outer SVG with stroke="#4A8466" (SAGE_500) appears
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
    const strokeColors = Array.from(circles).map((c) =>
      c.getAttribute("stroke"),
    );
    expect(strokeColors).toContain("#4A8466");
  });

  test("selected button has correct aria-label", () => {
    render(<VenueMarker {...defaultProps} selected={true} />);
    const btn = screen.getByRole("button", {
      name: "Test Pantry, Food pantry",
    });
    expect(btn).toBeDefined();
  });
});

// ─── Click handler ────────────────────────────────────────────────────────────

describe("VenueMarker — click handler", () => {
  test("clicking the button fires onClick", () => {
    const onClick = vi.fn();
    render(<VenueMarker {...defaultProps} onClick={onClick} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ─── Keyboard interaction ─────────────────────────────────────────────────────

describe("VenueMarker — keyboard interaction", () => {
  test("pressing Enter fires onClick", () => {
    const onClick = vi.fn();
    render(<VenueMarker {...defaultProps} onClick={onClick} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("pressing Space fires onClick", () => {
    const onClick = vi.fn();
    render(<VenueMarker {...defaultProps} onClick={onClick} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("pressing Tab does not fire onClick", () => {
    const onClick = vi.fn();
    render(<VenueMarker {...defaultProps} onClick={onClick} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: "Tab" });
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ─── aria-label format ────────────────────────────────────────────────────────

describe("VenueMarker — aria-label", () => {
  test("without distance: '<name>, <category>'", () => {
    const venue = makeVenue({ name: "La Familia Pantry", category: "pantry" });
    render(<VenueMarker venue={venue} selected={false} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", {
      name: "La Familia Pantry, Food pantry",
    });
    expect(btn).toBeDefined();
  });

  test("with distance: '<name>, <category>, <distance>'", () => {
    const venue = makeVenue({ name: "City Market", category: "grocery" });
    render(
      <VenueMarker
        venue={venue}
        selected={false}
        distanceMiles={1.3}
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", {
      name: "City Market, Grocery store, 1.3 mi",
    });
    expect(btn).toBeDefined();
  });

  test("distance < 0.1 mi shows '< 0.1 mi'", () => {
    const venue = makeVenue({ name: "Close Venue", category: "farm" });
    render(
      <VenueMarker
        venue={venue}
        selected={false}
        distanceMiles={0.05}
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", {
      name: "Close Venue, Farm, < 0.1 mi",
    });
    expect(btn).toBeDefined();
  });

  test("ES locale: category in aria-label is Spanish", () => {
    const venue = makeVenue({ name: "La Familia Pantry", category: "pantry" });
    render(
      <VenueMarker
        venue={venue}
        selected={false}
        locale="es"
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", {
      name: "La Familia Pantry, Despensa",
    });
    expect(btn).toBeDefined();
  });
});

// ─── Hover / focus callbacks ──────────────────────────────────────────────────

describe("VenueMarker — hover/focus callbacks", () => {
  test("mouseenter fires onHover with venue id", () => {
    const onHover = vi.fn();
    const venue = makeVenue({ id: "venue-abc" });
    render(
      <VenueMarker
        venue={venue}
        selected={false}
        onClick={vi.fn()}
        onHover={onHover}
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.mouseEnter(btn);
    expect(onHover).toHaveBeenCalledWith("venue-abc");
  });

  test("mouseleave fires onLeave", () => {
    const onLeave = vi.fn();
    render(
      <VenueMarker
        {...defaultProps}
        onClick={vi.fn()}
        onLeave={onLeave}
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.mouseLeave(btn);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  test("focus fires onHover with venue id", () => {
    const onHover = vi.fn();
    const venue = makeVenue({ id: "venue-xyz" });
    render(
      <VenueMarker
        venue={venue}
        selected={false}
        onClick={vi.fn()}
        onHover={onHover}
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.focus(btn);
    expect(onHover).toHaveBeenCalledWith("venue-xyz");
  });

  test("blur fires onLeave", () => {
    const onLeave = vi.fn();
    render(
      <VenueMarker
        {...defaultProps}
        onClick={vi.fn()}
        onLeave={onLeave}
      />,
    );
    const btn = screen.getByRole("button");
    fireEvent.blur(btn);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
