/**
 * Guided tour (#159) — pure pieces: the step state machine, the tooltip
 * placement math, and the EN/ES copy table. No DOM needed.
 */
import { describe, test, expect } from "vitest";
import {
  TOUR_STEPS,
  TOUR_COPY,
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

describe("TOUR_STEPS — mapped to today's real controls", () => {
  test("covers the eight things the tour explains, in order", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "welcome", "search", "filters", "pin", "card", "nearMe", "saved", "menu",
    ]);
  });

  test("only the card step opens a venue card", () => {
    expect(TOUR_STEPS.filter((s) => s.showsCard).map((s) => s.id)).toEqual(["card"]);
  });
});

describe("TOUR_COPY — EN + ES", () => {
  test("every step has a non-empty title and body in both languages", () => {
    for (const step of TOUR_STEPS) {
      for (const locale of ["en", "es"] as const) {
        expect(TOUR_COPY[locale].steps[step.id].title.trim()).not.toBe("");
        expect(TOUR_COPY[locale].steps[step.id].body.trim()).not.toBe("");
      }
    }
  });

  test("Spanish copy differs from English (not an untranslated copy)", () => {
    for (const step of TOUR_STEPS) {
      expect(TOUR_COPY.es.steps[step.id].body).not.toBe(TOUR_COPY.en.steps[step.id].body);
    }
    expect(TOUR_COPY.es.next).not.toBe(TOUR_COPY.en.next);
  });

  test("step counter fills both placeholders", () => {
    expect(TOUR_COPY.en.counter(2, 8)).toBe("Step 2 of 8");
    expect(TOUR_COPY.es.counter(2, 8)).toBe("Paso 2 de 8");
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
