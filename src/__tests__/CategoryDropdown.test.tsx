/**
 * CategoryDropdown tests — issue #126 "Open now" toggle row.
 *
 * Coverage:
 *   1. "Open now" option renders with the correct count.
 *   2. Clicking the "Open now" option calls onToggleOpenNow.
 *   3. When openNowActive=true, the option has aria-selected="true".
 *   4. When openNowActive=false, the option has aria-selected="false".
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryDropdown from "@/components/CategoryDropdown";
import type { VenueCategory } from "@/types/venue";

// Minimal counts fixture — only one category needed for the test surface
const counts: Partial<Record<VenueCategory, number>> = { pantry: 5 };

describe("CategoryDropdown — Open now toggle", () => {
  test("renders 'Open now' option with count", () => {
    render(
      <CategoryDropdown
        counts={counts}
        activeCategory={null}
        onSelect={vi.fn()}
        openNowActive={false}
        openNowCount={12}
        onToggleOpenNow={vi.fn()}
        locale="en"
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    expect(option).toBeTruthy();
    // Count "12" should appear somewhere in the option text
    expect(option.textContent).toContain("12");
  });

  test("clicking Open now option calls onToggleOpenNow", () => {
    const onToggleOpenNow = vi.fn();
    render(
      <CategoryDropdown
        counts={counts}
        activeCategory={null}
        onSelect={vi.fn()}
        openNowActive={false}
        openNowCount={12}
        onToggleOpenNow={onToggleOpenNow}
        locale="en"
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    fireEvent.click(option);
    expect(onToggleOpenNow).toHaveBeenCalledTimes(1);
  });

  test("option has aria-selected='true' when openNowActive=true", () => {
    render(
      <CategoryDropdown
        counts={counts}
        activeCategory={null}
        onSelect={vi.fn()}
        openNowActive={true}
        openNowCount={12}
        onToggleOpenNow={vi.fn()}
        locale="en"
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  test("option has aria-selected='false' when openNowActive=false", () => {
    render(
      <CategoryDropdown
        counts={counts}
        activeCategory={null}
        onSelect={vi.fn()}
        openNowActive={false}
        openNowCount={12}
        onToggleOpenNow={vi.fn()}
        locale="en"
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    expect(option).toHaveAttribute("aria-selected", "false");
  });
});
