/**
 * MapWrapper chrome tests — SearchBar's combobox wiring.
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
import SearchBar from "@/components/SearchBar";

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
