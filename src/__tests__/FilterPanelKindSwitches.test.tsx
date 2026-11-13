/**
 * #917: the Filters panel's kind-of-place rows are switches now (no tick
 * boxes). This drives the real panel wired to the real useMapFilters, so it
 * proves a switch changes the same filter state the old checkboxes did:
 * selectedCategories, the filtered list, and the per-kind count on the row.
 */

import { useEffect } from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterPanel from "@/components/FilterPanel";
import { useMapFilters } from "@/lib/useMapFilters";
import { venues as allVenues } from "@/data/venues";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const PUEBLO_CENTER = { lat: 38.2667, lng: -104.6167 };
type Filters = ReturnType<typeof useMapFilters>;
let latest: Filters;
const report = (f: Filters) => {
  latest = f;
};

function Harness() {
  const f = useMapFilters(PUEBLO_CENTER);
  useEffect(() => report(f));
  return (
    <FilterPanel
      open
      onClose={() => {}}
      locale="en"
      resultCount={f.filteredVenues.length}
      filterOpenNow={f.filterOpenNow}
      onToggleOpenNow={() => f.setFilterOpenNow((v) => !v)}
      filterSnap={f.filterSnap}
      onToggleSnap={() => f.setFilterSnap((v) => !v)}
      filterWic={f.filterWic}
      onToggleWic={() => f.setFilterWic((v) => !v)}
      selectedCategories={f.selectedCategories}
      onToggleCategory={f.toggleCategory}
      categoryCounts={f.categoryCounts}
      onClearAll={f.clearFilters}
    />
  );
}

describe("Filters kind-of-place switches drive the real filter state", () => {
  test("turning two kinds on and one off filters the map like the old checkboxes", () => {
    render(<Harness />);
    const pantry = () => screen.getByRole("switch", { name: "Food Pantry" });
    const grocery = () => screen.getByRole("switch", { name: "Grocery / Supermarket" });

    fireEvent.click(pantry());
    expect(pantry()).toHaveAttribute("aria-checked", "true");
    expect(latest.selectedCategories).toEqual(new Set(["pantry"]));
    expect(latest.filteredVenues.length).toBeGreaterThan(0);
    expect(latest.filteredVenues.every((v) => v.category === "pantry")).toBe(true);

    fireEvent.click(grocery());
    expect(latest.selectedCategories).toEqual(new Set(["pantry", "grocery"]));
    expect(new Set(latest.filteredVenues.map((v) => v.category))).toEqual(new Set(["pantry", "grocery"]));

    fireEvent.click(pantry());
    expect(pantry()).toHaveAttribute("aria-checked", "false");
    expect(latest.selectedCategories).toEqual(new Set(["grocery"]));

    fireEvent.click(grocery());
    expect(latest.selectedCategories).toBeNull();
    expect(latest.filteredVenues.length).toBe(allVenues.length);
  });

  test("each row's count is the number of places of that kind", () => {
    render(<Harness />);
    const pantries = allVenues.filter((v) => v.category === "pantry").length;
    const row = screen.getByRole("switch", { name: "Food Pantry" }).parentElement!;
    expect(row.textContent).toContain(String(pantries));
  });
});
