/**
 * The admin pages import the field comparison from venueFieldCompare.ts so the
 * browser never bundles the refresh pipeline and its node:crypto import (#722).
 * A later "just import it from diffEngine" would silently undo that, so pin it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("venueFieldCompare stays browser-safe", () => {
  it.each([
    "src/lib/venueFieldCompare.ts",
    "src/lib/adminProposals.ts",
    "src/lib/adminVenueEditSql.ts",
    "src/lib/sourceSwitch.ts",
  ])("%s imports neither node: modules nor scripts/refresh", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).not.toMatch(/from "(node:|[^"]*scripts\/refresh)/);
  });
});
