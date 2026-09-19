/**
 * SearchBar tests (#513/#514).
 *
 * Originally covered the `viewSwitch` prop (#191) — an inline ViewToggle at
 * the pill's right end. #514 removed that prop and the ViewToggle component
 * entirely: the bar now ends in plain typing room, and Map/List switching
 * goes through the search bar's own suggestion popups (ViewSuggestion /
 * SearchResultsPopover's "See all N matches" row — see their own test files)
 * or a Menu line (HamburgerMenu.test.tsx), never a standing control in the
 * bar. What's left here is `filtersButton` (#513) coverage plus a regression
 * guard that the bar's right end stays empty.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar";

describe("SearchBar — right end of the pill (#514: the view switch that used to live here is gone)", () => {
  test("renders no group/toggle control on the right, filtersButton or not", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Map$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^List$/i })).toBeNull();
  });

  test("the input reserves no right-side padding for a switch", () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} />);
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("pr-4");
    expect(inputClass).not.toMatch(/pr-\[\d+px\]/);
  });
});

// filterChip was removed (#513): the chosen-category tag left the search bar
// entirely (also resolves #507's chip/placeholder overlap — there's no chip
// left to overlap anything).
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
});
