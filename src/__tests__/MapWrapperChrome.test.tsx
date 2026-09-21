/**
 * MapWrapper chrome layout tests — issues #97, #96, #99, #109
 *
 * #97: Wordmark is in the top-left cluster. EN/ES toggle was here but moved
 *      to the hamburger menu in #109 — top-left cluster now holds only the Wordmark.
 * #109: EN/ES toggle is in the hamburger menu (covered in HamburgerMenu.test.tsx).
 *
 * The old #95 CategoryDropdown + SearchBar filterChip coverage that used to
 * live here was replaced by #513 (Filters button + FilterPanel) —
 * see FilterPanel.test.tsx and SearchBarViewSwitch.test.tsx's
 * "filtersButton" describe block.
 *
 * These tests mount only the sub-components in isolation (no full MapWrapper,
 * which requires Mapbox WebGL).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import Wordmark from "@/components/Wordmark";
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

// SearchBar's filterChip prop was removed (#513) — replaced by filtersButton,
// covered in SearchBarViewSwitch.test.tsx.
