/**
 * Guided tour (#159) — pure pieces: the step state machine and the tooltip
 * placement math. No DOM needed. (Copy wording is deliberately untested.)
 */
import { describe, test, expect } from "vitest";
import {
  TOUR_STEPS,
  tourReducer,
  placeTooltip,
  type Rect,
} from "@/lib/guidedTour";

const VP = { width: 360, height: 740 };
const TIP = { width: 336, height: 190 };

function overlaps(a: Rect, b: Rect) {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}
function inside(a: Rect, vp: { width: number; height: number }) {
  return a.left >= 0 && a.top >= 0 && a.left + a.width <= vp.width && a.top + a.height <= vp.height;
}

describe("tourReducer — step state machine", () => {
  const last = TOUR_STEPS.length - 1;

  test("next advances one step", () => {
    expect(tourReducer(0, "next")).toBe(1);
  });

  test("next on the last step finishes the tour (null)", () => {
    expect(tourReducer(last, "next")).toBeNull();
  });

  test("back steps back and stops at the first step", () => {
    expect(tourReducer(3, "back")).toBe(2);
    expect(tourReducer(0, "back")).toBe(0);
  });

  test("close ends the tour from any step", () => {
    expect(tourReducer(0, "close")).toBeNull();
    expect(tourReducer(last, "close")).toBeNull();
  });

  test("a closed tour stays closed", () => {
    expect(tourReducer(null, "next")).toBeNull();
    expect(tourReducer(null, "back")).toBeNull();
  });
});

describe("placeTooltip — never covers its target, never runs off screen", () => {
  test("no target: centered", () => {
    const p = placeTooltip(null, TIP, VP);
    expect(p.left).toBe(12);
    expect(p.top).toBe(Math.round((740 - 190) / 2));
  });

  test("target near the top (search bar): goes below it", () => {
    const target = { top: 10, left: 10, width: 340, height: 56 };
    const p = placeTooltip(target, TIP, VP);
    const tip = { ...p, ...TIP };
    expect(p.placement).toBe("below");
    expect(overlaps(tip, target)).toBe(false);
    expect(inside(tip, VP)).toBe(true);
  });

  test("target near the bottom (bottom nav item): goes above it", () => {
    const target = { top: 660, left: 20, width: 70, height: 72 };
    const p = placeTooltip(target, TIP, VP);
    const tip = { ...p, ...TIP };
    expect(p.placement).toBe("above");
    expect(overlaps(tip, target)).toBe(false);
    expect(inside(tip, VP)).toBe(true);
  });

  test("target at the right edge: tooltip is clamped inside the viewport", () => {
    const target = { top: 10, left: 300, width: 56, height: 56 };
    const tip = { ...placeTooltip(target, TIP, VP), ...TIP };
    expect(inside(tip, VP)).toBe(true);
    expect(overlaps(tip, target)).toBe(false);
  });

  test("tall target with no room above or below: goes beside it on a wide screen", () => {
    const vp = { width: 1280, height: 800 };
    const target = { top: 100, left: 400, width: 380, height: 640 };
    const tip = { ...placeTooltip(target, TIP, vp), ...TIP };
    expect(overlaps(tip, target)).toBe(false);
    expect(inside(tip, vp)).toBe(true);
  });

  test("no room anywhere: stays on screen (overlap unavoidable)", () => {
    const target = { top: 50, left: 0, width: 360, height: 650 };
    const tip = { ...placeTooltip(target, TIP, VP), ...TIP };
    expect(inside(tip, VP)).toBe(true);
  });
});
