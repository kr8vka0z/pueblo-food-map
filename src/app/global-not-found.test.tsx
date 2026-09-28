import { describe, test, expect } from "vitest";
import { metadata, viewport } from "@/app/global-not-found";
import { ROOT_METADATA, ROOT_VIEWPORT } from "@/lib/site";

// global-not-found has no parent layout, so anything it doesn't set itself is
// missing from an unmatched URL's <head> (#689 PR 1). Pin the inheritance.
describe("global-not-found (#689)", () => {
  test("spells out the branded title (no layout template to append it)", () => {
    expect(metadata.title).toBe("Page Not Found · Pueblo Food Map");
  });

  test("carries the root layout's description, OG and twitter metadata", () => {
    expect(metadata.description).toBe(ROOT_METADATA.description);
    expect(metadata.openGraph).toEqual(ROOT_METADATA.openGraph);
    expect(metadata.twitter).toEqual(ROOT_METADATA.twitter);
    expect(viewport).toBe(ROOT_VIEWPORT);
  });
});
