/**
 * Unit tests for ingestTarget (see src/lib/ingestTarget.ts for the WHY) —
 * the path-rewrite half of the /ingest proxy that custom-worker.ts can't be
 * unit-tested for directly.
 */
import { describe, test, expect } from "vitest";
import { ingestTarget } from "@/lib/ingestTarget";

describe("ingestTarget", () => {
  test("/ingest/static/* forwards to the PostHog assets host", () => {
    expect(ingestTarget("/ingest/static/array.js")).toBe(
      "https://us-assets.i.posthog.com/static/array.js",
    );
  });

  test("/ingest/* (not /static/) forwards to the main PostHog host", () => {
    expect(ingestTarget("/ingest/e/")).toBe("https://us.i.posthog.com/e/");
    expect(ingestTarget("/ingest/decide/")).toBe("https://us.i.posthog.com/decide/");
  });

  test("bare /ingest (no trailing path) forwards to the main host root", () => {
    expect(ingestTarget("/ingest")).toBe("https://us.i.posthog.com/");
    expect(ingestTarget("/ingest/")).toBe("https://us.i.posthog.com/");
  });

  test("a path outside /ingest is not a proxy target", () => {
    expect(ingestTarget("/venues")).toBeNull();
    expect(ingestTarget("/ingesttypo/e/")).toBeNull();
  });
});
