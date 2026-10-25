// Review-card hours rendering: monthly hours (hours_irregular) showed as
// "[object Object]" and pipeline proposals carry hours as JSON text, so both
// shapes must read as plain schedule prose.
import { describe, expect, test } from "vitest";
import { formatFieldValue } from "@/components/ProposalCard";

const lastWed = [{ recurrence: "monthly_ordinal", ordinal: "last", weekday: "wed", slots: ["1:00 PM - 3:00 PM"] }];

describe("formatFieldValue — hours", () => {
  test("monthly hours as an array read as prose, never [object Object]", () => {
    expect(formatFieldValue("hours_irregular", lastWed)).toBe("Last Wed of each month, 1pm – 3pm");
  });

  test("monthly hours as the pipeline's JSON text read the same", () => {
    expect(formatFieldValue("hours_irregular", JSON.stringify(lastWed))).toBe("Last Wed of each month, 1pm – 3pm");
  });

  test("weekly hours as JSON text get the per-day summary", () => {
    expect(formatFieldValue("hours_weekly", JSON.stringify({ mon: ["10:00-12:00"] }))).toBe("Mon: 10am – 12pm");
  });
});
