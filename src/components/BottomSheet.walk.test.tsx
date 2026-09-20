/**
 * BottomSheet — box walk-prop wiring (walk-restore pass, 2026-09-19).
 * See BoxCardBody.tsx's own header for the full rationale. A new file (not
 * an edit to src/__tests__/BottomSheet.test.tsx) — that file's own box-card
 * tests, unmodified, are the proof the rest of the box branch (status
 * badge, hours/notes suppression, History link, Share isBox) is unaffected
 * by this wiring addition.
 *
 * Covers only the wiring BottomSheet itself owns: forwarding onWalkRoute/
 * isWalkRouteActive/onClearWalkRoute/walkRouteInfo/walkRouteSteps/
 * showWalkLocationHint into BoxCardBody, and binding onWalkRoute to the box
 * (not the plain Venue) as its callback target. BoxCardBody's own render
 * logic (button vs link, the readout) is covered by BoxCardBody.walk.test.tsx.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
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

// Same vaul mock BottomSheet.test.tsx uses — Drawer.Root/Portal/Content/Title
// all need a real DOM portal/animation context unavailable in jsdom.
vi.mock("vaul", () => {
  const DrawerRoot = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="vaul-root">{children}</div> : null;
  const DrawerPortal = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="vaul-portal">{children}</div>
  );
  const DrawerContent = ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="vaul-content" {...rest}>{children}</div>
  );
  const DrawerTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="vaul-title" className={className}>{children}</h2>
  );
  return { Drawer: { Root: DrawerRoot, Portal: DrawerPortal, Content: DrawerContent, Title: DrawerTitle } };
});

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

describe("BottomSheet — forwards walk props into BoxCardBody", () => {
  test("tapping the address calls onWalkRoute with the box (a PublicBlessingBox, itself a Venue)", async () => {
    const user = userEvent.setup();
    const onWalkRoute = vi.fn();
    const box = makeBox();
    render(
      <BottomSheet venue={makeBoxVenue()} box={box} onClose={() => {}} onWalkRoute={onWalkRoute} />,
    );
    await user.click(screen.getByText("123 Test St, Pueblo, CO"));
    expect(onWalkRoute).toHaveBeenCalledTimes(1);
    expect(onWalkRoute).toHaveBeenCalledWith(box);
  });

  test("no onWalkRoute prop -> address stays a plain link (unchanged pre-restore behavior)", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    const trigger = screen.getByText("123 Test St, Pueblo, CO");
    expect(trigger.tagName).toBe("A");
  });

  // #509 changed this test's expected behavior — quoting the issue's own
  // acceptance criterion for the update: "Starting a walking route shrinks
  // the card to a short strip at the bottom: place name, walking
  // distance/time, 'Clear route', and 'Show card'." A box's route starts
  // the SAME way as any other venue's (both call onWalkRoute), so mounting
  // with isWalkRouteActive already true must land on the strip, not the
  // full box card's own readout.
  test("isWalkRouteActive + walkRouteInfo render the route strip, not the full box card", () => {
    render(
      <BottomSheet
        venue={makeBoxVenue()}
        box={makeBox()}
        onClose={() => {}}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
      />,
    );
    expect(screen.getByTestId("route-strip")).toBeDefined();
    expect(screen.getByText("Test Blessing Box")).toBeDefined();
    expect(screen.getByTestId("route-strip-info").textContent).toMatch(/0\.4/);
    expect(screen.queryByTestId("walking-route-info")).toBeNull();
  });

  test("'Show card' restores the full box card with the active-route readout", async () => {
    const user = userEvent.setup();
    render(
      <BottomSheet
        venue={makeBoxVenue()}
        box={makeBox()}
        onClose={() => {}}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
      />,
    );
    await user.click(screen.getByTestId("route-strip-show-card"));
    expect(screen.queryByTestId("route-strip")).toBeNull();
    expect(screen.getByTestId("walking-route-info")).toBeDefined();
  });
});
