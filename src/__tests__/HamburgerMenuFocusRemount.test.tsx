/**
 * HamburgerMenuFocusRemount — #545 regression proof.
 *
 * Reproduces the actual bug against the REAL BottomNav (not a plain harness
 * button — see HamburgerMenu.test.tsx's own Harness, which never unmounts
 * its opener and so never exercised this path): on mobile, opening the Menu
 * unmounts BottomNav entirely (#542, overlayRegistry.ts) — including the
 * nav-top button that opened it. Closing the Menu used to `.focus()` that
 * now-detached element, a silent no-op, leaving focus on <body>. The fix
 * re-finds the equivalent bottom-bar item by its stable data-testid once
 * BottomNav has remounted (HamburgerMenu.tsx's `close()`).
 */
import { useState } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import HamburgerMenu from "@/components/HamburgerMenu";
import BottomNav, { type MenuSection } from "@/components/BottomNav";
import type { GeoState } from "@/lib/useGeolocation";

const GEO_IDLE: GeoState = { permission: "prompt", position: null };

// useMediaQuery syncs `isMobile` on a setTimeout(0) after mount, so a click
// fired straight after render() opens the DESKTOP Menu (which never hides
// BottomNav) — the source of this file's intermittent CI failure. Let that
// timer fire first, as it always has by the time a real user can tap.
async function renderSettled() {
  render(<MapPageHarness />);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function MapPageHarness() {
  const [openSection, setOpenSection] = useState<MenuSection | null>(null);
  return (
    <>
      <HamburgerMenu
        locale="en"
        open={openSection !== null}
        onClose={() => setOpenSection(null)}
        view={openSection ?? "top"}
      />
      <BottomNav
        locale="en"
        openSection={openSection}
        onSectionTap={(section: MenuSection) =>
          setOpenSection((cur) => (cur === section ? null : section))
        }
        geoState={GEO_IDLE}
        isLocating={false}
        isDrifted={false}
        onNearMe={() => {}}
        boxesActive={false}
        onBoxesToggle={() => {}}
      />
    </>
  );
}

beforeEach(() => {
  // Mobile layout — the full-sheet Menu variant that unmounts BottomNav
  // (#542); see this file's header.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

describe("#545 — focus after the mobile Menu closes and BottomNav remounts", () => {
  test("Escape: focus lands back on the (rebuilt) Menu nav item, not <body>", async () => {
    await renderSettled();

    fireEvent.click(screen.getByTestId("nav-top"));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());
    // BottomNav has unmounted — the button focus was captured from no longer exists.
    expect(screen.queryByTestId("nav-top")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(screen.getByTestId("nav-top"));
    });
  });

  test("X-button close: focus lands back on the (rebuilt) Menu nav item, not <body>", async () => {
    await renderSettled();

    fireEvent.click(screen.getByTestId("nav-top"));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(screen.getByTestId("nav-top"));
    });
  });

  test("Saved view: focus lands back on the rebuilt nav-saved item", async () => {
    await renderSettled();

    fireEvent.click(screen.getByTestId("nav-saved"));
    await waitFor(() => expect(screen.getByRole("button", { name: /close menu/i })).toBeDefined());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("nav-saved")).not.toBeNull());

    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(screen.getByTestId("nav-saved"));
    });
  });
});
