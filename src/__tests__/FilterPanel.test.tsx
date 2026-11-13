/**
 * FilterPanel tests (#513) — the left side panel that replaced CategoryDropdown.
 *
 * Coverage:
 *   1. Renders nothing when closed; dialog role + title when open.
 *   2. "Show only" switches (Open now / SNAP / WIC): role=switch, aria-checked
 *      reflects props, click fires the right handler.
 *   3. "Kind of place" switch rows (#917, no tick boxes): 8 rows, color dot + localized label, checked
 *      state reflects selectedCategories, click fires onToggleCategory.
 *   4. Clear all / Show N places / × close all fire their handlers.
 *   5. Close paths: Escape key, backdrop tap, swipe-left gesture.
 *   6. Focus trap: Tab wraps inside the panel while open.
 *   7. ES locale labels.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterPanel from "@/components/FilterPanel";
import type { VenueCategory } from "@/types/venue";
import { track, EVENTS } from "@/lib/analytics";

// #485 PR 2: mock the whole module so EVENTS keeps its real allowlist values.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const ALL_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
  "blessing_box",
];

function baseProps(overrides: Partial<React.ComponentProps<typeof FilterPanel>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    resultCount: 42,
    filterOpenNow: false,
    onToggleOpenNow: vi.fn(),
    filterSnap: false,
    onToggleSnap: vi.fn(),
    filterWic: false,
    onToggleWic: vi.fn(),
    selectedCategories: null as Set<VenueCategory> | null,
    onToggleCategory: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  };
}

describe("FilterPanel — open/closed", () => {
  test("renders nothing when open=false", () => {
    render(<FilterPanel {...baseProps({ open: false })} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("renders a dialog with the Filters title when open", () => {
    render(<FilterPanel {...baseProps()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(screen.getByText("Filters")).toBeDefined();
  });
});

describe("FilterPanel — Show only switches", () => {
  test("Open now switch reflects filterOpenNow and fires onToggleOpenNow", () => {
    const onToggleOpenNow = vi.fn();
    render(<FilterPanel {...baseProps({ filterOpenNow: true, onToggleOpenNow })} />);
    const sw = screen.getByRole("switch", { name: /open now/i });
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    expect(onToggleOpenNow).toHaveBeenCalledTimes(1);
  });

  test("SNAP switch reflects filterSnap and fires onToggleSnap", () => {
    const onToggleSnap = vi.fn();
    render(<FilterPanel {...baseProps({ filterSnap: false, onToggleSnap })} />);
    const sw = screen.getByRole("switch", { name: /accepts snap/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onToggleSnap).toHaveBeenCalledTimes(1);
  });

  test("WIC switch reflects filterWic and fires onToggleWic", () => {
    const onToggleWic = vi.fn();
    render(<FilterPanel {...baseProps({ filterWic: true, onToggleWic })} />);
    const sw = screen.getByRole("switch", { name: /accepts wic/i });
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    expect(onToggleWic).toHaveBeenCalledTimes(1);
  });
});

describe("FilterPanel — Kind of place switch rows", () => {
  test("renders all 8 categories as switches, with no tick boxes (#917)", () => {
    render(<FilterPanel {...baseProps()} />);
    // 3 Show only switches (no events) + 8 kinds of place.
    expect(screen.getAllByRole("switch")).toHaveLength(11);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("each kind-of-place row shows its count when counts are given (#917)", () => {
    render(<FilterPanel {...baseProps({ categoryCounts: { pantry: 35, blessing_box: 4 } })} />);
    const row = (name: RegExp) => screen.getByRole("switch", { name }).parentElement!;
    expect(row(/food pantry/i).textContent).toContain("35");
    expect(row(/blessing box/i).textContent).toContain("4");
    // A kind with no places says 0, never a blank.
    expect(row(/grocery/i).textContent).toContain("0");
  });

  test("shows EN category labels", () => {
    render(<FilterPanel {...baseProps()} />);
    expect(screen.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByText("Blessing Box")).toBeDefined();
  });

  test("multiple categories can be checked at once (reflects selectedCategories)", () => {
    render(
      <FilterPanel
        {...baseProps({ selectedCategories: new Set(["pantry", "blessing_box"]) })}
      />,
    );
    const pantry = screen.getByRole("switch", { name: /food pantry/i });
    const blessing = screen.getByRole("switch", { name: /blessing box/i });
    const grocery = screen.getByRole("switch", { name: /grocery/i });
    expect(pantry).toHaveAttribute("aria-checked", "true");
    expect(blessing).toHaveAttribute("aria-checked", "true");
    expect(grocery).toHaveAttribute("aria-checked", "false");
  });

  test.each(ALL_CATEGORIES)("checking %s fires onToggleCategory with that category", (cat) => {
    const onToggleCategory = vi.fn();
    render(<FilterPanel {...baseProps({ onToggleCategory })} />);
    const label = screen.getByText(
      cat === "blessing_box"
        ? "Blessing Box"
        : cat === "edible_landscape"
          ? "Edible Landscape"
          : cat === "meal_site"
            ? "Meal Site"
            : new RegExp(cat, "i"),
    );
    // The switch is the row's tap area (its overlay spans the row).
    fireEvent.click(label.closest("div")!.querySelector('[role="switch"]')!);
    expect(onToggleCategory).toHaveBeenCalledWith(cat);
  });
});

describe("FilterPanel — Clear all / Show N places / close", () => {
  test("Clear all button fires onClearAll", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(<FilterPanel {...baseProps({ onClearAll })} />);
    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  test("Show N places button shows the live count and closes the panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FilterPanel {...baseProps({ resultCount: 7, onClose })} />);
    const btn = screen.getByRole("button", { name: /show 7 places/i });
    await user.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // #529: this button referenced --color-orange/--color-navy, neither
  // defined in globals.css — DESIGN.md's real orange exception is
  // --color-brand-orange/--color-brand-navy.
  test("Show N places button uses the real brand tokens, not the undefined --color-orange/--color-navy", () => {
    render(<FilterPanel {...baseProps({ resultCount: 7 })} />);
    const btn = screen.getByRole("button", { name: /show 7 places/i });
    expect(btn.className).toContain("bg-[var(--color-brand-orange)]");
    expect(btn.className).toContain("text-[var(--color-brand-navy)]");
    expect(btn.className).not.toContain("--color-orange)");
    expect(btn.className).not.toContain("--color-navy)");
  });

  test("× close button fires onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FilterPanel {...baseProps({ onClose })} />);
    await user.click(screen.getByRole("button", { name: /close filters/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Escape key fires onClose", () => {
    const onClose = vi.fn();
    render(<FilterPanel {...baseProps({ onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("tapping the dimmed backdrop fires onClose", () => {
    const onClose = vi.fn();
    render(<FilterPanel {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByTestId("filter-panel-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("swiping left on the panel fires onClose", () => {
    const onClose = vi.fn();
    render(<FilterPanel {...baseProps({ onClose })} />);
    const panel = screen.getByRole("dialog");
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a small horizontal touch movement does NOT close (avoids accidental dismiss)", () => {
    const onClose = vi.fn();
    render(<FilterPanel {...baseProps({ onClose })} />);
    const panel = screen.getByRole("dialog");
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 185, clientY: 100 }] });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("FilterPanel — focus trap", () => {
  test("Tab from the last focusable element wraps to the first", async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...baseProps()} />);
    // Query in true DOM order (every row's switch is a <button role="switch">,
    // so a single button selector reflects the panel's real tab order).
    const dialog = screen.getByRole("dialog");
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>("button"),
    );
    expect(focusable.length).toBeGreaterThan(1);
    focusable[focusable.length - 1]!.focus();
    await user.tab();
    expect(document.activeElement).toBe(focusable[0]);
  });

  test("Shift+Tab from the first focusable element wraps to the last", async () => {
    const user = userEvent.setup();
    render(<FilterPanel {...baseProps()} />);
    const dialog = screen.getByRole("dialog");
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>("button"),
    );
    focusable[0]!.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });
});

describe("FilterPanel — ES locale", () => {
  test("shows ES labels for title, sections, and categories", () => {
    render(<FilterPanel {...baseProps({ locale: "es" })} />);
    expect(screen.getByText("Filtros")).toBeDefined();
    expect(screen.getByText("Despensa de alimentos")).toBeDefined();
  });
});

// ─── Analytics (#485 PR 2) ───────────────────────────────────────────────────

describe("FilterPanel — analytics", () => {
  test("turning Open now ON fires filter_toggled with on=true", () => {
    render(<FilterPanel {...baseProps({ filterOpenNow: false })} />);
    fireEvent.click(screen.getByRole("switch", { name: /open now/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.FILTER_TOGGLED, {
      filter: "open_now",
      on: true,
    });
  });

  test("turning SNAP OFF fires filter_toggled with on=false", () => {
    render(<FilterPanel {...baseProps({ filterSnap: true })} />);
    fireEvent.click(screen.getByRole("switch", { name: /accepts snap/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.FILTER_TOGGLED, {
      filter: "snap",
      on: false,
    });
  });

  test("turning WIC ON fires filter_toggled with on=true", () => {
    render(<FilterPanel {...baseProps({ filterWic: false })} />);
    fireEvent.click(screen.getByRole("switch", { name: /accepts wic/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.FILTER_TOGGLED, {
      filter: "wic",
      on: true,
    });
  });

  test("checking a category fires filter_toggled with on=true", () => {
    render(<FilterPanel {...baseProps({ selectedCategories: null })} />);
    fireEvent.click(screen.getByRole("switch", { name: /food pantry/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.FILTER_TOGGLED, {
      filter: "pantry",
      on: true,
    });
  });

  test("unchecking a category fires filter_toggled with on=false", () => {
    render(
      <FilterPanel {...baseProps({ selectedCategories: new Set(["pantry"]) })} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /food pantry/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.FILTER_TOGGLED, {
      filter: "pantry",
      on: false,
    });
  });
});
