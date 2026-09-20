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
  // #539: the count pill now sits BESIDE the icon instead of overlapping it,
  // so the control's real width grows when a filter is on. Issue #539's
  // Plan: "reserve the input's right padding for the widest state (count
  // present) so typed text never reflows when a filter is toggled" — so the
  // reservation must already be big enough for the count-present state even
  // when rendered here with count: 0 (the reservation is a fixed constant,
  // not conditional on the current count).
  test("reserves left padding for the magnifier and right padding for the widest (count-present) Filters state when present", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("pl-9");
    expect(inputClass).not.toContain("pl-11");
    // Widest-state reservation is wider than the old fixed-badge-overlap
    // value (pr-11 = 44px) now that the count pill grows the control.
    expect(inputClass).toMatch(/pr-\[\d+px\]/);
    const match = inputClass.match(/pr-\[(\d+)px\]/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(44);
  });

  // Same reservation whether or not a filter is actually on right now — it's
  // sized for the widest state up front so toggling a filter never reflows
  // the typed text (the whole point of reserving for the widest state).
  test("the reservation does not change when a filter is actually on", () => {
    const { container: off } = render(
      <SearchBar value="" onChange={vi.fn()} filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }} />,
    );
    const { container: on } = render(
      <SearchBar value="" onChange={vi.fn()} filtersButton={{ count: 2, onClick: vi.fn(), ariaLabel: "Filters, 2 on" }} />,
    );
    const offClass = off.querySelector("input[type='search']")?.className ?? "";
    const onClass = on.querySelector("input[type='search']")?.className ?? "";
    expect(offClass).toBe(onClass);
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

  // #539, Kyle's mockup C: "put the icon for the filters just into the
  // search bar instead of it appearing like a different button" — no
  // circle, no border, no separate-button look. Supersedes #532's
  // invisible-44px-hitbox-around-a-32px-circle pattern: the <button> itself
  // is now the only box, and its own padding (10px + 20px icon + 14px, per
  // the approved mockup's `.c-filter`) already totals 44px with no count —
  // more once the count pill adds its own width — so it clears the 44px
  // minimum in every state without a separate invisible hit area.
  test("the control is icon-only — no background, no border, no separate visible circle (#539)", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    const button = screen.getByRole("button", { name: "Filters" });
    expect(button.className).not.toMatch(/\bborder(?!-0)/);
    expect(button.className).not.toMatch(/\bbg-\[/);
    expect(button.className).not.toContain("rounded-full");
    // No inner circle span wrapping the icon — only the hairline-divider
    // span (aria-hidden, no size classes) is a direct child now.
    expect(button.querySelector("span.w-8")).toBeNull();
  });

  test("the control's own box is at least 44px tall, and at least 44px wide even with no count on", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    const button = screen.getByRole("button", { name: "Filters" });
    expect(button.className).toContain("h-11");
    // 10px left pad + 20px icon + 14px right pad = 44px with no count pill
    // (matches the approved mockup's `.c-filter` padding/icon geometry).
    expect(button.className).toContain("pl-2.5");
    expect(button.className).toContain("pr-3.5");
  });

  // A hairline divider separates the control from the input without making
  // it look like its own button — issue #539: "1px, `--color-bone-200`,
  // inset ~12px top and bottom."
  test("a hairline divider (bone-200) sits on the control's left, inset from top/bottom", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    const button = screen.getByRole("button", { name: "Filters" });
    const divider = button.querySelector('span[aria-hidden]:not(:has(*))');
    expect(divider?.className).toContain("bg-[var(--color-bone-200)]");
    expect(divider?.className).toContain("top-[12px]");
    expect(divider?.className).toContain("bottom-[12px]");
  });

  test("the icon turns sage-600 when a filter is on, ink-500 at rest", () => {
    const { rerender } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 0, onClick: vi.fn(), ariaLabel: "Filters" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Filters" }).className).toContain(
      "text-[var(--color-ink-500)]",
    );
    rerender(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 2, onClick: vi.fn(), ariaLabel: "Filters, 2 on" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Filters, 2 on" }).className).toContain(
      "text-[var(--color-sage-600)]",
    );
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

  // #539: the old badge hung `-top-1 -left-1` OVER the icon (absolute,
  // negative-inset). The mockup C design puts it BESIDE the icon in normal
  // flow instead, so nothing overlaps.
  test("the count pill sits beside the icon in normal flow, not absolutely positioned over it", () => {
    render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filtersButton={{ count: 2, onClick: vi.fn(), ariaLabel: "Filters, 2 on" }}
      />,
    );
    const badge = screen.getByText("2");
    expect(badge.className).not.toContain("absolute");
    expect(badge.className).not.toMatch(/-top-|-left-|-right-|-bottom-/);
    expect(badge.className).toContain("min-w-[19px]");
    expect(badge.className).toContain("h-[19px]");
  });
});
