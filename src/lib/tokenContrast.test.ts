/**
 * WCAG contrast regression guard for the ink/bone token pairs actually used
 * for small text (placeholders, section headers, footer links, metadata).
 *
 * WHY THIS EXISTS: `--color-ink-400` (#8A847A) shipped failing WCAG AA on
 * every bone background it's documented to sit on (measured 3.55/3.29/2.89
 * against bone-50/100/200, floor is 4.5). Nothing caught it — `design:drift`
 * (scripts/check-design-drift.mjs) only checks that globals.css and
 * DESIGN.md AGREE with each other, not that the agreed-upon value is
 * actually readable. This test computes real WCAG contrast ratios straight
 * from globals.css's live @theme block, so a future edit to any of these
 * tokens fails here immediately instead of shipping a silent accessibility
 * regression.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const CSS_PATH = resolve(__dirname, "../app/globals.css");

/** Extract `--name: #hex;` pairs out of the @theme block. Mirrors the
 * brace-matching approach in scripts/check-design-drift.mjs so both tools
 * read the same source the same way. */
function readThemeColors(): Map<string, string> {
  const css = readFileSync(CSS_PATH, "utf8");
  const themeIdx = css.indexOf("@theme");
  if (themeIdx === -1) throw new Error("No @theme block found in globals.css");
  const braceOpen = css.indexOf("{", themeIdx);
  let depth = 0;
  let themeEnd = -1;
  for (let i = braceOpen; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        themeEnd = i;
        break;
      }
    }
  }
  const block = css.slice(braceOpen + 1, themeEnd);

  const colors = new Map<string, string>();
  for (const m of block.matchAll(
    /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    colors.set(m[1], m[2]);
  }
  return colors;
}

/** WCAG 2.x relative luminance + contrast ratio. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const [lMax, lMin] = lA > lB ? [lA, lB] : [lB, lA];
  return (lMax + 0.05) / (lMin + 0.05);
}

const WCAG_AA_NORMAL_TEXT = 4.5;

describe("token contrast (WCAG AA)", () => {
  const colors = readThemeColors();

  const backgrounds = ["bone-50", "bone-100", "bone-200"] as const;
  const textTokens = ["ink-400", "ink-500", "ink-700"] as const;

  for (const textToken of textTokens) {
    for (const bg of backgrounds) {
      test(`${textToken} on ${bg} clears ${WCAG_AA_NORMAL_TEXT}:1`, () => {
        const textHex = colors.get(textToken);
        const bgHex = colors.get(bg);
        expect(textHex, `${textToken} missing from globals.css @theme`).toBeDefined();
        expect(bgHex, `${bg} missing from globals.css @theme`).toBeDefined();

        const ratio = contrastRatio(textHex as string, bgHex as string);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
      });
    }
  }
});
