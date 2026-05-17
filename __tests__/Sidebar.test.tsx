/**
 * Sidebar.test.tsx — v1 Sidebar component has been removed in PR 2 (v2 map shell rebuild).
 *
 * The v2 layout no longer has a sidebar or category rail. The venue list is
 * handled by BottomSheet on mobile; a floating window (PR 5) on desktop.
 *
 * This file is kept as a placeholder so the test runner doesn't orphan-warn.
 * Replace with SearchBar / LocateButton / useGeolocation tests in a follow-up PR.
 */

import { describe, test } from "vitest";

describe("Sidebar (v1 — removed in v2)", () => {
  test.skip("v1 Sidebar removed — venue list is BottomSheet (mobile) or FloatingWindow (desktop) in v2", () => {
    // no-op
  });
});
