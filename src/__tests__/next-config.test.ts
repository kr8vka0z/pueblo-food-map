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
