/**
 * CategoryDropdown tests — issue #126 "Open now" toggle row,
 * issue #127 "Accepts SNAP" and "Accepts WIC" toggle rows.
 *
 * Coverage:
 *   1. "Open now" option renders with the correct count.
 *   2. Clicking the "Open now" option calls onToggleOpenNow.
 *   3. When openNowActive=true, the option has aria-selected="true".
 *   4. When openNowActive=false, the option has aria-selected="false".
 *   5. "Accepts SNAP" option renders with the correct count.
 *   6. Clicking the "Accepts SNAP" option calls onToggleSnap.
 *   7. When snapActive=true, the option has aria-selected="true".
 *   8. When snapActive=false, the option has aria-selected="false".
 *   9. "Accepts WIC" option renders with the correct count.
 *  10. Clicking the "Accepts WIC" option calls onToggleWic.
 *  11. When wicActive=true, the option has aria-selected="true".
 *  12. When wicActive=false, the option has aria-selected="false".
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryDropdown from "@/components/CategoryDropdown";
import type { VenueCategory } from "@/types/venue";

// Minimal counts fixture — only one category needed for the test surface
const counts: Partial<Record<VenueCategory, number>> = { pantry: 5 };

// Shared base props that satisfy all required fields
const baseProps = {
  counts,
  activeCategory: null as VenueCategory | null,
  onSelect: vi.fn(),
  openNowActive: false,
  onToggleOpenNow: vi.fn(),
  snapActive: false,
  onToggleSnap: vi.fn(),
  wicActive: false,
  onToggleWic: vi.fn(),
  locale: "en" as const,
};

describe("CategoryDropdown — Open now toggle", () => {
  test("renders 'Open now' option with count", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        openNowCount={12}
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
        {...baseProps}
        openNowCount={12}
        onToggleOpenNow={onToggleOpenNow}
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    fireEvent.click(option);
    expect(onToggleOpenNow).toHaveBeenCalledTimes(1);
  });

  test("option has aria-selected='true' when openNowActive=true", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        openNowActive={true}
        openNowCount={12}
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  test("option has aria-selected='false' when openNowActive=false", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        openNowActive={false}
        openNowCount={12}
      />,
    );

    const option = screen.getByRole("option", { name: /Open now/i });
    expect(option).toHaveAttribute("aria-selected", "false");
  });
});

describe("CategoryDropdown — Accepts SNAP toggle", () => {
  test("renders 'Accepts SNAP' option with count", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        snapCount={49}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts SNAP/i });
    expect(option).toBeTruthy();
    expect(option.textContent).toContain("49");
  });

  test("clicking Accepts SNAP option calls onToggleSnap", () => {
    const onToggleSnap = vi.fn();
    render(
      <CategoryDropdown
        {...baseProps}
        snapCount={49}
        onToggleSnap={onToggleSnap}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts SNAP/i });
    fireEvent.click(option);
    expect(onToggleSnap).toHaveBeenCalledTimes(1);
  });

  test("option has aria-selected='true' when snapActive=true", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        snapActive={true}
        snapCount={49}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts SNAP/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  test("option has aria-selected='false' when snapActive=false", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        snapActive={false}
        snapCount={49}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts SNAP/i });
    expect(option).toHaveAttribute("aria-selected", "false");
  });
});

describe("CategoryDropdown — Accepts WIC toggle", () => {
  test("renders 'Accepts WIC' option with count", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        wicCount={8}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts WIC/i });
    expect(option).toBeTruthy();
    expect(option.textContent).toContain("8");
  });

  test("clicking Accepts WIC option calls onToggleWic", () => {
    const onToggleWic = vi.fn();
    render(
      <CategoryDropdown
        {...baseProps}
        wicCount={8}
        onToggleWic={onToggleWic}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts WIC/i });
    fireEvent.click(option);
    expect(onToggleWic).toHaveBeenCalledTimes(1);
  });

  test("option has aria-selected='true' when wicActive=true", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        wicActive={true}
        wicCount={8}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts WIC/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  test("option has aria-selected='false' when wicActive=false", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        wicActive={false}
        wicCount={8}
      />,
    );

    const option = screen.getByRole("option", { name: /Accepts WIC/i });
    expect(option).toHaveAttribute("aria-selected", "false");
  });
});

describe("CategoryDropdown — Favorites toggle", () => {
  test("renders 'Favorites' option with count when favoritesCount > 0", () => {
    const onToggleFavorites = vi.fn();
    render(
      <CategoryDropdown
        {...baseProps}
        favoritesCount={3}
        favoritesActive={false}
        onToggleFavorites={onToggleFavorites}
      />,
    );

    const option = screen.getByRole("option", { name: /^Favorites/i });
    expect(option).toBeTruthy();
    expect(option.textContent).toContain("3");
  });

  test("clicking Favorites option calls onToggleFavorites once", () => {
    const onToggleFavorites = vi.fn();
    render(
      <CategoryDropdown
        {...baseProps}
        favoritesCount={3}
        favoritesActive={false}
        onToggleFavorites={onToggleFavorites}
      />,
    );

    const option = screen.getByRole("option", { name: /^Favorites/i });
    fireEvent.click(option);
    expect(onToggleFavorites).toHaveBeenCalledTimes(1);
  });

  test("option has aria-selected='true' when favoritesActive=true", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        favoritesCount={3}
        favoritesActive={true}
        onToggleFavorites={vi.fn()}
      />,
    );

    const option = screen.getByRole("option", { name: /^Favorites/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  test("Favorites row does NOT render when favoritesCount=0", () => {
    render(
      <CategoryDropdown
        {...baseProps}
        favoritesCount={0}
        favoritesActive={false}
        onToggleFavorites={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^Favorites/i)).toBeNull();
  });

  test("Favorites row does NOT render when favoritesCount is omitted", () => {
    render(<CategoryDropdown {...baseProps} />);

    expect(screen.queryByText(/^Favorites/i)).toBeNull();
  });
});
