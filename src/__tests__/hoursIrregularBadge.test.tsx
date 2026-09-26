/**
 * Irregular-schedule display tests (#400) — mirrors hoursUnknownBadge.test.tsx's
 * own structure/mocks, covering the three surfaces that read
 * computeVenueOpenStatus(): VenueCard (list rows), BottomSheet (mobile),
 * DesktopVenueWindow (desktop).
 *
 * Proves the #400 acceptance criteria this repo's own tests are the gate
 * for: an irregular-only venue is NEVER "hours unknown," a "Next: ..."
 * next-occurrence line renders, and a venue with BOTH weekly and monthly
 * schedules (the real Lynn Gardens Baptist Church shape — see
 * src/data/pantries-plentiful.ts for its real id/name/address; its
 * committed seed data has no digitized hours yet, so the schedule values
 * below are illustrative, built from the notes text
 * src/data/published-venues.ts already carries for it: "2nd Thursday, 4th
 * Thursday of each month, 11:00 AM – 12:45 PM") shows both together.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueCard from "@/components/VenueCard";
import BottomSheet from "@/components/BottomSheet";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { IrregularSchedule, Venue } from "@/types/venue";

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
  const Description = ({ children, ...rest }: { children: React.ReactNode; [k: string]: unknown }) => (
    <p {...rest}>{children}</p>
  );
  return { Drawer: { Root, Portal, Content, Title, Description } };
});

const mockMapboxMap = {
  project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
};

const fourthTuesday: IrregularSchedule = {
  recurrence: "monthly_ordinal",
  ordinal: 4,
  weekday: "tue",
  slots: ["11:00-12:00"],
};

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "plentiful-lynn-gardens-baptist-church-d9ee705e",
    name: "Lynn Gardens Baptist Church",
    category: "pantry",
    lat: 38.223992,
    lng: -104.656767,
    address: "3804 W. Pueblo Blvd., Pueblo, CO 81005",
    source: "test",
    last_verified: "2026-05-14",
    hours_irregular: [fourthTuesday],
    // hours_weekly deliberately absent by default — irregular-only case
    ...overrides,
  };
}

describe("VenueCard — irregular schedule", () => {
  test("an irregular-only venue never shows 'Hours unknown' (#400 acceptance)", () => {
    render(
      <ul>
        <VenueCard venue={makeVenue()} isSelected={false} onClick={vi.fn()} />
      </ul>,
    );
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
  });

  test("shows a 'Next: ...' next-occurrence line", () => {
    render(
      <ul>
        <VenueCard venue={makeVenue()} isSelected={false} onClick={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText(/Next:/i)).toBeDefined();
  });

  test("weekly + monthly together (Lynn Gardens shape) renders both a status badge and the Next line", () => {
    const venue = makeVenue({ hours_weekly: { thu: ["09:00-13:00"] } });
    render(
      <ul>
        <VenueCard venue={venue} isSelected={false} onClick={vi.fn()} />
      </ul>,
    );
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
    expect(screen.getByText(/Next:/i)).toBeDefined();
  });
});

describe("BottomSheet — irregular schedule", () => {
  test("an irregular-only venue never shows the 'Hours unknown' label", () => {
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} />);
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
  });

  test("shows a 'Next: ...' next-occurrence line", () => {
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} />);
    expect(screen.getByText(/Next:/i)).toBeDefined();
  });
});

describe("DesktopVenueWindow — irregular schedule", () => {
  test("an irregular-only venue never shows the 'Hours unknown' label", () => {
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
    expect(screen.queryByText(/Hours unknown/i)).toBeNull();
  });

  test("shows a 'Next: ...' next-occurrence line", () => {
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
    expect(screen.getByText(/Next:/i)).toBeDefined();
  });

  test("weekly + monthly render together in the expanded hours section", () => {
    const venue = makeVenue({ hours_weekly: { thu: ["09:00-13:00"] } });
    render(
      <DesktopVenueWindow
        venue={venue}
        expanded={true}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // Weekly table row for Thursday + the monthly section's prose description.
    expect(screen.getByText("Thu")).toBeDefined();
    expect(screen.getByText(/4th Tue of each month/)).toBeDefined();
  });
});
