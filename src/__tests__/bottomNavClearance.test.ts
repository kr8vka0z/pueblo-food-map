/**
 * bottomNavClearance.test.ts — guards the `--bottom-nav-clearance` CSS
 * custom property (globals.css `:root`) against drifting from
 * BOTTOM_NAV_HEIGHT_PX (BottomNav.tsx). Review cleanup item: PageNav.tsx,
 * ListView.tsx, and globals.css's Mapbox-credits offset all used to
 * hard-code 76px directly instead of referencing one source. Plain CSS can't
 * import a TS export, so the two numbers are two separate literals with no
 * shared source — this test is what keeps them from silently diverging if
 * BOTTOM_NAV_HEIGHT_PX (the nav's real, measured height) ever changes.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOTTOM_NAV_HEIGHT_PX } from "@/components/BottomNav";

describe("--bottom-nav-clearance mirrors BOTTOM_NAV_HEIGHT_PX", () => {
  test("globals.css's :root value equals the BottomNav.tsx constant", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");
    const match = css.match(/--bottom-nav-clearance:\s*(\d+)px;/);
    expect(match, "expected --bottom-nav-clearance to be declared in globals.css").not.toBeNull();
    expect(Number(match![1])).toBe(BOTTOM_NAV_HEIGHT_PX);
  });
});
