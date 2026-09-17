/**
 * Pure-function tests for src/lib/boxEvents.ts (Blessing Boxes slice 3).
 * Route-level tests (src/app/api/admin/venues/route.test.ts and
 * src/app/api/admin/venues/[id]/route.test.ts) already prove these are
 * called with the right statement wiring — this file proves the diff logic
 * itself against plain fixtures, no D1/route needed.
 */

import { describe, expect, test } from "vitest";
import { boxEventsForCreate, computeBoxEventWrites, type ExistingBoxEventContext } from "@/lib/boxEvents";

const baseExisting: ExistingBoxEventContext = {
  category: "blessing_box",
  name: "Same Name",
  address: "Same Address",
  removedOn: null,
};

describe("boxEventsForCreate", () => {
  test("a blessing_box create -> exactly one 'added' event, detail null", () => {
    expect(boxEventsForCreate({ name: "New Box", address: "1 Main St", box: { removedOn: null } })).toEqual([
      { kind: "added", detail: null },
    ]);
  });

  test("a non-box create -> no events", () => {
    expect(boxEventsForCreate({ name: "New Pantry", address: "1 Main St", box: null })).toEqual([]);
  });
});

describe("computeBoxEventWrites", () => {
  test("no name/address/removed_on change on an existing box -> no events", () => {
    const events = computeBoxEventWrites(baseExisting, {
      name: "Same Name",
      address: "Same Address",
      box: { removedOn: null },
    });
    expect(events).toEqual([]);
  });

  test("name change only -> one 'renamed' event with an 'old -> new' detail", () => {
    const events = computeBoxEventWrites(baseExisting, {
      name: "New Name",
      address: "Same Address",
      box: { removedOn: null },
    });
    expect(events).toEqual([{ kind: "renamed", detail: "Same Name → New Name" }]);
  });

  test("address change only -> one 'moved' event with an 'old -> new' detail", () => {
    const events = computeBoxEventWrites(baseExisting, {
      name: "Same Name",
      address: "New Address",
      box: { removedOn: null },
    });
    expect(events).toEqual([{ kind: "moved", detail: "Same Address → New Address" }]);
  });

  test("name AND address both change -> two events, renamed then moved", () => {
    const events = computeBoxEventWrites(baseExisting, {
      name: "New Name",
      address: "New Address",
      box: { removedOn: null },
    });
    expect(events).toEqual([
      { kind: "renamed", detail: "Same Name → New Name" },
      { kind: "moved", detail: "Same Address → New Address" },
    ]);
  });

  test("removed_on null -> set -> one 'removed' event, detail is the new date", () => {
    const events = computeBoxEventWrites(baseExisting, {
      name: "Same Name",
      address: "Same Address",
      box: { removedOn: "2026-09-20" },
    });
    expect(events).toEqual([{ kind: "removed", detail: "2026-09-20" }]);
  });

  test("removed_on already set, still set (unchanged) -> no 'removed' event", () => {
    const existing = { ...baseExisting, removedOn: "2026-08-01" };
    const events = computeBoxEventWrites(existing, {
      name: "Same Name",
      address: "Same Address",
      box: { removedOn: "2026-08-01" },
    });
    expect(events).toEqual([]);
  });

  test("removed_on set -> cleared (box back in service) -> no event kind exists for this, writes nothing", () => {
    const existing = { ...baseExisting, removedOn: "2026-08-01" };
    const events = computeBoxEventWrites(existing, {
      name: "Same Name",
      address: "Same Address",
      box: { removedOn: null },
    });
    expect(events).toEqual([]);
  });

  test("empty-string removed_on is treated the same as null (not 'removed')", () => {
    const events = computeBoxEventWrites(baseExisting, {
      name: "Same Name",
      address: "Same Address",
      box: { removedOn: "" },
    });
    expect(events).toEqual([]);
  });

  test("becoming a box for the first time (wasBox=false, isBox=true) -> exactly one 'added' event, no rename/move noise even though name/address differ from the pre-edit plain-venue row", () => {
    const existing: ExistingBoxEventContext = { category: "pantry", name: "Old Pantry Name", address: "Old Pantry Address", removedOn: null };
    const events = computeBoxEventWrites(existing, {
      name: "New Box Name",
      address: "New Box Address",
      box: { removedOn: null },
    });
    expect(events).toEqual([{ kind: "added", detail: null }]);
  });

  test("leaving box-hood (wasBox=true, isBox=false) -> no events (archiving-equivalent — see this module's header)", () => {
    const events = computeBoxEventWrites(baseExisting, { name: "New Name", address: "New Address", box: null });
    expect(events).toEqual([]);
  });

  test("never a box, still not a box -> no events", () => {
    const existing: ExistingBoxEventContext = { category: "pantry", name: "Old Name", address: "Old Address", removedOn: null };
    const events = computeBoxEventWrites(existing, { name: "New Name", address: "New Address", box: null });
    expect(events).toEqual([]);
  });
});
