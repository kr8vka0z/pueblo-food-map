// fieldLabel never shows a person a raw database key (#926): a known field
// gets its plain name, an unknown one a readable fallback.
import { describe, expect, test } from "vitest";
import { fieldLabel } from "@/lib/fieldLabels";

describe("fieldLabel", () => {
  test.each([
    ["accepts_wic", "Accepts WIC"],
    ["last_verified", "Last verified"],
    ["published_at", "Published at"],
  ])("%s reads as %s", (field, label) => {
    expect(fieldLabel(field)).toBe(label);
  });
});
