/**
 * SearchBar tests (#513/#514/#528/#529).
 *
 * Originally covered the `viewSwitch` prop (#191) — an inline ViewToggle at
 * the pill's right end. #514 removed that prop and the ViewToggle component
 * entirely: Map/List switching goes through the search bar's own suggestion
 * popups (ViewSuggestion / SearchResultsPopover's "See all N matches" row —
 * see their own test files) or a Menu line (HamburgerMenu.test.tsx), never a
 * standing control in the bar. #528 then gave the right end a NEW occupant —
 * the Filters button, moved there from the magnifier's old spot on the left
 * — so "the right end stays empty" now means "empty when there's no
 * filtersButton prop," not "always empty." What's left here is `filtersButton`
 * (#513/#528) coverage plus a regression guard on the no-filtersButton case.
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

// #528: Kyle found the Filters button on the LEFT half-covering the
// placeholder text on a phone ("earch" instead of "Search"). Moved to the
// right end (empty since #514 removed the view switch), padding reservation
// swapped to match, and the magnifier restored on the left unconditionally
// so the bar still reads as a search box.
describe("SearchBar — input padding swaps sides with the Filters button (#528)", () => {
  test("reserves left padding for the magnifier and right padding for the Filters button when present", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("pl-9");
    expect(inputClass).toContain("pr-11");
    expect(inputClass).not.toContain("pl-11");
  });

  test("reserves only the magnifier's left padding when filtersButton is absent", () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} />);
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("pl-9");
    expect(inputClass).toContain("pr-4");
  });
});

// filterChip was removed (#513): the chosen-category tag left the search bar
// entirely (also resolves #507's chip/placeholder overlap — there's no chip
// left to overlap anything).
describe("SearchBar — filtersButton (#513, right end of the bar as of #528)", () => {
  test("no filters button renders when filtersButton is not passed (plain search icon default)", () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /filters/i })).toBeNull();
  });

  test("the magnifier is always present, filtersButton or not (#528)", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    // lucide's Search icon renders as an <svg> with no accessible role of
    // its own (aria-hidden); assert by count instead of role.
    expect(container.querySelectorAll("svg.lucide-search").length).toBeGreaterThan(0);
  });

  test("renders a Filters button at the right end when filtersButton is passed", () => {
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

  // #529: the badge referenced --color-orange/--color-navy, neither of which
  // is defined in globals.css — it rendered as a blank pale dot, count and
  // orange background both invisible. Guards the fix (--color-brand-orange/
  // --color-brand-navy) directly, not just that a "2" is somewhere in the DOM.
  test("the count badge uses the real brand tokens, not the undefined --color-orange/--color-navy", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 2, onClick: vi.fn(), ariaLabel: "Filters, 2 on" }}
      />,
    );
    const badge = screen.getByText("2");
    expect(badge.className).toContain("bg-[var(--color-brand-orange)]");
    expect(badge.className).toContain("text-[var(--color-brand-navy)]");
    expect(badge.className).not.toContain("--color-orange)");
    expect(badge.className).not.toContain("--color-navy)");
  });
});
