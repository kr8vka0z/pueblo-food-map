/**
 * SearchBar inline Map/List view switch tests (#191).
 *
 * Unit-level coverage for the `viewSwitch` prop SearchBar.tsx added: renders
 * (or doesn't) the ViewToggle at the pill's right end, tracks aria-pressed,
 * fires onChange. Also covers `filtersButton` (#513), which replaced the
 * magnifier icon AND the old `filterChip` — the button and the view switch
 * sit at opposite ends of the bar and never collide the way filterChip once
 * did with the view switch's reserved right-side padding.
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

// filterChip was removed (#513): the chosen-category tag left the search bar
// entirely (also resolves #507's chip/placeholder overlap — there's no chip
// left to overlap anything). Its right-side viewSwitch reservation is
// unaffected, since filtersButton lives on the left and never shares space
// with the right-anchored ViewToggle.
describe("SearchBar — filtersButton (#513, replaces the magnifier + filterChip)", () => {
  test("no filters button renders when filtersButton is not passed (plain search icon default)", () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /filters/i })).toBeNull();
  });

  test("renders a Filters button in the magnifier's spot when filtersButton is passed", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Filters" })).toBeDefined();
  });

  test("clicking the Filters button fires onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick, ariaLabel: "Filters" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("no count badge when count is 0", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    expect(screen.queryByText("0")).toBeNull();
  });

  test("shows the count badge when count > 0, and the caller-built aria-label carries the spoken count", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 2, onClick: vi.fn(), ariaLabel: "Filters, 2 on" }}
      />,
    );
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByRole("button", { name: "Filters, 2 on" })).toBeDefined();
  });

  test("both the Filters button and the view switch render at once (opposite ends of the bar)", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 1, onClick: vi.fn(), ariaLabel: "Filters, 1 on" }}
        viewSwitch={{ mode: "map", onChange: vi.fn() }}
      />,
    );
    expect(screen.getByRole("button", { name: "Filters, 1 on" })).toBeDefined();
    expect(screen.getByRole("group", { name: /choose map or list view/i })).toBeDefined();
  });

  // docs/bottom-nav-spec.md §4.2: the view switch's own reservation is
  // unrelated to the left-side filters button — unlike the old filterChip,
  // filtersButton never changes the right-side pr-* reservation.
  test("the view switch sits flush in the pill with one reserved width, filtersButton or not", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
        viewSwitch={{ mode: "map", onChange: vi.fn() }}
      />,
    );
    expect(container.querySelector(".right-px.top-px.bottom-px")).not.toBeNull();
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("pr-[93px]");
    expect(inputClass).toContain("md:pr-[161px]");
  });
});
