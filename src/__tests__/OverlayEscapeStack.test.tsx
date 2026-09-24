/**
 * OverlayEscapeStack — #527 integration proof: with two overlays open at
 * once, Escape closes only the TOPMOST one, and the shared body-scroll lock
 * stays locked as long as ANY overlay wants it. Each overlay component is
 * rendered directly (no mounted MapWrapper), same approach
 * OverlayHidesBottomNav.test.tsx uses for #542 — the registry/stack is a
 * module-level singleton, so this proves the same wiring MapWrapper/PageNav
 * rely on.
 *
 * Covers the issue's required shapes:
 *   1. Two overlays open -> one Escape closes only the top one.
 *   2. Closing one keeps scroll locked while the other is open.
 *   3. DesktopVenueWindow (a plain document Escape listener, like Filters/
 *      Menu) participates in the same stack.
 *   4. BottomSheet (Escape routed through vaul/Radix's onEscapeKeyDown prop,
 *      not a document listener) participates too — mocked the same way
 *      BottomSheet.test.tsx mocks vaul.
 */
import { useRef, useState } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import FilterPanel from "@/components/FilterPanel";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { Venue } from "@/types/venue";

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

// Shared no-op prop shape every FilterPanel harness below needs.
const FILTER_PANEL_STATIC_PROPS = {
  locale: "en" as const,
  resultCount: 3,
  filterOpenNow: false,
  onToggleOpenNow: () => {},
  filterSnap: false,
  onToggleSnap: () => {},
  filterWic: false,
  onToggleWic: () => {},
  selectedCategories: null,
  onToggleCategory: () => {},
  onClearAll: () => {},
};

describe("#527 — Escape closes only the topmost overlay; scroll lock is shared", () => {
  beforeEach(() => {
    // Mobile layout — HamburgerMenu's full-sheet variant, matches
    // OverlayHidesBottomNav.test.tsx's convention for exercising the actual
    // bug shape (two full-surface overlays stacked).
    stubMatchMedia(true);
  });

  test("Menu opened, then Filters opened on top: Escape closes Filters only, Menu stays open", async () => {
    function TwoOverlaysHarness() {
      const [menuOpen, setMenuOpen] = useState(false);
      const [filterOpen, setFilterOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={openerRef} type="button" onClick={() => setMenuOpen((o) => !o)}>
            Toggle menu
          </button>
          <button type="button" onClick={() => setFilterOpen((o) => !o)}>
            Toggle filters
          </button>
          <HamburgerMenu
            locale="en"
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            ignoreOutsideRef={openerRef}
          />
          <FilterPanel {...FILTER_PANEL_STATIC_PROPS} open={filterOpen} onClose={() => setFilterOpen(false)} />
        </>
      );
    }

    render(<TwoOverlaysHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    // HamburgerMenu's isMobile sync lags one setTimeout(0) — wait for the panel.
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "Toggle filters" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeDefined());

    // One Escape — only Filters (opened second, topmost) should close.
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("menu")).toBeDefined();

    // A second Escape now closes the Menu (now topmost/only one left).
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  test("two overlays open, closing the topmost leaves scroll locked; closing both clears it", async () => {
    function TwoOverlaysHarness() {
      const [menuOpen, setMenuOpen] = useState(false);
      const [filterOpen, setFilterOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={openerRef} type="button" onClick={() => setMenuOpen((o) => !o)}>
            Toggle menu
          </button>
          <button type="button" onClick={() => setFilterOpen((o) => !o)}>
            Toggle filters
          </button>
          <HamburgerMenu
            locale="en"
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            ignoreOutsideRef={openerRef}
          />
          <FilterPanel {...FILTER_PANEL_STATIC_PROPS} open={filterOpen} onClose={() => setFilterOpen(false)} />
        </>
      );
    }

    render(<TwoOverlaysHarness />);
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Toggle filters" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeDefined());
    expect(document.body.style.overflow).toBe("hidden");

    // Close Filters only (its own × button) — Menu is still open, so the
    // shared lock must stay held, not just Filters' own copy of it.
    fireEvent.click(screen.getByRole("button", { name: /close filters/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.body.style.overflow).toBe("hidden");

    // Close the Menu too — nothing left locking it.
    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.body.style.overflow).toBe("");
  });

  test("DesktopVenueWindow open, Filters opened on top: Escape closes Filters only, window stays open", async () => {
    const mockMapboxMap = {
      project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
      getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
      on: vi.fn().mockReturnThis(),
      off: vi.fn().mockReturnThis(),
    };
    const venue: Venue & { distanceMiles?: number } = {
      id: "test-venue-527",
      name: "Test Venue 527",
      category: "pantry",
      lat: 38.254,
      lng: -104.62,
      address: "123 Test St, Pueblo, CO",
      source: "test",
      last_verified: "2026-01-01",
    };
    const onClose = vi.fn();

    function Harness() {
      const [filterOpen, setFilterOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setFilterOpen((o) => !o)}>
            Toggle filters
          </button>
          <DesktopVenueWindow
            venue={venue}
            expanded={false}
            mapboxMap={mockMapboxMap}
            onExpand={() => {}}
            onCollapse={() => {}}
            onClose={onClose}
            locale="en"
          />
          <FilterPanel {...FILTER_PANEL_STATIC_PROPS} open={filterOpen} onClose={() => setFilterOpen(false)} />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle filters" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: /filters/i })).toBeDefined());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /filters/i })).toBeNull());
    expect(onClose).not.toHaveBeenCalled();

    // Filters is gone — the window is topmost again, Escape now closes it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── BottomSheet (Escape routed through vaul's onEscapeKeyDown prop) ──────────
//
// React drops an `onEscapeKeyDown` prop spread onto a plain <div> (it looks
// like a DOM event-handler prop, "EscapeKeyDown" isn't a real DOM event, so
// React warns and discards it rather than setting it as a node property) —
// spreading `...rest` the way BottomSheet.test.tsx's own vaul mock does
// isn't enough to recover the callback here. `vi.hoisted` shares a plain
// mutable box between this factory and the test bodies below, working
// around vi.mock's own hoisting so DrawerContent can stash the callback
// vaul would have called, for the tests to invoke directly.
const { getEscapeHandler, setEscapeHandler } = vi.hoisted(() => {
  let handler: ((e: { preventDefault: () => void }) => void) | undefined;
  return {
    setEscapeHandler: (h: typeof handler) => {
      handler = h;
    },
    getEscapeHandler: () => handler,
  };
});

vi.mock("vaul", () => {
  const DrawerRoot = ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="vaul-root">{children}</div> : null;
  const DrawerPortal = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="vaul-portal">{children}</div>
  );
  const DrawerContent = ({
    children,
    onEscapeKeyDown,
    ...rest
  }: React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    onEscapeKeyDown?: (e: { preventDefault: () => void }) => void;
  }) => {
    setEscapeHandler(onEscapeKeyDown);
    return (
      <div data-testid="vaul-content" {...rest}>
        {children}
      </div>
    );
  };
  const DrawerTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="vaul-title" className={className}>
      {children}
    </h2>
  );
  return { Drawer: { Root: DrawerRoot, Portal: DrawerPortal, Content: DrawerContent, Title: DrawerTitle } };
});

import BottomSheet from "@/components/BottomSheet";

function makeSheetVenue(): Venue & { distanceMiles?: number } {
  return {
    id: "test-venue-527-sheet",
    name: "Test Sheet Venue",
    category: "pantry",
    lat: 38.254,
    lng: -104.62,
    address: "123 Test St, Pueblo, CO",
    source: "test",
    last_verified: "2026-01-01",
  };
}

describe("#527 — BottomSheet participates in the same overlay-escape stack", () => {
  test("Filters open on top of the sheet: onEscapeKeyDown prevents vaul's own dismiss", async () => {
    stubMatchMedia(true);
    const onClose = vi.fn();

    function Harness() {
      const [filterOpen, setFilterOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setFilterOpen((o) => !o)}>
            Toggle filters
          </button>
          <BottomSheet venue={makeSheetVenue()} onClose={onClose} />
          <FilterPanel {...FILTER_PANEL_STATIC_PROPS} open={filterOpen} onClose={() => setFilterOpen(false)} />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle filters" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: /filters/i })).toBeDefined());

    const onEscapeKeyDown = getEscapeHandler();
    expect(onEscapeKeyDown).toBeTypeOf("function");

    const preventDefault = vi.fn();
    onEscapeKeyDown!({ preventDefault });

    // Filters is topmost, not the sheet — vaul's own dismiss must be blocked.
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("no higher overlay: onEscapeKeyDown does NOT preventDefault, letting vaul dismiss normally", () => {
    const onClose = vi.fn();
    render(<BottomSheet venue={makeSheetVenue()} onClose={onClose} />);

    const onEscapeKeyDown = getEscapeHandler();
    const preventDefault = vi.fn();
    onEscapeKeyDown!({ preventDefault });

    // Sheet is the only (topmost) overlay — not blocked here; vaul's own
    // onOpenChange->onClose flow (untouched by this fix) handles the dismiss.
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
