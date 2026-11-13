/**
 * #917 round 3 (Kyle: the end items' hover fill "doesn't fully cover the bar
 * and looks bad"): the fill must be concentric with the round bar, the same
 * 4px in from its edge on every side, while each item keeps the bar's full
 * height as its tap area. jsdom has no layout, so this pins the three classes
 * that together make the inset even: the bar's 4px side padding, the fill's
 * 4px top and bottom inset, and the fill drawn on ::before (not the item).
 */

import { describe, test, expect } from "vitest";
import { ITEM_CLASS, NAV_CLASS } from "@/components/bottomNavShared";

const cls = (s: string) => s.split(/\s+/);

describe("bottom bar hover fill", () => {
  test("the fill is a ::before inset 4px top and bottom, and the bar pads 4px at the sides", () => {
    expect(cls(ITEM_CLASS)).toEqual(
      expect.arrayContaining(["h-full", "before:inset-y-1", "before:inset-x-0", "before:rounded-full", "hover:before:bg-[var(--color-sage-100)]"]),
    );
    expect(cls(NAV_CLASS)).toEqual(expect.arrayContaining(["px-1", "rounded-[var(--radius-full)]"]));
    // No full-height fill on the item itself, which met the bar's top and bottom edges.
    expect(cls(ITEM_CLASS)).not.toContain("hover:bg-[var(--color-sage-100)]");
  });

  test("a Boxes item that is on still gets no hover fill", () => {
    expect(cls(ITEM_CLASS)).toContain("aria-pressed:hover:before:bg-transparent");
  });
});
