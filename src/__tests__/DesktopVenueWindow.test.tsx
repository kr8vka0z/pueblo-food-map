/**
 * DesktopVenueWindow tests — header chrome (#64) and the always-full card
 * (#732: the Show/Hide details toggle is gone; a computer always shows the
 * full details).
 *
 * #682: DesktopVenueWindow no longer takes a mapboxMap prop or computes its
 * own position (edge-flip removed — it now renders inside DesktopSidePanel,
 * which owns position/size) — no map stub needed to render it.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import DesktopSidePanel from "@/components/DesktopSidePanel";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import { track, EVENTS } from "@/lib/analytics";
import { waitForBoxCard } from "@/lib/testing/waitForBoxCard.testutil";

// #485 PR 2: mock the whole module so EVENTS keeps its real allowlist values.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

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
    onClose: () => void;
    locale: "en" | "es";
    venue: Venue;
  }> = {},
) {
  const props = {
    venue: makeVenue(),
    onClose: vi.fn(),
    locale: "en" as const,
    ...overrides,
  };
  return render(<DesktopVenueWindow {...props} />);
}

// ─── Always the full card (#732) ──────────────────────────────────────────────

describe("DesktopVenueWindow — full details on open, no toggle (#732)", () => {
  test("the summary and the full details render together, with no Show/Hide details control", () => {
    renderWindow({
      venue: makeVenue({
        phone: "(719) 555-0164",
        hours_weekly: { mon: ["09:00-17:00"] },
        notes: "Bring a photo ID.",
      }),
    });
    expect(screen.queryByRole("button", { name: /show details|hide details/i })).toBeNull();
    expect(screen.getByRole("button", { name: /walk/i })).toBeDefined();
    expect(screen.getByText("123 Test St, Pueblo, CO")).toBeDefined();
    expect(screen.getByRole("region", { name: "HOURS" })).toBeDefined();
    expect(screen.getByRole("link", { name: /555-0164/ })).toBeDefined();
    expect(screen.getByText("Bring a photo ID.")).toBeDefined();
  });
});

// ─── X-close ─────────────────────────────────────────────────────────────────

describe("DesktopVenueWindow — X-close interaction", () => {
  test("X-close calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWindow({ onClose });
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Enter activates X-close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWindow({ onClose });
    const closeBtn = screen.getByRole("button", { name: /close/i });
    closeBtn.focus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("ES: X-close has aria-label 'Cerrar'", () => {
    renderWindow({ locale: "es" });
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDefined();
  });
});

describe("DesktopVenueWindow — phone link looks tappable (option A, 2026-09-23)", () => {
  test("phone number is an underlined, green tel: link", () => {
    renderWindow({ venue: makeVenue({ phone: "(719) 555-0164" }) });
    const link = screen.getByRole("link", { name: /555-0164/ });
    expect(link.getAttribute("href")).toBe("tel:(719) 555-0164");
    expect(link.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["underline", "text-[var(--color-sage-700)]"]),
    );
  });
});

// ─── Venue title (focus target + dialog name) ────────────────────────────────

describe("DesktopVenueWindow — venue title in body", () => {
  test("venue title carries the id DesktopSidePanel focuses", () => {
    const venue = makeVenue({ name: "My Test Food Pantry" });
    renderWindow({ venue });
    const heading = screen.getByRole("heading", { name: "My Test Food Pantry" });
    expect(heading.id).toBe(`venue-window-title-${venue.id}`);
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
  test("no expand/collapse toggle for a box — the header renders a History link instead", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
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
  test("the dialog's accessible name resolves to the box's own name (aria-labelledby no longer dangles)", async () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    await waitForBoxCard();
    expect(screen.getByRole("dialog", { name: "Test Blessing Box" })).toBeDefined();
  });

  test("host note and status render unconditionally — no 'nothing shows up' gap (Kyle, 2026-09-18)", async () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    await waitForBoxCard();
    expect(screen.getByTestId("box-status-badge")).toBeDefined();
    expect(screen.getByText("Please knock if the gate is closed.")).toBeDefined();
  });

  test("ordinary-venue-only sections (address, hours table, phone, Plentiful link, report) never render for a box", async () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue({ phone: "(719) 555-0199", address: "999 Should Not Show St" })}
        box={makeBox()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    await waitForBoxCard();
    expect(screen.queryByText("999 Should Not Show St")).toBeNull();
    expect(screen.queryByText("(719) 555-0199")).toBeNull();
    expect(screen.queryByRole("link", { name: /report/i })).toBeNull();
  });

  test("shows a loading fallback when box data hasn't arrived yet", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={null}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.queryByTestId("box-status-badge")).toBeNull();
  });

  test("the header's History link navigates to /box/<id>/history for a box (VenuePopupHeader's own header)", () => {
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
    // order-1: visually leftmost, while X-close stays first in tab order.
    expect(link.className).toContain("order-1");
  });

  // #682 8b: Escape handling moved to DesktopSidePanel (coordinator: "Lift
  // ... overlay registration into DesktopSidePanel, since there are now
  // non-venue views") — this box's textarea guard is exercised through the
  // real shell now, not DesktopVenueWindow standalone.
  test("Escape does not close the panel while focus is inside the check-in note textarea", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const venue = makeBoxVenue();
    render(
      <DesktopSidePanel open onClose={onClose} headingId={`venue-window-title-${venue.id}`}>
        {(close) => (
          <DesktopVenueWindow
            venue={venue}
            box={makeBox()}
            onClose={close}
            locale="en"
          />
        )}
      </DesktopSidePanel>,
    );
    await waitForBoxCard();
    // "I filled it" expands an optional-note form with a textarea (BoxCheckinPanel).
    await user.click(screen.getByRole("button", { name: "I filled it" }));
    const textarea = await screen.findByRole("textbox");
    textarea.focus();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Analytics (#485 PR 2) ───────────────────────────────────────────────────

describe("DesktopVenueWindow — analytics", () => {
  test("clicking the phone number fires call_clicked", async () => {
    const user = userEvent.setup();
    const venue = makeVenue({ phone: "(719) 555-0164" });
    renderWindow({ venue });
    await user.click(screen.getByRole("link", { name: /555-0164/ }));
    expect(track).toHaveBeenCalledWith(EVENTS.CALL_CLICKED, { venueId: venue.id });
  });

  test("clicking the Plentiful website link fires website_clicked", async () => {
    const user = userEvent.setup();
    const venue = makeVenue({ source: "plentiful", url: "https://example.com/pantry" });
    renderWindow({ venue });
    await user.click(screen.getByRole("link", { name: /plentiful/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.WEBSITE_CLICKED, { venueId: venue.id });
  });
});
