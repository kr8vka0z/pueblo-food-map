/**
 * BottomSheet accessible-description tests (#590, follow-up).
 *
 * #590 was filed against SplashScreen.tsx, but that component has no Radix
 * Dialog at all (see SplashScreen.description.test.tsx's header) — the real
 * emitter of Radix's "Missing `Description` or `aria-describedby={undefined}`
 * for {DialogContent}" warning is here: vaul's `Drawer.Content` (BottomSheet,
 * line ~243) forwards straight to `@radix-ui/react-dialog`'s `Dialog.Content`.
 * Confirmed live via `agent-browser console` — the warning fires when a venue
 * card opens, not on splash load.
 *
 * Deliberately does NOT mock "vaul" (every other BottomSheet test does, see
 * a11y.test.tsx's own header) — the whole point is exercising the real
 * Radix Dialog primitive so its actual dev-mode warning logic runs. Spiked
 * first in a throwaway render to confirm real vaul mounts cleanly in jsdom
 * with no extra polyfills (it does): produces a real `role="dialog"` element
 * with Radix's own generated `aria-describedby`/`aria-labelledby` wiring.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "desc-test-venue",
    name: "Description Test Pantry",
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: "123 Test St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

describe("BottomSheet Drawer.Content accessible description (#590 follow-up)", () => {
  test("dialog has aria-describedby pointing at a real, non-empty element", () => {
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} locale="en" />);
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const descriptionEl = document.getElementById(describedBy as string);
    expect(descriptionEl).not.toBeNull();
    expect(descriptionEl?.textContent?.trim().length).toBeGreaterThan(0);
  });

  test("description reuses the existing category-badge copy + address, not new hidden text", () => {
    render(
      <BottomSheet
        venue={makeVenue({ category: "grocery", address: "456 Elm St" })}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby") as string;
    const descriptionEl = document.getElementById(describedBy);
    // "Grocery / Supermarket" is the same category.full.grocery string the
    // visible category badge renders (BottomSheet.tsx ~line 524).
    expect(descriptionEl?.textContent).toContain("Grocery / Supermarket");
    expect(descriptionEl?.textContent).toContain("456 Elm St");
  });

  test("swaps the OSM placeholder address for coordinates, same guard as the visible address line", () => {
    render(
      <BottomSheet
        venue={makeVenue({ address: "Address not in OpenStreetMap", lat: 38.1, lng: -104.5 })}
        onClose={vi.fn()}
        locale="en"
      />,
    );
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby") as string;
    const descriptionEl = document.getElementById(describedBy);
    expect(descriptionEl?.textContent).not.toContain("Address not in OpenStreetMap");
    expect(descriptionEl?.textContent).toContain("38.1, -104.5");
  });

  test("ES locale localizes the description via the existing category.full.* keys", () => {
    render(
      <BottomSheet
        venue={makeVenue({ category: "blessing_box" })}
        onClose={vi.fn()}
        locale="es"
      />,
    );
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby") as string;
    const descriptionEl = document.getElementById(describedBy);
    expect(descriptionEl?.textContent).toContain("Caja de bendiciones");
  });

  test("no Radix console warning about a missing dialog description when a venue card opens", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<BottomSheet venue={makeVenue()} onClose={vi.fn()} locale="en" />);
    const allCalls = [...warnSpy.mock.calls, ...errorSpy.mock.calls].map((c) => String(c[0]));
    const describedByWarning = allCalls.find((msg) =>
      /Description.*aria-describedby|aria-describedby.*Description/i.test(msg),
    );
    expect(describedByWarning).toBeUndefined();
  });
});
