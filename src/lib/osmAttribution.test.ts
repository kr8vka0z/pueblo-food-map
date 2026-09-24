/**
 * Unit tests for isOsmSourced() (#133 4.5 — ODbL attribution).
 */

import { describe, test, expect } from "vitest";
import { isOsmSourced } from "@/lib/osmAttribution";

describe("isOsmSourced", () => {
  test("true for a real OSM way source string", () => {
    expect(isOsmSourced("OpenStreetMap (way/549826775)")).toBe(true);
  });

  test("true for a real OSM node source string", () => {
    expect(isOsmSourced("OpenStreetMap (node/4041375052)")).toBe(true);
  });

  test("false for a Pueblo Food Project source", () => {
    expect(isOsmSourced("pueblofoodproject.org/cgsp")).toBe(false);
  });

  test("false for a Plentiful source", () => {
    expect(isOsmSourced("directory.plentiful.org/colorado/pueblo")).toBe(false);
  });

  test("false for an empty string", () => {
    expect(isOsmSourced("")).toBe(false);
  });
});
