/**
 * "Hours unknown" badge tests — board review finding #1.
 *
 * Proves the label required by the fix actually renders on every surface
 * that shows open/closed state for a venue with no hours_weekly data:
 * VenueCard (list rows), BottomSheet (mobile), DesktopVenueWindow (desktop).
 * grep for computeOpenStatus consumers confirms these three plus
 * useMapFilters.ts (covered separately in useMapFilters.test.ts) are the
 * only ones — VenueMarker.tsx / Map.tsx render no open/closed text at all.
 *
 * Mock strategy for BottomSheet/DesktopVenueWindow matches
 * osm-guard.test.tsx (vaul portal mock + minimal mapboxgl.Map stub).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueCard from "@/components/VenueCard";
import BottomSheet from "@/components/BottomSheet";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { Venue } from "@/types/venue";

vi.mock("vaul", async () => {
  const React = await import("react");
  const Content = ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [k: string]: unknown;
  }) => <div data-testid="drawer-content" {...rest}>{children}</div>;
  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Root = ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <>{children}</> : null;
  const Title = ({ children, ...rest }: { children: React.ReactNode; [k: string]: unknown }) => (
    <h2 {...rest}>{children}</h2>
  );
  return { Drawer: { Root, Portal, Content, Title } };
});

const mockMapboxMap = {
  project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
};

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "no-hours-venue",
    name: "Mystery Hours Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "1 Main St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-05-14",
    // hours_weekly deliberately absent — the "unknown hours" case
    ...overrides,
  };
}

describe("VenueCard — hours-unknown badge", () => {
  test("shows 'Hours unknown — call ahead' when hours_weekly is absent", () => {
    render(
      <ul>
        <VenueCard venue={makeVenue()} isSelected={false} onClick={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText(/Hours unknown — call ahead/i)).toBeDefined();
  });

  test("does NOT show the badge for a venue with known hours", () => {
    const venue = makeVenue({ hours_weekly: { mon: ["09:00-17:00"] } });
    render(
      <ul>
        <VenueCard venue={venue} isSelected={false} onClick={vi.fn()} />
      </ul>,
    );
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
  });
});

describe("BottomSheet — hours-unknown label", () => {
  test("shows 'Hours unknown — call ahead' when hours_weekly is absent", () => {
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} />);
    expect(screen.getByText(/Hours unknown — call ahead/i)).toBeDefined();
  });

  test("does NOT show the label for a venue with known hours", () => {
    const venue = makeVenue({ hours_weekly: { mon: ["09:00-17:00"] } });
    render(<BottomSheet venue={venue} onClose={vi.fn()} />);
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
  });
});

describe("DesktopVenueWindow — hours-unknown label", () => {
  test("shows 'Hours unknown — call ahead' in collapsed state", () => {
    render(
      <DesktopVenueWindow
        venue={makeVenue()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Hours unknown — call ahead/i)).toBeDefined();
  });

  test("does NOT show the label for a venue with known hours", () => {
    const venue = makeVenue({ hours_weekly: { mon: ["09:00-17:00"] } });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
  });
});
