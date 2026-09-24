/**
 * Regression guard for #588 slice 2 — DesktopVenueWindow must stay code-split.
 *
 * DesktopVenueWindow only ever renders when `!isMobile && viewMode === "map"
 * && selectedVenue` (MapWrapper.tsx), so on the mobile viewport this app
 * targets first that branch is never true — but a plain top-level `import
 * DesktopVenueWindow from "./DesktopVenueWindow"` still bundles its ~800
 * lines (DesktopVenueWindow.tsx + VenuePopupHeader.tsx) into every mobile
 * visitor's synchronous MapWrapper chunk, since Turbopack/webpack include a
 * statically-imported module in the parent's chunk graph regardless of
 * whether the JSX branch that renders it ever runs at runtime. Only
 * `next/dynamic()` gives the bundler a real chunk boundary to defer.
 *
 * jsdom/vitest can't observe actual webpack/Turbopack chunk boundaries (every
 * other MapWrapper test mocks next/dynamic to bypass real chunk resolution
 * entirely — see MapWrapperDeferredLoad.test.tsx's header), so this is a
 * lightweight source-level fitness check, not a runtime behavior test: it
 * fails loudly if MapWrapper.tsx regresses back to a static top-level import,
 * which the real before/after build measurement (PR body, #588) confirmed
 * pulls DesktopVenueWindow's own chunk out of the eagerly-fetched group.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(
  join(process.cwd(), "src/components/MapWrapper.tsx"),
  "utf8",
);

describe("MapWrapper — DesktopVenueWindow stays code-split (#588)", () => {
  test("is wired through next/dynamic(() => import(\"./DesktopVenueWindow\"))", () => {
    expect(SOURCE).toMatch(
      /dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/DesktopVenueWindow["']\)/,
    );
  });

  test("is NOT also a static top-level import (that would defeat the chunk split)", () => {
    expect(SOURCE).not.toMatch(
      /^import\s+DesktopVenueWindow\s+from\s+["']\.\/DesktopVenueWindow["']/m,
    );
  });
});
