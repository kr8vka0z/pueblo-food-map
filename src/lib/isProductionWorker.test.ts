/**
 * Unit tests for isProductionWorker (#591) — a separate new file rather than
 * an addition to publishVenues.test.ts, since the write-guard on fix/*
 * branches blocks edits to existing test files.
 */

import { describe, expect, test } from "vitest";
import { isProductionWorker } from "@/lib/publishVenues";

describe("isProductionWorker", () => {
  test("true when BETTER_AUTH_RP_ID is absent (production has no staging var set)", () => {
    expect(isProductionWorker({ BETTER_AUTH_RP_ID: undefined })).toBe(true);
  });

  test("false when BETTER_AUTH_RP_ID is set (staging's env.staging.vars override)", () => {
    expect(isProductionWorker({ BETTER_AUTH_RP_ID: "dev.pueblofoodmap.com" })).toBe(false);
  });
});
