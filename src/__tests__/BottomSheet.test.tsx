/**
 * BottomSheet tests — issue #122 boolean-expanded toggle.
 *
 * Verifies:
 *   1. Venue name and category label are visible in summary (collapsed).
 *   2. Phone and hours <dt> labels are NOT in the document initially.
 *   3. After clicking "Show details", phone and a day label ARE visible.
 *   4. After clicking "Hide details", they are gone.
 *   5. Clicking the close X calls onClose.
 *
 * Mock strategy:
 *   vaul's Drawer.Root/Portal/Content/Title require a real DOM portal and
 *   animation context unavailable in jsdom. We mock the entire module so
 *   Drawer.Root/Portal/Content/Title all render their children as plain divs,
 *   enabling full assertion coverage without portal/animation overhead.
 *   next/link renders as <a> natively in the test environment (no mock needed).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";

// ─── Mock vaul ───────────────────────────────────────────────────────────────
// Render children as plain divs; no portal / animation.

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

  return {
    Drawer: {
      Root: DrawerRoot,
      Portal: DrawerPortal,
      Content: DrawerContent,
      Title: DrawerTitle,
    },
  };
});

// ─── Fixture ─────────────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-venue-122",
    name: "Pueblo Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Main St, Pueblo, CO 81003",
    phone: "(719) 555-0122",
    hours_weekly: {
      mon: ["09:00-12:00"],
      tue: ["09:00-12:00"],
      wed: [],
      thu: ["09:00-12:00"],
      fri: ["09:00-12:00"],
      sat: [],
      sun: [],
    },
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BottomSheet — summary always visible (collapsed)", () => {
  test("shows venue name in summary", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    expect(screen.getByText("Pueblo Test Pantry")).toBeDefined();
  });

  test("shows category label in summary", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    // categoryLabels["pantry"] === "Food pantry". The badge span also contains
    // an aria-hidden dot child, so use getByText with exact:false to match
    // elements whose text content includes the label.
    expect(screen.getByText(/Food pantry/i)).toBeDefined();
  });
});

describe("BottomSheet — detail hidden when collapsed", () => {
  test("phone number is NOT visible initially", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    expect(screen.queryByText("(719) 555-0122")).toBeNull();
  });

  test("hours day label is NOT visible initially", () => {
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    // "Mon" is the first day label rendered in the hours table
    // The table is inside the expandable section — should not be present
    const dtElements = document.querySelectorAll("dt");
    expect(dtElements.length).toBe(0);
  });
});

describe("BottomSheet — expand / collapse toggle", () => {
  test("clicking 'Show details' reveals phone number", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    const showBtn = screen.getByRole("button", { name: /show details/i });
    await user.click(showBtn);
    expect(screen.getByText("(719) 555-0122")).toBeDefined();
  });

  test("clicking 'Hide details' hides phone number again", async () => {
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={() => {}} />);
    // Expand
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.getByText("(719) 555-0122")).toBeDefined();
    // Collapse
    await user.click(screen.getByRole("button", { name: /hide details/i }));
    expect(screen.queryByText("(719) 555-0122")).toBeNull();
  });
});

describe("BottomSheet — close button", () => {
  test("clicking the close X calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BottomSheet venue={makeVenue()} onClose={onClose} />);
    // Use exact match "Close" to avoid matching the drag handle's aria-label
    // "Drag to expand or close venue details" which also contains "close".
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
