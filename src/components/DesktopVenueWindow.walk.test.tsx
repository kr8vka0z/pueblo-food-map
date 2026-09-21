/**
 * DesktopVenueWindow — box walk-prop wiring (walk-restore pass, 2026-09-19).
 * See BoxCardBody.tsx's own header for the full rationale. A new file (not
 * an edit to src/__tests__/DesktopVenueWindow.test.tsx) — that file's own
 * box-card tests, unmodified, are the proof the rest of the box branch
 * (header History link, no expand/collapse toggle, Share/Favorite actions)
 * is unaffected by this wiring addition.
 *
 * Covers only the wiring DesktopVenueWindow itself owns: forwarding
 * onWalkRoute/isWalkRouteActive/onClearWalkRoute/walkRouteInfo/
 * walkRouteSteps/showWalkLocationHint into BoxCardBody, and binding
 * onWalkRoute to the box (not the plain Venue) as its callback target.
 * BoxCardBody's own render logic (button vs link, the readout) is covered
 * by BoxCardBody.walk.test.tsx.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

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

const mockMapboxMap = {
  project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
};

function makeBoxVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St, Pueblo, CO",
    source: "manual",
    last_verified: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
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
      hostNote: null,
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

describe("DesktopVenueWindow — forwards walk props into BoxCardBody", () => {
  test("tapping the address calls onWalkRoute with the box (a PublicBlessingBox, itself a Venue)", async () => {
    const user = userEvent.setup();
    const onWalkRoute = vi.fn();
    const box = makeBox();
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={box}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
        locale="en"
        onWalkRoute={onWalkRoute}
      />,
    );
    await user.click(screen.getByText("123 Test St, Pueblo, CO"));
    expect(onWalkRoute).toHaveBeenCalledTimes(1);
    expect(onWalkRoute).toHaveBeenCalledWith(box);
  });

  test("no onWalkRoute prop -> address stays a plain link (unchanged pre-restore behavior)", () => {
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
    const trigger = screen.getByText("123 Test St, Pueblo, CO");
    expect(trigger.tagName).toBe("A");
  });

  test("isWalkRouteActive + walkRouteInfo render the active-route readout inside the box card", () => {
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
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
      />,
    );
    expect(screen.getByTestId("walking-route-info")).toBeDefined();
  });
});
