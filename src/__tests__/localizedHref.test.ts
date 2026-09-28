import { describe, test, expect } from "vitest";
import { localizedHref, mirroredCounterpartHref } from "@/lib/localizedHref";

describe("localizedHref", () => {
  test("tree en: every path is returned unchanged", () => {
    expect(localizedHref("/", "en")).toBe("/");
    expect(localizedHref("/venues", "en")).toBe("/venues");
    expect(localizedHref("/venue/abc-123", "en")).toBe("/venue/abc-123");
    expect(localizedHref("/suggest", "en")).toBe("/suggest");
    expect(localizedHref("/#venue=abc-123", "en")).toBe("/#venue=abc-123");
  });

  describe("tree es", () => {
    test("mirrored static paths get the /es prefix", () => {
      expect(localizedHref("/", "es")).toBe("/es");
      expect(localizedHref("/venues", "es")).toBe("/es/venues");
      expect(localizedHref("/resources", "es")).toBe("/es/resources");
      expect(localizedHref("/about", "es")).toBe("/es/about");
    });

    test("venue detail paths get the /es prefix", () => {
      expect(localizedHref("/venue/abc-123", "es")).toBe("/es/venue/abc-123");
    });

    test("the homepage hash link (View on the map) keeps its hash after /es", () => {
      expect(localizedHref("/#venue=abc-123", "es")).toBe("/es#venue=abc-123");
    });

    test("non-mirrored paths (no /es counterpart) are returned unchanged", () => {
      expect(localizedHref("/suggest", "es")).toBe("/suggest");
      expect(localizedHref("/feedback", "es")).toBe("/feedback");
      expect(localizedHref("/privacy", "es")).toBe("/privacy");
      expect(localizedHref("/boxes/activity", "es")).toBe("/boxes/activity");
    });

    // Review fix: PageNav's off-map nav targets (Near me, Boxes, a saved
    // place) are query strings on the root path with NO hash at all —
    // splitting on "#" alone left these unrewritten.
    test("query strings on the root path get the /es prefix", () => {
      expect(localizedHref("/?near=1", "es")).toBe("/es?near=1");
      expect(localizedHref("/?boxes=1", "es")).toBe("/es?boxes=1");
      expect(localizedHref("/?venue=abc-123", "es")).toBe("/es?venue=abc-123");
    });

    test("query strings on a non-root mirrored path also get the /es prefix", () => {
      expect(localizedHref("/venues?category=pantry", "es")).toBe("/es/venues?category=pantry");
    });

    test("a query string AND a hash together are both preserved, in order", () => {
      expect(localizedHref("/?foo=1#bar", "es")).toBe("/es?foo=1#bar");
    });
  });
});

describe("mirroredCounterpartHref", () => {
  test("EN mirrored page -> its /es counterpart", () => {
    expect(mirroredCounterpartHref("/", "en")).toBe("/es");
    expect(mirroredCounterpartHref("/venues", "en")).toBe("/es/venues");
    expect(mirroredCounterpartHref("/about", "en")).toBe("/es/about");
    expect(mirroredCounterpartHref("/resources", "en")).toBe("/es/resources");
    expect(mirroredCounterpartHref("/venue/abc-123", "en")).toBe("/es/venue/abc-123");
  });

  test("ES mirrored page -> its EN counterpart", () => {
    expect(mirroredCounterpartHref("/es", "es")).toBe("/");
    expect(mirroredCounterpartHref("/es/venues", "es")).toBe("/venues");
    expect(mirroredCounterpartHref("/es/about", "es")).toBe("/about");
    expect(mirroredCounterpartHref("/es/resources", "es")).toBe("/resources");
    expect(mirroredCounterpartHref("/es/venue/abc-123", "es")).toBe("/venue/abc-123");
  });

  test("non-mirrored pages return null on either tree", () => {
    expect(mirroredCounterpartHref("/suggest", "en")).toBeNull();
    expect(mirroredCounterpartHref("/privacy", "en")).toBeNull();
    expect(mirroredCounterpartHref("/boxes/activity", "en")).toBeNull();
  });
});
