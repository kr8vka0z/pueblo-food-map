/**
 * MapWrapper chrome layout tests — issues #97, #95 (partial), #96, #99, #109
 *
 * #97: Wordmark is in the top-left cluster. EN/ES toggle was here but moved
 *      to the hamburger menu in #109 — top-left cluster now holds only the Wordmark.
 * #109: EN/ES toggle is in the hamburger menu (covered in HamburgerMenu.test.tsx).
 * #95: CategoryDropdown renders listbox with all 7 categories + venue counts;
 *      clicking a category fires onSelect; active category has aria-selected;
 *      SearchBar shows filterChip when active category is set.
 *
 * These tests mount only the sub-components in isolation (no full MapWrapper,
 * which requires Mapbox WebGL).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import Wordmark from "@/components/Wordmark";
import CategoryDropdown, { BROWSE_CATEGORIES } from "@/components/CategoryDropdown";
import SearchBar from "@/components/SearchBar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderTopLeftCluster() {
  return render(
    <LocaleProvider>
      {/* Simulate the top-left container from MapWrapper (#109: toggle removed) */}
      <div
        data-testid="top-left-cluster"
        style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8, alignItems: "center" }}
      >
        <Wordmark onClick={vi.fn()} locale="en" size="sm" selfPositioned={false} />
      </div>
    </LocaleProvider>,
  );
}

// ─── #97 / #109: Top-left cluster contains Wordmark (toggle moved to hamburger menu) ───

describe("#97/#109 — top-left cluster contains Wordmark; language toggle is in hamburger menu", () => {
  test("Wordmark renders inside the top-left container", () => {
    renderTopLeftCluster();
    const cluster = screen.getByTestId("top-left-cluster");
    const wordmark = screen.getByRole("button", { name: /Pueblo Food Map/i });
    expect(cluster.contains(wordmark)).toBe(true);
  });

  test("EN/ES toggle buttons are NOT in the top-left cluster (#109)", () => {
    renderTopLeftCluster();
    // After #109, language toggle is not in the top-left cluster
    expect(screen.queryByRole("button", { name: /english/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /spanish/i })).toBeNull();
  });

  test("Wordmark does NOT carry absolute positioning classes when selfPositioned=false", () => {
    const { container } = render(
      <LocaleProvider>
        <Wordmark onClick={vi.fn()} locale="en" size="sm" selfPositioned={false} />
      </LocaleProvider>,
    );
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    // Should NOT have self-positioning classes
    expect(btn!.className).not.toMatch(/\babsolute\b/);
    expect(btn!.className).not.toMatch(/\btop-4\b/);
    expect(btn!.className).not.toMatch(/\bleft-4\b/);
  });

  test("Wordmark retains absolute positioning classes when selfPositioned=true (default)", () => {
    const { container } = render(
      <LocaleProvider>
        <Wordmark onClick={vi.fn()} locale="en" size="sm" />
      </LocaleProvider>,
    );
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.className).toMatch(/\babsolute\b/);
    expect(btn!.className).toMatch(/\btop-4\b/);
    expect(btn!.className).toMatch(/\bleft-4\b/);
  });
});

// ─── #95: CategoryDropdown ────────────────────────────────────────────────────

const SAMPLE_COUNTS = {
  pantry: 36,
  grocery: 12,
  convenience: 45,
  farm: 3,
  garden: 6,
  edible_landscape: 4,
  meal_site: 2,
};

function renderCategoryDropdown(
  activeCategory: Parameters<typeof CategoryDropdown>[0]["activeCategory"] = null,
  onSelect = vi.fn(),
) {
  return render(
    <div style={{ position: "relative" }}>
      <CategoryDropdown
        counts={SAMPLE_COUNTS}
        activeCategory={activeCategory}
        onSelect={onSelect}
        openNowActive={false}
        onToggleOpenNow={vi.fn()}
        snapActive={false}
        onToggleSnap={vi.fn()}
        wicActive={false}
        onToggleWic={vi.fn()}
      />
    </div>,
  );
}

describe("#95 — CategoryDropdown rendering", () => {
  test("renders a listbox role", () => {
    renderCategoryDropdown();
    expect(screen.getByRole("listbox")).toBeDefined();
  });

  test("renders 10 option rows (Open now + Accepts SNAP + Accepts WIC + 7 categories)", () => {
    renderCategoryDropdown();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(10);
  });

  test("BROWSE_CATEGORIES exports all 7 categories in legend order", () => {
    expect(BROWSE_CATEGORIES).toHaveLength(7);
    expect(BROWSE_CATEGORIES[0]).toBe("pantry");
    expect(BROWSE_CATEGORIES[6]).toBe("meal_site");
  });

  test("shows EN category labels", () => {
    renderCategoryDropdown();
    expect(screen.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByText("Grocery / Supermarket")).toBeDefined();
    expect(screen.getByText("Convenience Store")).toBeDefined();
  });

  test("shows venue count for each category", () => {
    renderCategoryDropdown();
    // Pantry count is 36
    expect(screen.getByText("36")).toBeDefined();
    // Grocery count is 12
    expect(screen.getByText("12")).toBeDefined();
  });
});

describe("#95 — CategoryDropdown interaction", () => {
  test("clicking a category row calls onSelect with that category", () => {
    const onSelect = vi.fn();
    renderCategoryDropdown(null, onSelect);
    const options = screen.getAllByRole("option");
    // options[0]=Open now; options[1]=SNAP; options[2]=WIC; options[3]=pantry (first category)
    fireEvent.click(options[3]);
    expect(onSelect).toHaveBeenCalledWith("pantry");
  });

  test("clicking the active category calls onSelect with null (toggle-off)", () => {
    const onSelect = vi.fn();
    renderCategoryDropdown("pantry", onSelect);
    const options = screen.getAllByRole("option");
    // options[0]=Open now; options[1]=SNAP; options[2]=WIC; options[3]=pantry
    fireEvent.click(options[3]);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  test("active category option has aria-selected=true", () => {
    renderCategoryDropdown("grocery");
    const options = screen.getAllByRole("option");
    // options[0]=Open now; options[1]=SNAP; options[2]=WIC; options[3]=pantry; options[4]=grocery
    expect(options[4].getAttribute("aria-selected")).toBe("true");
    // pantry should be false
    expect(options[3].getAttribute("aria-selected")).toBe("false");
  });

  test("no category active: all options have aria-selected=false", () => {
    renderCategoryDropdown(null);
    const options = screen.getAllByRole("option");
    options.forEach((opt) => {
      expect(opt.getAttribute("aria-selected")).toBe("false");
    });
  });
});

describe("#95 — CategoryDropdown ES locale", () => {
  test("shows ES category labels", () => {
    render(
      <div style={{ position: "relative" }}>
        <CategoryDropdown
          counts={SAMPLE_COUNTS}
          activeCategory={null}
          onSelect={vi.fn()}
          locale="es"
          openNowActive={false}
          onToggleOpenNow={vi.fn()}
          snapActive={false}
          onToggleSnap={vi.fn()}
          wicActive={false}
          onToggleWic={vi.fn()}
        />
      </div>,
    );
    expect(screen.getByText("Despensa de alimentos")).toBeDefined();
    expect(screen.getByText("Supermercado")).toBeDefined();
  });
});

// ─── a11y fix: combobox aria-controls switches per active listbox ─────────────
//
// Verifies that SearchBar correctly reflects whichever listbox id is passed as
// comboboxControls — the dynamic wiring lives in MapWrapper, but SearchBar is
// the unit that surfaces the ARIA attribute, so we test both directions here.

describe("SearchBar combobox — aria-controls switches between listbox ids", () => {
  const RESULTS_ID = "search-results-listbox";
  const CATEGORY_ID = "category-browse-listbox";

  test("aria-controls references the results listbox id when results dropdown is open", () => {
    render(
      <SearchBar
        value="pantry"
        onChange={vi.fn()}
        comboboxEnabled={true}
        comboboxExpanded={true}
        comboboxControls={RESULTS_ID}
      />,
    );
    const input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-controls")).toBe(RESULTS_ID);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  test("aria-controls references the category listbox id when category dropdown is open", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        comboboxEnabled={true}
        comboboxExpanded={true}
        comboboxControls={CATEGORY_ID}
      />,
    );
    const input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-controls")).toBe(CATEGORY_ID);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  test("aria-controls is absent and aria-expanded is false when neither dropdown is open", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        comboboxEnabled={true}
        comboboxExpanded={false}
        comboboxControls={undefined}
      />,
    );
    const input = screen.getByRole("combobox");
    // aria-controls should not be present when comboboxControls is undefined
    expect(input.getAttribute("aria-controls")).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  test("aria-controls transitions from category id to results id as user types (prop sequence)", () => {
    const { rerender } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        comboboxEnabled={true}
        comboboxExpanded={true}
        comboboxControls={CATEGORY_ID}
      />,
    );
    let input = screen.getByRole("combobox");
    // Empty query → category dropdown → aria-controls = category id
    expect(input.getAttribute("aria-controls")).toBe(CATEGORY_ID);

    // User starts typing → results dropdown → aria-controls = results id
    rerender(
      <SearchBar
        value="pantry"
        onChange={vi.fn()}
        comboboxEnabled={true}
        comboboxExpanded={true}
        comboboxControls={RESULTS_ID}
      />,
    );
    input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-controls")).toBe(RESULTS_ID);

    // User clears query → back to category dropdown
    rerender(
      <SearchBar
        value=""
        onChange={vi.fn()}
        comboboxEnabled={true}
        comboboxExpanded={true}
        comboboxControls={CATEGORY_ID}
      />,
    );
    input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-controls")).toBe(CATEGORY_ID);
  });
});

// ─── #95 — SearchBar filterChip ───────────────────────────────────────────────

describe("#95 — SearchBar filterChip", () => {
  test("no chip renders when filterChip is undefined", () => {
    const { container } = render(
      <SearchBar value="" onChange={vi.fn()} />,
    );
    // No × button rendered
    expect(container.querySelector("button")).toBeNull();
  });

  test("chip renders when filterChip is provided", () => {
    const onClear = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Food Pantry", onClear }}
      />,
    );
    expect(screen.getByText("Food Pantry")).toBeDefined();
  });

  test("chip × button calls onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Food Pantry", clearAriaLabel: "Clear category filter", onClear }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Clear category filter/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test("search icon hidden when filterChip is active", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Grocery", onClear: vi.fn() }}
      />,
    );
    // No SVG with Lucide Search icon (the icon is wrapped in no-chip condition)
    // The chip replaces the search icon — look for the chip text instead
    expect(screen.getByText("Grocery")).toBeDefined();
    // And the search icon should NOT be in DOM (it's inside the !filterChip branch)
    const searchIcons = container.querySelectorAll("svg");
    // Only the X icon should be present (the × button)
    expect(searchIcons.length).toBe(1);
  });
});
