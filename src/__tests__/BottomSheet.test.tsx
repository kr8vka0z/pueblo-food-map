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

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import * as shareMod from "@/lib/share";

// BoxCardBody (rendered for a box venue) renders BoxCheckinPanel directly,
// which mounts a Turnstile widget — stub it the same way
// BoxCheckinPanel.test.tsx/BoxCardBody.test.tsx already do.
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

describe("BottomSheet — Plentiful link (#128)", () => {
  test("shows the Plentiful link (new tab) for Plentiful-sourced venues when expanded", async () => {
    const user = userEvent.setup();
    const venue = makeVenue({
      source: "directory.plentiful.org/colorado/pueblo",
      url: "https://directory.plentiful.org/colorado/pueblo/test-pantry",
    });
    render(<BottomSheet venue={venue} onClose={() => {}} />);
    // Collapsed: the link is part of the detail, so it should not be present yet.
    expect(screen.queryByRole("link", { name: /on Plentiful/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /show details/i }));
    const link = screen.getByRole("link", { name: /on Plentiful/i }) as HTMLAnchorElement;
    expect(link.href).toContain("directory.plentiful.org");
    expect(link.target).toBe("_blank");
  });

  test("no Plentiful link for non-Plentiful venues", async () => {
    const user = userEvent.setup();
    const venue = makeVenue({ source: "OpenStreetMap", url: "https://example.com/x" });
    render(<BottomSheet venue={venue} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /show details/i }));
    expect(screen.queryByRole("link", { name: /on Plentiful/i })).toBeNull();
  });
});

// ─── Blessing box (map-first rework, 2026-09-18) ───────────────────────────

function makeBoxVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return makeVenue({
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    phone: undefined,
    hours_weekly: undefined,
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

describe("BottomSheet — blessing box card (map-first rework)", () => {
  test("renders BoxCardBody content, not the ordinary venue detail toggle", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    // BoxCardBody's status badge is present — proves the box branch rendered.
    expect(screen.getByTestId("box-status-badge")).toBeDefined();
    // The ordinary venue's Show/Hide details toggle never renders for a box.
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
  });

  test("hours-today badge and notes paragraph are skipped for a box", () => {
    render(
      <BottomSheet
        venue={makeBoxVenue({ notes: "Some note text that would otherwise show" })}
        box={makeBox()}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Some note text that would otherwise show")).toBeNull();
    expect(screen.queryByText(/Open now|Closed|hours unknown/i)).toBeNull();
  });

  test("shows a loading fallback when box data hasn't arrived yet", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={null} onClose={() => {}} />);
    expect(screen.queryByTestId("box-status-badge")).toBeNull();
  });

  test("shows a prominent History link near the top, not after the check-in panel (Kyle, 2026-09-18: 'not buried at the bottom')", () => {
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: "History" });
    expect(link.getAttribute("href")).toBe("/box/test-box-1/history");
    // "I used this box" is BoxCheckinPanel's first button — the History
    // link must come before it in DOM order, not after the whole panel.
    const takeButton = screen.getByRole("button", { name: "I used this box" });
    expect(link.compareDocumentPosition(takeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("share button calls shareVenue with isBox: true for a box venue", async () => {
    // Same vi.spyOn(shareMod, "shareVenue") strategy ShareButton.test.tsx
    // uses for its clipboard-fallback case — avoids the userEvent-vs-
    // navigator.clipboard mock conflict documented in that file's own header.
    const shareSpy = vi.spyOn(shareMod, "shareVenue").mockResolvedValue("copied");
    const user = userEvent.setup();
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: /share/i }));
    expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ venueId: "test-box-1", isBox: true }));
    shareSpy.mockRestore();
  });
});
