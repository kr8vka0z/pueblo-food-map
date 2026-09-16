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

  // docs/bottom-nav-spec.md §4.2: the menu button that forced the mobile-only
  // right-12 inset is gone, so the switch sits at one inset and the input
  // reserves one measured width at every breakpoint. jsdom has no layout, so
  // the class contract is what's assertable — the pixel proof is the browser
  // measurement recorded in SearchBar.tsx's own comment.
  test("the view switch sits flush in the pill with one reserved width at every width", () => {
    const { container } = render(
      <SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "map", onChange: vi.fn() }} />,
    );
    expect(container.querySelector(".right-12")).toBeNull();
    // Flush with the pill (Kyle, 2026-09-16): 1px in, full height, no inset.
    expect(container.querySelector(".right-px.top-px.bottom-px")).not.toBeNull();
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("pr-[161px]");
    expect(inputClass).not.toMatch(/md:pr-/);
  });

  // §4.3: with a chip showing, under 400px the switch goes icon-only and the
  // input's reservation drops to match; without a chip neither happens.
  test("chip present: labels collapse under 400px and the reservation shrinks with them", () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={vi.fn()}
        filterChip={{ label: "Food Pantry", onClear: vi.fn() }}
        viewSwitch={{ mode: "map", onChange: vi.fn() }}
      />,
    );
    const inputClass = container.querySelector("input[type='search']")?.className ?? "";
    expect(inputClass).toContain("max-[400px]:pr-[93px]");
    const labels = Array.from(container.querySelectorAll("[role=group] span"));
    expect(labels).toHaveLength(2);
    labels.forEach((span) => expect(span.className).toContain("max-[400px]:sr-only"));
  });

  test("no chip: labels never collapse", () => {
    const { container } = render(
      <SearchBar value="" onChange={vi.fn()} viewSwitch={{ mode: "map", onChange: vi.fn() }} />,
    );
    expect(container.querySelector("input[type='search']")?.className).not.toContain("max-[400px]");
    container
      .querySelectorAll("[role=group] span")
      .forEach((span) => expect(span.className).not.toContain("sr-only"));
  });
});
