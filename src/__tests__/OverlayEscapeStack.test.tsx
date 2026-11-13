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
import DesktopSidePanel from "@/components/DesktopSidePanel";
import LocationHelpCard from "@/components/LocationHelpCard";
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

  // #682 8b: the Escape listener under test moved from DesktopVenueWindow to
  // DesktopSidePanel (coordinator: "Lift ... overlay registration into
  // DesktopSidePanel") — wraps the real shell now, same as
  // DesktopVenueWindow.escapeGuard.test.tsx.
  test("DesktopVenueWindow open (inside DesktopSidePanel), Filters opened on top: Escape closes Filters only, window stays open", async () => {
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
          <DesktopSidePanel open onClose={onClose} headingId={`venue-window-title-${venue.id}`}>
            {(close) => (
              <DesktopVenueWindow
                venue={venue}
                onClose={close}
                locale="en"
              />
            )}
          </DesktopSidePanel>
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

  // CI review follow-up on PR #604: LocationDeniedBanner (now LocationHelpCard, #739) ran its own
  // ungated document Escape listener — the same failure mode #527 fixed for
  // the other four overlays, reachable since the banner isn't full-screen
  // and nothing blocks opening Filters on top of it.
  test("LocationHelpCard open, Filters opened on top: Escape closes Filters only, banner stays open", async () => {
    const onDismiss = vi.fn();

    function Harness() {
      const [filterOpen, setFilterOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setFilterOpen((o) => !o)}>
            Toggle filters
          </button>
          <LocationHelpCard failure={{ permission: "denied", position: null }} onRetry={() => {}} onShowList={() => {}} onDismiss={onDismiss} locale="en" />
          <FilterPanel {...FILTER_PANEL_STATIC_PROPS} open={filterOpen} onClose={() => setFilterOpen(false)} />
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle filters" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: /filters/i })).toBeDefined());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /filters/i })).toBeNull());
    expect(onDismiss).not.toHaveBeenCalled();

    // Filters is gone — the banner is topmost again, Escape now dismisses it.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// ─── BottomSheet (its own document capture-phase Escape listener) ──────────
// The phone card is the native scroll sheet (ScrollSheet.tsx, #923), which
// listens for Escape on `document` in the capture phase, where Radix's
// listener sat under vaul, so a real keydown drives it here.

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
  test("Filters open on top of the sheet: Escape closes Filters, not the sheet", async () => {
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

    fireEvent.keyDown(document, { key: "Escape" });

    // Filters is topmost, not the sheet: only Filters closes.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /filters/i })).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  test("no higher overlay: Escape closes the sheet", () => {
    const onClose = vi.fn();
    render(<BottomSheet venue={makeSheetVenue()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
