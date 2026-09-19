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

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import { BOTTOM_NAV_HEIGHT_PX } from "@/components/BottomNav";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

// BoxCardBody (rendered for a box venue) renders BoxCheckinPanel directly,
// which mounts a Turnstile widget — same stub convention as
// BoxCheckinPanel.test.tsx/BoxCardBody.test.tsx.
const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockTurnstile.render.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

// ─── Bottom nav clearance (review item 7a) ────────────────────────────────────
// BOTTOM_NAV_HEIGHT_PX (76) covers the bottom of the map container at every
// breakpoint this component renders at (desktop, >=768px) — the bar itself
// below 2xl, the floating pill's 24px offset + 52px height at 2xl+ — so the
// position math must treat that band as already occupied, not part of the
// space a collapsed/expanded window can clip against.

describe("DesktopVenueWindow — bottom nav clearance", () => {
  test("a window whose default placement would land in the nav band is shifted clear of it", async () => {
    // Container is 800 tall; the marker sits 4px inside the nav's 76px band
    // (nav covers y in [724, 800]). The default "top-right of marker" anchor
    // (window bottom == marker y, collapsed height 220) would render the
    // window's bottom at 728 — 4px into the nav — if containerH weren't
    // corrected for the nav's footprint first.
    const markerY = 800 - BOTTOM_NAV_HEIGHT_PX + 4;
    const customMap = {
      project: vi.fn().mockReturnValue({ x: 0, y: markerY }),
      getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
      on: vi.fn().mockReturnThis(),
      off: vi.fn().mockReturnThis(),
    };
    const venue = makeVenue();
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={false}
        mapboxMap={customMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );

    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.style.top).not.toBe(""));

    const top = Number(dialog.style.top.replace("px", ""));
    const collapsedHeight = 220; // WINDOW_QUICK_H — jsdom renders offsetHeight 0, so the fallback constant applies
    expect(top + collapsedHeight).toBeLessThanOrEqual(800 - BOTTOM_NAV_HEIGHT_PX);
  });
});

// ─── Blessing box (map-first rework, 2026-09-18) ───────────────────────────

function makeBoxVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return makeVenue({
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    ...overrides,
  });
}

function makeBox(overrides: Partial<PublicBlessingBox["box"]> = {}): PublicBlessingBox {
  return {
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St, Pueblo, CO",
    source: "manual",
    last_verified: "2026-09-01T00:00:00.000Z",
    box: {
      hostName: null,
      hostNote: "Please knock if the gate is closed.",
      mostNeeded: null,
      installedOn: "2026-01-01",
      removedOn: null,
      status: "stocked",
      lastFilledAt: "2026-09-17T09:00:00.000Z",
      recentCheckins: [],
      latestPhoto: null,
      adopters: [],
      ...overrides,
    },
  };
}

describe("DesktopVenueWindow — blessing box card (card-polish follow-up, 2026-09-18)", () => {
  test("no expand/collapse toggle for a box — the header renders a History link instead, regardless of the (now-unused-for-boxes) expanded prop", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /hide details/i })).toBeNull();
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
  });

  // Fix pass (2026-09-19, item 1, BLOCKER): the outer dialog's
  // aria-labelledby pointed at an id that only ever existed on
  // venueNameBlock's own heading — a box branch never renders that block,
  // so the dialog's accessible name dangled (pointed at no element) for
  // every box until BoxCardBody's new `nameId` prop was wired through.
  test("the dialog's accessible name resolves to the box's own name (aria-labelledby no longer dangles)", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.getByRole("dialog", { name: "Test Blessing Box" })).toBeDefined();
  });

  test("host note and status render unconditionally — no 'nothing shows up' gap (Kyle, 2026-09-18)", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.getByTestId("box-status-badge")).toBeDefined();
    expect(screen.getByText("Please knock if the gate is closed.")).toBeDefined();
  });

  test("ordinary-venue-only sections (address, hours table, phone, Plentiful link, report) never render for a box", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue({ phone: "(719) 555-0199", address: "999 Should Not Show St" })}
        box={makeBox()}
        expanded={true}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.queryByText("999 Should Not Show St")).toBeNull();
    expect(screen.queryByText("(719) 555-0199")).toBeNull();
    expect(screen.queryByRole("link", { name: /report/i })).toBeNull();
  });

  test("shows a loading fallback when box data hasn't arrived yet", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={null}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.queryByTestId("box-status-badge")).toBeNull();
  });

  test("the header's History link navigates to /box/<id>/history for a box (replaces the Show/Hide toggle, same position/classes — VenuePopupHeader's own header)", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
    // Same order-1 (visually leftmost) slot the ordinary-venue toggle uses.
    expect(link.className).toContain("order-1");
  });

  test("Escape does not close the window while focus is inside the check-in note textarea", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={true}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={onClose}
        locale="en"
      />,
    );
    // "I filled it" expands an optional-note form with a textarea (BoxCheckinPanel).
    await user.click(screen.getByRole("button", { name: "I filled it" }));
    const textarea = await screen.findByRole("textbox");
    textarea.focus();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("an in-progress check-in note survives toggling expanded (fix, PR review 2026-09-18 — collapsed/expanded used to be two separate BoxCardBody subtrees that remounted on toggle)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    await user.click(screen.getByRole("button", { name: "I filled it" }));
    const textarea = await screen.findByRole("textbox");
    await user.type(textarea, "Left extra cans");

    rerender(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={true}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Left extra cans");
  });
});
