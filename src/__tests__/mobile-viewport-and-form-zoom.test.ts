/**
 * Regression checks for PR A of the mobile review
 * (pfm-mobile-review-2026-09-15.md, items 1 + 3):
 *
 *   1. layout.tsx's viewport export carries viewportFit: "cover" — required
 *      before any env(safe-area-inset-*) rule (item 2) does anything at all.
 *   2. No form-field input/select/textarea in src/components regresses back
 *      to a bare 14px text-sm — iOS Safari auto-zooms the page on focusing
 *      any field under 16px.
 *
 * Both read source as plain text rather than importing the modules: layout.tsx
 * is a Server Component that calls react-dom's preload() at module scope, and
 * pulling that (plus every downstream import) into a jsdom vitest run is far
 * more fragile than a small regex over the file the export actually lives in.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("mobile viewport + form field zoom", () => {
  test("layout.tsx's viewport export sets viewportFit to cover", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "app", "layout.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/export const viewport:\s*Viewport\s*=\s*\{/);
    // Pull just the object literal so a stray `viewportFit` mentioned in a
    // comment elsewhere in the file can't produce a false pass.
    const match = source.match(/export const viewport:\s*Viewport\s*=\s*\{([\s\S]*?)\};/);
    expect(match, "viewport export not found or not closed with `};`").not.toBeNull();
    expect(match![1]).toMatch(/viewportFit:\s*"cover"/);
  });

  test("no form-field element in src/components uses bare text-sm (iOS zooms fields under 16px)", () => {
    // Fingerprint, not a full JSX/class parser: every input/select/textarea
    // field class in this codebase is built as
    // `border(...) px-3 py-2 text-sm ...` (or `text-base md:text-sm` once
    // fixed) — labels/hints/errors never carry that px-3 py-2 padding, so
    // this substring reliably targets only actual field boxes, not prose.
    const componentsDir = join(process.cwd(), "src", "components");
    const offenders: string[] = [];
    for (const file of readdirSync(componentsDir)) {
      if (!file.endsWith(".tsx")) continue;
      const source = readFileSync(join(componentsDir, file), "utf-8");
      if (/px-3\s+py-2\s+text-sm\b/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
