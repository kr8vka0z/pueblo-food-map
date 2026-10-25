// The automatic switch (Venue Data Rebuild plan, "Decided: sources switch
// themselves on"): counting, reset, and what never counts.
import { describe, expect, test } from "vitest";
import {
  AUTO_SWITCH_ACTOR,
  computeSwitchStates,
  resetsForEdit,
  SWITCH_THRESHOLD,
  switchIsOn,
  type SwitchHistoryRow,
} from "@/lib/sourceSwitch";

let clock = 0;
function row(status: "approved" | "rejected", fields: string[], overrides: Partial<SwitchHistoryRow> = {}): SwitchHistoryRow {
  clock++;
  const at = new Date(Date.UTC(2026, 9, 1) + clock * 3_600_000).toISOString();
  return {
    source: "care_and_share",
    change_type: "update",
    proposed_diff: JSON.stringify({ before: {}, after: {}, fields_changed: [...fields, "last_verified"] }),
    status,
    reviewed_by: "kyle@example.com",
    reviewed_at: at,
    applied_at: status === "approved" ? at : null,
    ...overrides,
  };
}

const approvals = (n: number, field = "phone") => Array.from({ length: n }, () => row("approved", [field]));
const phone = (states: ReturnType<typeof computeSwitchStates>) => states.find((s) => s.field === "phone")!;

describe("computeSwitchStates", () => {
  test("threshold is 5", () => {
    expect(SWITCH_THRESHOLD).toBe(5);
  });

  test("4 approvals in a row: counting, still asks first", () => {
    expect(phone(computeSwitchStates(approvals(4), []))).toMatchObject({ streak: 4, on: false });
  });

  test("5 approvals in a row switch the pair on", () => {
    const states = computeSwitchStates(approvals(5), []);
    expect(phone(states)).toMatchObject({ streak: 5, on: true });
    expect(switchIsOn(states, "care_and_share", "phone")).toBe(true);
    expect(switchIsOn(states, "care_and_share", "address")).toBe(false);
  });

  test("a rejection resets the count", () => {
    const rows = [...approvals(4), row("rejected", ["phone"]), ...approvals(2)];
    expect(phone(computeSwitchStates(rows, []))).toMatchObject({ streak: 2, on: false });
  });

  test("a rejection after the switch is on turns it off", () => {
    const rows = [...approvals(6), row("rejected", ["phone"])];
    expect(phone(computeSwitchStates(rows, []))).toMatchObject({ streak: 0, on: false });
  });

  test("automatic rows never count and never break the run", () => {
    const rows = [
      ...approvals(3),
      row("approved", ["phone"], { reviewed_by: "refresh-pipeline", applied_at: null }),
      row("approved", ["phone"], { reviewed_by: AUTO_SWITCH_ACTOR }),
      row("approved", ["phone"], { reviewed_by: "refresh-pipeline-ai" }),
      ...approvals(1),
    ];
    expect(phone(computeSwitchStates(rows, []))).toMatchObject({ streak: 4 });
  });

  test("an approval that applied nothing does not count", () => {
    const rows = [...approvals(4), row("approved", ["phone"], { applied_at: null })];
    expect(phone(computeSwitchStates(rows, []))).toMatchObject({ streak: 4 });
  });

  test("an edit reset restarts the count after it", () => {
    const rows = approvals(5);
    const resetAt = rows[2].reviewed_at!; // reset lands with the 3rd approval
    const later = new Date(Date.parse(resetAt) + 1000).toISOString();
    expect(phone(computeSwitchStates(rows, [{ source: "care_and_share", field: "phone", reset_at: later }]))).toMatchObject({
      streak: 2,
      on: false,
    });
  });

  test("other sources and fields are counted separately", () => {
    const rows = [...approvals(5, "address"), row("rejected", ["phone"])];
    const states = computeSwitchStates(rows, []);
    expect(states.find((s) => s.field === "address")).toMatchObject({ streak: 5, on: true });
    expect(phone(states)).toMatchObject({ streak: 0, on: false });
  });

  test("adds and removes never count", () => {
    const rows = approvals(4).concat(row("approved", ["phone"], { change_type: "add" }), row("approved", [], { change_type: "remove" }));
    expect(phone(computeSwitchStates(rows, []))).toMatchObject({ streak: 4 });
  });
});

describe("resetsForEdit — an edit of a value the pair put there resets it", () => {
  const applied = [
    {
      source: "care_and_share",
      applied_at: "2026-10-20T00:00:00.000Z",
      proposed_diff: JSON.stringify({ before: { phone: null }, after: { phone: "719-555-0100" }, fields_changed: ["phone", "last_verified"] }),
    },
  ];

  test("editing the phone the pair set resets (care_and_share, phone)", () => {
    expect(resetsForEdit({ phone: "719-555-0100" }, { phone: "719-555-0200" }, applied)).toEqual([
      { source: "care_and_share", field: "phone" },
    ]);
  });

  test("editing a phone someone else has since changed does not reset", () => {
    expect(resetsForEdit({ phone: "719-555-0300" }, { phone: "719-555-0200" }, applied)).toEqual([]);
  });

  test("an edit that leaves the field alone does not reset", () => {
    expect(resetsForEdit({ phone: "719-555-0100" }, { phone: "719-555-0100" }, applied)).toEqual([]);
  });
});
