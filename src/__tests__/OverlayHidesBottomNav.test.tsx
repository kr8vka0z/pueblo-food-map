/**
 * OverlayHidesBottomNav — #542 integration proof: each full-surface overlay
 * (Menu on mobile, Filters, PhotoViewer) hides the REAL BottomNav via the
 * shared registry (`src/lib/overlayRegistry.ts`) while open, restores it on
 * close, and stacking two overlays then closing only one still leaves it
 * hidden. Each overlay component is rendered directly beside a real
 * BottomNav (not a mounted MapWrapper) — faster, and the registry is a
 * module-level singleton so this proves the exact same wiring MapWrapper/
 * PageNav rely on.
 *
 * The full venue/box card path (MapWrapper's `venueSheetOpen`) is already
 * covered end-to-end by MapWrapperViewSwitch.test.tsx's "phone venue sheet
 * hides the bottom chrome" describe block; the route steps sheet
 * (RouteStrip's `stepsOpen`) is covered by RouteNavVisibility.test.tsx. Both
 * predate #542 and aren't duplicated here.
 */
import { useRef, useState } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BottomNav from "@/components/BottomNav";
import HamburgerMenu from "@/components/HamburgerMenu";
import FilterPanel from "@/components/FilterPanel";
import PhotoViewer from "@/components/PhotoViewer";
import type { GeoState } from "@/lib/useGeolocation";

const GEO_IDLE: GeoState = { permission: "prompt", position: null };

function NavHarness() {
  return (
    <BottomNav
      locale="en"
      openSection={null}
      onSectionTap={() => {}}
      geoState={GEO_IDLE}
      isLocating={false}
      isDrifted={false}
      onNearMe={() => {}}
      boxesActive={false}
      onBoxesToggle={() => {}}
    />
  );
}

function MenuHarness() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen((o) => !o)}>
        Open menu
      </button>
      <HamburgerMenu locale="en" open={open} onClose={() => setOpen(false)} ignoreOutsideRef={openerRef} />
      <NavHarness />
    </>
  );
}

// Shared prop shape every FilterPanel harness below needs — no-op handlers,
// since these tests only care about open/close, not any one filter's state.
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

function FilterHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        Open filters
      </button>
      <FilterPanel {...FILTER_PANEL_STATIC_PROPS} open={open} onClose={() => setOpen(false)} />
      <NavHarness />
    </>
  );
}

function PhotoHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        Open photo
      </button>
      <PhotoViewer src="/photo.jpg" alt="A test photo" open={open} onClose={() => setOpen(false)} locale="en" />
      <NavHarness />
    </>
  );
}

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
      <NavHarness />
    </>
  );
}

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

describe("#542 — full-surface overlays hide BottomNav", () => {
  beforeEach(() => {
    // matches:true -> phone layout everywhere (HamburgerMenu's MOBILE_QUERY
    // and BELOW_2XL_QUERY both match) — the full-sheet Menu variant that
    // registers as an overlay, not the tablet/desktop dropdown that doesn't.
    stubMatchMedia(true);
  });

  test("Menu (mobile) hides the nav while open, restores it on close", async () => {
    render(<MenuHarness />);
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();

    // useMediaQuery.ts starts `false` on every render (SSR-safe) and syncs
    // to the real matchMedia stub via a setTimeout(0) — wait for that sync
    // before the click, or HamburgerMenu still thinks isMobile is false and
    // never registers as an overlay.
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    await waitFor(() => expect(document.querySelector("[data-bottom-nav]")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });

  test("Menu on a tablet/desktop width does NOT hide the nav — its own dropdown already clears it", () => {
    stubMatchMedia(false);
    render(<MenuHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });

  test("Filters hides the nav while open, restores it on close", () => {
    render(<FilterHarness />);
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    fireEvent.click(screen.getByTestId("filter-panel-backdrop"));
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });

  test("PhotoViewer hides the nav while open, restores it on close", () => {
    render(<PhotoHarness />);
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open photo" }));
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });

  // #542's own acceptance criterion: "two overlays open then one closed
  // keeps it hidden."
  test("two overlays open, closing one leaves the nav hidden; closing both restores it", async () => {
    render(<TwoOverlaysHarness />);
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle filters" }));
    // See the mobile-sync comment above — the Menu's own registration lags
    // one setTimeout(0) behind Filters', which registers immediately.
    await waitFor(() => expect(document.querySelector("[data-bottom-nav]")).toBeNull());

    // Close Filters only — the Menu is still open, so the nav stays hidden.
    fireEvent.click(screen.getByTestId("filter-panel-backdrop"));
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    // Close the Menu too — nothing left open, the nav returns.
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });
});
