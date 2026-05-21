/**
 * DesktopVenueWindow tests — issue #64 persistent header chrome.
 *
 * Verifies:
 *   1. Header bar visible in collapsed state (shows "Show details" button + X-close).
 *   2. Header bar visible in expanded state (shows "Hide details" button + X-close).
 *   3. X-close button calls onClose in collapsed state.
 *   4. X-close button calls onClose in expanded state.
 *   5. "Show details" toggle calls onExpand in collapsed state.
 *   6. "Hide details" toggle calls onCollapse in expanded state.
 *   7. Venue title is rendered in the body in both states (same id, no jump).
 *   8. No "See full details →" link anywhere (removed from collapsed body).
 *   9. No standalone chevron-only collapse button (removed from expanded header).
 *  10. Keyboard: Enter activates the Show/Hide toggle.
 *  11. Keyboard: Enter activates the X-close button.
 *  12. ES locale: "Show details" → "Ver detalles", "Hide details" → "Ocultar detalles".
 *  13. aria-expanded on toggle button reflects expanded state.
 *
 * Mock strategy:
 *   DesktopVenueWindow requires a mapboxMap instance to compute position.
 *   We pass a minimal stub (project → {x:0,y:0}; getContainer → offsetWidth/Height 1000;
 *   on/off are no-ops) so position is deterministic and the component renders without errors.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { Venue } from "@/types/venue";

// ─── Minimal mapboxgl.Map stub ────────────────────────────────────────────────

const mockMapboxMap = {
  project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
};

// ─── Shared fixture ───────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-venue-64",
    name: "Test Venue 64",
    category: "pantry",
    lat: 38.254,
    lng: -104.62,
    address: "123 Test St, Pueblo, CO",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

function renderWindow(
  overrides: Partial<{
    expanded: boolean;
    onExpand: () => void;
    onCollapse: () => void;
    onClose: () => void;
    locale: "en" | "es";
    venue: Venue;
  }> = {},
) {
  const props = {
    venue: makeVenue(),
    expanded: false,
    mapboxMap: mockMapboxMap,
    onExpand: vi.fn(),
    onCollapse: vi.fn(),
    onClose: vi.fn(),
    locale: "en" as const,
    ...overrides,
  };
  return render(<DesktopVenueWindow {...props} />);
}

// ─── Header visibility ────────────────────────────────────────────────────────

describe("DesktopVenueWindow — persistent header (collapsed)", () => {
  test("renders X-close button in collapsed state", () => {
    renderWindow({ expanded: false });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn).toBeDefined();
  });

  test("renders 'Show details' toggle in collapsed state", () => {
    renderWindow({ expanded: false });
    const toggle = screen.getByRole("button", { name: /show details/i });
    expect(toggle).toBeDefined();
  });

  test("does NOT render 'Hide details' in collapsed state", () => {
    renderWindow({ expanded: false });
    expect(screen.queryByRole("button", { name: /hide details/i })).toBeNull();
  });
});

describe("DesktopVenueWindow — persistent header (expanded)", () => {
  test("renders X-close button in expanded state", () => {
    renderWindow({ expanded: true });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    expect(closeBtn).toBeDefined();
  });

  test("renders 'Hide details' toggle in expanded state", () => {
    renderWindow({ expanded: true });
    const toggle = screen.getByRole("button", { name: /hide details/i });
    expect(toggle).toBeDefined();
  });

  test("does NOT render 'Show details' in expanded state", () => {
    renderWindow({ expanded: true });
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
  });
});

// ─── Button interactions ──────────────────────────────────────────────────────

describe("DesktopVenueWindow — X-close interaction", () => {
  test("X-close calls onClose in collapsed state", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: false, onClose });
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("X-close calls onClose in expanded state", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: true, onClose });
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DesktopVenueWindow — toggle interaction", () => {
  test("'Show details' calls onExpand in collapsed state", async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: false, onExpand });
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  test("'Hide details' calls onCollapse in expanded state", async () => {
    const onCollapse = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: true, onCollapse });
    await user.click(screen.getByRole("button", { name: /hide details/i }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
});

// ─── Venue title in body (no position jump) ───────────────────────────────────

describe("DesktopVenueWindow — venue title in body", () => {
  test("venue title appears in body (with id) in collapsed state", () => {
    const venue = makeVenue({ name: "My Test Food Pantry" });
    renderWindow({ expanded: false, venue });
    const heading = screen.getByRole("heading", { name: "My Test Food Pantry" });
    expect(heading.id).toBe(`venue-window-title-${venue.id}`);
  });

  test("venue title appears in body (with id) in expanded state", () => {
    const venue = makeVenue({ name: "My Test Food Pantry" });
    renderWindow({ expanded: true, venue });
    const heading = screen.getByRole("heading", { name: "My Test Food Pantry" });
    expect(heading.id).toBe(`venue-window-title-${venue.id}`);
  });
});

// ─── Old chrome removed ───────────────────────────────────────────────────────

describe("DesktopVenueWindow — old chrome removed", () => {
  test("no 'See full details' link in collapsed state", () => {
    renderWindow({ expanded: false });
    expect(screen.queryByText(/see full details/i)).toBeNull();
  });

  test("no chevron-only button with aria-label 'Collapse to quick summary' in expanded state", () => {
    renderWindow({ expanded: true });
    expect(screen.queryByRole("button", { name: /collapse to quick summary/i })).toBeNull();
  });
});

// ─── Keyboard accessibility ───────────────────────────────────────────────────

describe("DesktopVenueWindow — keyboard activation", () => {
  test("Enter activates 'Show details' toggle", async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: false, onExpand });
    const toggle = screen.getByRole("button", { name: /show details/i });
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  test("Space activates 'Show details' toggle", async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: false, onExpand });
    const toggle = screen.getByRole("button", { name: /show details/i });
    toggle.focus();
    await user.keyboard(" ");
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  test("Enter activates X-close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWindow({ expanded: false, onClose });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    closeBtn.focus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── aria-expanded on toggle ──────────────────────────────────────────────────

describe("DesktopVenueWindow — aria-expanded on toggle", () => {
  test("toggle has aria-expanded=false in collapsed state", () => {
    renderWindow({ expanded: false });
    const toggle = screen.getByRole("button", { name: /show details/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("toggle has aria-expanded=true in expanded state", () => {
    renderWindow({ expanded: true });
    const toggle = screen.getByRole("button", { name: /hide details/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});

// ─── aria-controls on toggle ─────────────────────────────────────────────────

describe("DesktopVenueWindow — toggle aria-controls", () => {
  test("toggle aria-controls targets the body region id (collapsed)", () => {
    const venue = makeVenue();
    renderWindow({ expanded: false, venue });
    const toggle = screen.getByRole("button", { name: /show details/i });
    expect(toggle.getAttribute("aria-controls")).toBe(
      `venue-popup-body-${venue.id}`,
    );
    expect(
      document.getElementById(`venue-popup-body-${venue.id}`),
    ).not.toBeNull();
  });

  test("toggle aria-controls targets the body region id (expanded)", () => {
    const venue = makeVenue();
    renderWindow({ expanded: true, venue });
    const toggle = screen.getByRole("button", { name: /hide details/i });
    expect(toggle.getAttribute("aria-controls")).toBe(
      `venue-popup-body-${venue.id}`,
    );
    expect(
      document.getElementById(`venue-popup-body-${venue.id}`),
    ).not.toBeNull();
  });
});

// ─── Tab order: X-close before toggle ────────────────────────────────────────

describe("DesktopVenueWindow — tab order", () => {
  test("X-close appears before toggle in DOM order (tab order)", () => {
    renderWindow({ expanded: false });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    const toggle = screen.getByRole("button", { name: /show details/i });
    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING = 4
    expect(closeBtn.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ─── i18n — ES locale ────────────────────────────────────────────────────────

describe("DesktopVenueWindow — ES locale strings", () => {
  test("ES: toggle reads 'Ver detalles' in collapsed state", () => {
    renderWindow({ expanded: false, locale: "es" });
    expect(screen.getByRole("button", { name: "Ver detalles" })).toBeDefined();
  });

  test("ES: toggle reads 'Ocultar detalles' in expanded state", () => {
    renderWindow({ expanded: true, locale: "es" });
    expect(screen.getByRole("button", { name: "Ocultar detalles" })).toBeDefined();
  });

  test("ES: X-close has aria-label 'Cerrar'", () => {
    renderWindow({ expanded: false, locale: "es" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDefined();
  });
});
