/**
 * #917 round 3 (Kyle: Filters and the Menu appeared and vanished "way too
 * fast", no slide): both side panels slide, so a closed panel stays mounted
 * while it slides out, then unmounts. The risks pinned here:
 *   - while sliding out it is inert (no focus, no taps) and then really goes;
 *   - a reduced-motion visitor gets no hold: closed means gone at once;
 *   - the Menu's tablet/desktop dropdown, which has no slide, is never held.
 * The other panel suites stub matchMedia without `no-preference`, so they run
 * the no-motion path and keep asserting close-then-gone.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import FilterPanel from "@/components/FilterPanel";
import HamburgerMenu from "@/components/HamburgerMenu";
import { MOBILE_QUERY } from "@/lib/useMediaQuery";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

function stubMedia({ reduce = false, mobile = true } = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches:
        (q === "(prefers-reduced-motion: no-preference)" && !reduce) ||
        (q === "(prefers-reduced-motion: reduce)" && reduce) ||
        (q === MOBILE_QUERY && mobile),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const filterProps = {
  onClose: vi.fn(),
  resultCount: 3,
  filterOpenNow: false,
  onToggleOpenNow: vi.fn(),
  filterSnap: false,
  onToggleSnap: vi.fn(),
  filterWic: false,
  onToggleWic: vi.fn(),
  selectedCategories: null,
  onToggleCategory: vi.fn(),
  onClearAll: vi.fn(),
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Filters panel slide", () => {
  test("closing keeps it mounted and inert while it slides out, then unmounts", () => {
    stubMedia();
    const { rerender } = render(<FilterPanel {...filterProps} open />);
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("duration-300");
    expect(panel.className).toContain("starting:-translate-x-full");

    rerender(<FilterPanel {...filterProps} open={false} />);
    expect(panel.isConnected).toBe(true);
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.className).toContain("-translate-x-full");
    expect(screen.getByTestId("filter-panel-backdrop").className).toContain("pointer-events-none");

    act(() => vi.advanceTimersByTime(250));
    expect(panel.isConnected).toBe(false);
    expect(screen.queryByTestId("filter-panel-backdrop")).toBeNull();
  });

  test("reduced motion: closed means gone at once", () => {
    stubMedia({ reduce: true });
    const { rerender } = render(<FilterPanel {...filterProps} open />);
    rerender(<FilterPanel {...filterProps} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("reopening mid-slide keeps the same panel and makes it usable again", () => {
    stubMedia();
    const { rerender } = render(<FilterPanel {...filterProps} open />);
    const panel = screen.getByRole("dialog");
    rerender(<FilterPanel {...filterProps} open={false} />);
    act(() => vi.advanceTimersByTime(100));
    rerender(<FilterPanel {...filterProps} open />);
    act(() => vi.advanceTimersByTime(500));
    expect(panel.isConnected).toBe(true);
    expect(panel.hasAttribute("inert")).toBe(false);
  });
});

describe("Menu panel slide", () => {
  test("on a phone, closing keeps it mounted and inert while it slides out, then unmounts", () => {
    stubMedia();
    const { rerender } = render(<HamburgerMenu locale="en" open onClose={vi.fn()} />);
    const panel = document.getElementById("hamburger-panel")!;
    expect(panel.className).toContain("starting:translate-x-full");

    rerender(<HamburgerMenu locale="en" open={false} onClose={vi.fn()} />);
    expect(panel.isConnected).toBe(true);
    expect(panel.hasAttribute("inert")).toBe(true);

    act(() => vi.advanceTimersByTime(250));
    expect(document.getElementById("hamburger-panel")).toBeNull();
  });

  test("the tablet/desktop dropdown has no slide and is never held", () => {
    stubMedia({ mobile: false });
    const { rerender } = render(<HamburgerMenu locale="en" open onClose={vi.fn()} />);
    expect(document.getElementById("hamburger-panel")!.className).toBe("");
    rerender(<HamburgerMenu locale="en" open={false} onClose={vi.fn()} />);
    expect(document.getElementById("hamburger-panel")).toBeNull();
  });
});
