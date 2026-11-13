// @vitest-environment node
/**
 * sheetDetents / restingAt (native scroll sheet, #923): the resting heights
 * the track snaps to, and which one a settled scroll is at. A wrong detent
 * puts every card's resting edge in the wrong place; a wrong `restingAt`
 * closes a card the person only collapsed.
 */

import { describe, expect, test } from "vitest";
import { restingAt, sheetDetents } from "@/lib/sheetSnap";

const T = { trackHeight: 640 };

describe("sheetDetents", () => {
  test.each([
    ["short card: fully open stops at the content's own height", { firstView: 300, content: 480 }, [300, 480, false]],
    ["tall card: fully open is the whole track", { firstView: 300, content: 1200 }, [300, 640, false]],
    ["first view taller than the track: one height", { firstView: 900, content: 1200 }, [640, 640, true]],
    ["no detail section: one resting height", { firstView: null, content: 480 }, [480, 480, true]],
    ["under 24px apart counts as one height", { firstView: 470, content: 480 }, [480, 480, true]],
  ] as const)("%s", (_name, over, [collapsed, full, single]) => {
    expect(sheetDetents({ ...T, ...over })).toEqual({ collapsed, full, single, measured: true });
  });

  test("nothing laid out yet (jsdom) is not measured", () => {
    expect(sheetDetents({ trackHeight: 0, firstView: null, content: 0 }).measured).toBe(false);
  });
});

describe("restingAt", () => {
  const d = sheetDetents({ trackHeight: 640, firstView: 300, content: 1200 });
  test.each([
    [0, "closed"],
    [3, "closed"],
    [299.5, "collapsed"],
    [640, "full"],
    [639, "full"],
    // Scrolled into the details is still fully open, never "closed".
    [1100, "full"],
  ] as const)("scrollTop %s rests %s", (top, want) => {
    expect(restingAt(top, d)).toBe(want);
  });
});
