/**
 * next.config.ts regression tests — issue #164 config-hardening quick win (S7a).
 *
 * WHY: `poweredByHeader: false` is a one-line config flag with no other code
 * path exercising it — nothing else in the test suite would fail red if it
 * were accidentally removed. This pins it down as a plain object-property
 * assertion (no server needed; NextConfig is a plain importable object).
 */

import { describe, test, expect } from "vitest";
import nextConfig from "../../next.config";

describe("next.config", () => {
  test("poweredByHeader is disabled (hides the X-Powered-By: Next.js header)", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

// Blessing Boxes slice 1: the one real box converted from a plain pantry
// (216 W Routt) must keep its old /venue/<id> URL working via a permanent
// redirect to /box/<id> — that route is dynamicParams=false, so a redirect
// living inside the page component would run too late (see next.config.ts's
// own header comment for why this has to be a plain path redirects() entry,
// not the `has`-query kind that broke production on 2026-06-20).
describe("next.config redirects — Blessing Boxes Routt box", () => {
  test("the converted Routt venue URL permanently redirects to /box/<id>", async () => {
    expect(nextConfig.redirects).toBeDefined();
    const redirects = await nextConfig.redirects!();
    const entry = redirects.find(
      (r) => r.source === "/venue/plentiful-blessing-box-216-w-routt-plentiful-1454",
    );
    expect(entry).toBeDefined();
    expect(entry?.destination).toBe("/box/plentiful-blessing-box-216-w-routt-plentiful-1454");
    expect(entry?.permanent).toBe(true);
  });
});
