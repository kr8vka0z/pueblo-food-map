// @vitest-environment node
/**
 * sheetSnapPoints (#882): the collapsed / fully-open snap points vaul gets.
 * The base offset is what makes the visible height come out right, so a wrong
 * one would put every card's resting edge in the wrong place.
 */

import { describe, expect, test } from "vitest";
import { sheetSnapPoints } from "@/lib/sheetSnap";

// innerHeight 740, sheet 640 tall (100px map peek): base offset 100.
const M = { innerHeight: 740, drawerHeight: 640 };

describe("sheetSnapPoints", () => {
  test.each([
    ["short card: fully open stops at the content's own height", { firstView: 300, content: 480 }, ["400px", "580px"]],
    ["tall card: fully open is the whole sheet", { firstView: 300, content: 1200 }, ["400px", 1]],
    ["first view taller than the sheet is capped at the content", { firstView: 900, content: 1200 }, [1]],
    ["no detail section: one resting height", { firstView: null, content: 480 }, ["580px"]],
    ["nothing measured yet (jsdom): finite, one point", { firstView: null, content: 0, drawerHeight: 0 }, [1]],
  ])("%s", (_name, over, points) => {
    expect(sheetSnapPoints({ ...M, ...over }).points).toEqual(points);
  });
});
