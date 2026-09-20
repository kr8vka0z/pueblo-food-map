/**
 * BottomSheet — route strip mechanics (#509).
 *
 * Covers the vaul contract BottomSheet.tsx wires when a walking route is
 * active (dismissible/snapPoints/activeSnapPoint/setActiveSnapPoint), the
 * strip <-> full card content swap, "Show card", a simulated drag-down (the
 * captured `setActiveSnapPoint` callback standing in for vaul's own release
 * handler — vaul's drag/pointer gesture internals don't run in jsdom, same
 * reasoning as every other mocked-vaul BottomSheet test in this repo), and
 * that × and Escape behave per the issue ("× ... still closes everything
 * (unchanged)"; Escape collapses to the strip instead of doing nothing,
 * since dismissible=false blocks vaul's own Escape-driven close).
 *
 * Ordinary-venue Walk button behavior itself (DirectionButtons) is unchanged
 * and already covered by DirectionButtons.test.tsx (69 tests) — not
 * duplicated here.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";

// ─── Mock vaul, capturing the props BottomSheet passes to Drawer.Root ────────
// so tests can assert on the contract and simulate vaul calling back into
// `setActiveSnapPoint` (what a real drag-release would trigger).
const rootPropsHolder: {
  dismissible?: boolean;
  snapPoints?: (number | string)[];
  activeSnapPoint?: number | string | null;
  setActiveSnapPoint?: (snap: number | string | null) => void;
} = {};

// Captured directly (not wired through a synthetic DOM keydown) — this test
// exercises BottomSheet's onEscapeKeyDown handler as a plain function, same
// reasoning as every other prop capture in this mock: vaul's real Escape
// wiring goes through Radix internals unavailable in jsdom (see
// BottomSheet.escapeGuard.test.tsx, which uses REAL vaul for that specific
// trace instead).
const contentPropsHolder: {
  onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
} = {};

vi.mock("vaul", () => {
  const DrawerRoot = ({
    children,
    open,
    dismissible,
    snapPoints,
    activeSnapPoint,
    setActiveSnapPoint,
  }: {
    children: React.ReactNode;
    open: boolean;
    dismissible?: boolean;
    snapPoints?: (number | string)[];
    activeSnapPoint?: number | string | null;
    setActiveSnapPoint?: (snap: number | string | null) => void;
  }) => {
    rootPropsHolder.dismissible = dismissible;
    rootPropsHolder.snapPoints = snapPoints;
    rootPropsHolder.activeSnapPoint = activeSnapPoint;
    rootPropsHolder.setActiveSnapPoint = setActiveSnapPoint;
    return open ? <div data-testid="vaul-root">{children}</div> : null;
  };
  const DrawerPortal = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="vaul-portal">{children}</div>
  );
  const DrawerContent = ({
    children,
    onEscapeKeyDown,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    onEscapeKeyDown?: (event: { preventDefault: () => void }) => void;
  }) => {
    contentPropsHolder.onEscapeKeyDown = onEscapeKeyDown;
    return <div data-testid="vaul-content" {...rest}>{children}</div>;
  };
  const DrawerTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="vaul-title" className={className}>{children}</h2>
  );
  return { Drawer: { Root: DrawerRoot, Portal: DrawerPortal, Content: DrawerContent, Title: DrawerTitle } };
});

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-venue-509",
    name: "Pueblo Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

describe("BottomSheet — no route active (baseline, unchanged)", () => {
  test("dismissible=true, no snapPoints", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    expect(rootPropsHolder.dismissible).toBe(true);
    expect(rootPropsHolder.snapPoints).toBeUndefined();
    expect(screen.queryByTestId("route-strip")).toBeNull();
  });
});

describe("BottomSheet — route active, mounts straight to the strip", () => {
  test("dismissible=false, snapPoints=[strip,full], activeSnapPoint=strip", () => {
    render(
      <BottomSheet
        venue={makeVenue()}
        onClose={() => {}}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        onClearWalkRoute={vi.fn()}
      />,
    );
    expect(rootPropsHolder.dismissible).toBe(false);
    expect(rootPropsHolder.snapPoints).toEqual(["112px", 1]);
    expect(rootPropsHolder.activeSnapPoint).toBe("112px");
    expect(screen.getByTestId("route-strip")).toBeDefined();
    expect(screen.getByText("Pueblo Test Pantry")).toBeDefined();
    expect(screen.queryByTestId("walking-route-info")).toBeNull();
  });

  test("'Show card' reveals the full card and its active-route readout", async () => {
    const user = userEvent.setup();
    render(
      <BottomSheet
        venue={makeVenue()}
        onClose={() => {}}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        onClearWalkRoute={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("route-strip-show-card"));
    expect(rootPropsHolder.activeSnapPoint).toBe(1);
    expect(screen.queryByTestId("route-strip")).toBeNull();
    expect(screen.getByTestId("walking-route-info")).toBeDefined();
  });

  test("simulated drag-down (vaul calling setActiveSnapPoint back to the strip) collapses to the strip, not close", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomSheet
        venue={makeVenue()}
        onClose={onClose}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        onClearWalkRoute={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("route-strip-show-card"));
    expect(screen.getByTestId("walking-route-info")).toBeDefined();

    // Stand-in for vaul's own drag-release handler calling back into the
    // controlled setActiveSnapPoint with the lowest snap point.
    act(() => {
      rootPropsHolder.setActiveSnapPoint!("112px");
    });

    expect(screen.getByTestId("route-strip")).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Clear route on the strip calls onClearWalkRoute", async () => {
    const user = userEvent.setup();
    const onClearWalkRoute = vi.fn();
    render(
      <BottomSheet
        venue={makeVenue()}
        onClose={() => {}}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        onClearWalkRoute={onClearWalkRoute}
      />,
    );
    await user.click(screen.getByTestId("route-strip-clear"));
    expect(onClearWalkRoute).toHaveBeenCalledTimes(1);
  });

  test("× on the revealed full card still calls onClose (unchanged)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BottomSheet
        venue={makeVenue()}
        onClose={onClose}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        onClearWalkRoute={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("route-strip-show-card"));
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // dismissible=false means vaul's own onOpenChange short-circuits an
  // Escape-driven close before BottomSheet's handleOpenChange ever sees it
  // (see BottomSheet.tsx's own header) — collapsing to the strip instead of
  // silently doing nothing is the fix under test.
  test("Escape while the full card is revealed collapses to the strip instead of closing", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BottomSheet
        venue={makeVenue()}
        onClose={onClose}
        onWalkRoute={vi.fn()}
        isWalkRouteActive
        walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        onClearWalkRoute={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("route-strip-show-card"));
    expect(screen.getByTestId("walking-route-info")).toBeDefined();

    const preventDefault = vi.fn();
    act(() => {
      contentPropsHolder.onEscapeKeyDown!({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("route-strip")).toBeDefined();
  });
});
