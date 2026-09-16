/**
 * SearchBar inline Map/List view switch tests (#191).
 *
 * Unit-level coverage for the `viewSwitch` prop SearchBar.tsx added: renders
 * (or doesn't) the ViewToggle at the pill's right end, tracks aria-pressed,
 * fires onChange, and shrinks the filterChip's max-w when both the chip and
 * the switch are present at once (the collision the issue called out).
 * MapWrapperViewSwitch.test.tsx covers the same feature wired through the
 * real MapWrapper (both view states, query/filter preservation, sync with
 * the HamburgerMenu instance).
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar";

describe("SearchBar — viewSwitch absent (default)", () => {
  test("renders no view-switch group when viewSwitch is not passed", () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("group", { name: /choose map or list view/i })).toBeNull();
  });
});

describe("SearchBar — viewSwitch present", () => {
  test("renders a Map/List group inside the search bar", () => {
    render(
      <SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "map", onChange: vi.fn() }} />,
    );
    expect(screen.getByRole("group", { name: /choose map or list view/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Map$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^List$/i })).toBeDefined();
  });

  test("aria-pressed tracks mode=map", () => {
    render(
      <SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "map", onChange: vi.fn() }} />,
    );
    expect(screen.getByRole("button", { name: /^Map$/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /^List$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("aria-pressed tracks mode=list", () => {
    render(
      <SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "list", onChange: vi.fn() }} />,
    );
    expect(screen.getByRole("button", { name: /^List$/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /^Map$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("clicking List calls viewSwitch.onChange('list')", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "map", onChange }} />);
    await user.click(screen.getByRole("button", { name: /^List$/i }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  test("clicking Map calls viewSwitch.onChange('map')", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "list", onChange }} />);
    await user.click(screen.getByRole("button", { name: /^Map$/i }));
    expect(onChange).toHaveBeenCalledWith("map");
  });

  test("renders Mapa/Lista labels when viewSwitch.locale is es", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        viewSwitch={{ mode: "map", onChange: vi.fn(), locale: "es" }}
      />,
    );
    expect(screen.getByRole("button", { name: /^Mapa$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Lista$/i })).toBeDefined();
  });
});

describe("SearchBar — viewSwitch + filterChip collision (#191)", () => {
  test("filterChip max-w shrinks to 26% when viewSwitch is also present", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Food Pantry", onClear: vi.fn() }}
        viewSwitch={{ mode: "map", onChange: vi.fn() }}
      />,
    );
    const chip = container.querySelector(".max-w-\\[26\\%\\]");
    expect(chip).not.toBeNull();
    expect(container.querySelector(".max-w-\\[40\\%\\]")).toBeNull();
  });

  test("filterChip max-w stays 40% when viewSwitch is absent", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Food Pantry", onClear: vi.fn() }}
      />,
    );
    expect(container.querySelector(".max-w-\\[40\\%\\]")).not.toBeNull();
  });

  test("both the chip and the view switch render at once, without one replacing the other", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Food Pantry", onClear: vi.fn() }}
        viewSwitch={{ mode: "map", onChange: vi.fn() }}
      />,
    );
    expect(screen.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByRole("group", { name: /choose map or list view/i })).toBeDefined();
  });

  // Regression guard for the menu-button collision measured on dev at 375px:
  // at right-1 the whole List button rendered underneath the hamburger menu
  // button (which is flush to the pill's right edge under md: and sits in a
  // higher stacking layer), so tapping List opened the menu. jsdom has no
  // layout, so the class contract is the only thing assertable here — the
  // pixel proof lives in the browser measurement recorded in SearchBar.tsx's
  // own comment.
  test("the view switch is inset past the mobile menu button, not flush to the pill edge", () => {
    const { container } = render(
      <SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "map", onChange: vi.fn() }} />,
    );
    const wrapper = container.querySelector(".right-12");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain("md:right-1.5");
    expect(container.querySelector("input[type='search']")?.className).toContain("pr-[168px]");
  });
});
