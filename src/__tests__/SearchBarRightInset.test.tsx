/**
 * SearchBar — rightInset prop (#682). Shifts the bar left, clear of the
 * desktop side panel, by shrinking the centering container's content box on
 * the right (paddingRight) rather than moving the bar itself, so `flex
 * justify-center` still does the actual centering math.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchBar from "@/components/SearchBar";

function renderBar(rightInset?: number) {
  render(
    <SearchBar
      value=""
      onChange={() => {}}
      rightInset={rightInset}
    />,
  );
  // The combobox input's closest absolute-positioned ancestor is the padded container.
  return screen.getByRole("searchbox").closest('[style*="padding-right"]');
}

describe("SearchBar rightInset (#682)", () => {
  test("default (no rightInset prop): padding-right is 0", () => {
    const container = renderBar();
    expect(container?.getAttribute("style")).toContain("padding-right: 0px");
  });

  test("rightInset sets padding-right to the given px value", () => {
    const container = renderBar(404);
    expect(container?.getAttribute("style")).toContain("padding-right: 404px");
  });
});
