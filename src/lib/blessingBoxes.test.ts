/**
 * Tests for src/lib/blessingBoxes.ts (Blessing Boxes slice 1).
 *
 * Covers the pure mapping logic (mapRowToPublicBox/mapRowsToPublicBoxes),
 * the status placeholder, the isBlessingBox type guard, and — the one
 * privacy-load-bearing assertion in this file — that host_contact never
 * appears anywhere on the mapped public shape, even when the source row
 * carries one. D1-backed reads (loadLiveBoxes/loadLiveBoxById) are proved
 * against a fake D1Database, same convention as other lib tests in this
 * repo that avoid a real binding (see adminProposals.test.ts).
 */

import { describe, test, expect } from "vitest";
import {
  BOX_STATUS_PLACEHOLDER,
  isBlessingBox,
  mapRowToPublicBox,
  mapRowsToPublicBoxes,
  loadLiveBoxes,
  loadLiveBoxById,
  type BoxJoinRow,
} from "@/lib/blessingBoxes";

function makeRow(overrides: Partial<BoxJoinRow> = {}): BoxJoinRow {
  return {
    id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    name: "216 W Routt Blessing Box",
    lat: 38.25902,
    lng: -104.625612,
    address: "216 W Routt Ave, Pueblo, CO 81004",
    source: "directory.plentiful.org/colorado/pueblo",
    last_verified: "2026-09-15",
    host_name: "Jane Doe",
    host_note: "Stocked every Saturday.",
    most_needed: "Canned soup, pasta",
    installed_on: "2026-01-15",
    removed_on: null,
    ...overrides,
  };
}

describe("mapRowToPublicBox", () => {
  test("maps every public field, category is always the literal blessing_box", () => {
    const box = mapRowToPublicBox(makeRow());
    expect(box.id).toBe("plentiful-blessing-box-216-w-routt-plentiful-1454");
    expect(box.category).toBe("blessing_box");
    expect(box.lat).toBe(38.25902);
    expect(box.lng).toBe(-104.625612);
    expect(box.address).toBe("216 W Routt Ave, Pueblo, CO 81004");
    expect(box.box.hostName).toBe("Jane Doe");
    expect(box.box.hostNote).toBe("Stocked every Saturday.");
    expect(box.box.mostNeeded).toBe("Canned soup, pasta");
    expect(box.box.installedOn).toBe("2026-01-15");
    expect(box.box.removedOn).toBeNull();
  });

  test("status is always the slice-1 placeholder, never computed", () => {
    const box = mapRowToPublicBox(makeRow());
    expect(box.box.status).toBe(BOX_STATUS_PLACEHOLDER);
    expect(BOX_STATUS_PLACEHOLDER).toBe("unknown");
  });

  test("host_contact never appears on the mapped shape, even if a caller tried to smuggle it in via the row", () => {
    // BoxJoinRow's type has no host_contact field at all (by design — see
    // blessingBoxes.ts's own header) — cast through unknown to prove the
    // mapper still can't leak it even if a looser caller passed it anyway.
    const rowWithContact = { ...makeRow(), host_contact: "private@example.org" } as unknown as BoxJoinRow;
    const box = mapRowToPublicBox(rowWithContact);
    expect(JSON.stringify(box)).not.toContain("private@example.org");
    expect(JSON.stringify(box)).not.toContain("host_contact");
  });

  test("null optional fields map straight through", () => {
    const box = mapRowToPublicBox(
      makeRow({ host_name: null, host_note: null, most_needed: null, installed_on: null }),
    );
    expect(box.box.hostName).toBeNull();
    expect(box.box.hostNote).toBeNull();
    expect(box.box.mostNeeded).toBeNull();
    expect(box.box.installedOn).toBeNull();
  });
});

describe("mapRowsToPublicBoxes", () => {
  test("maps a list in order, empty list -> empty list", () => {
    const rows = [makeRow({ id: "a" }), makeRow({ id: "b" })];
    const boxes = mapRowsToPublicBoxes(rows);
    expect(boxes.map((b) => b.id)).toEqual(["a", "b"]);
    expect(mapRowsToPublicBoxes([])).toEqual([]);
  });
});

describe("isBlessingBox", () => {
  test("true only for the literal blessing_box category", () => {
    expect(isBlessingBox("blessing_box")).toBe(true);
    expect(isBlessingBox("pantry")).toBe(false);
    expect(isBlessingBox("garden")).toBe(false);
  });
});

// ─── D1 reads (fake D1Database) ─────────────────────────────────────────────

function makeFakeDb(rows: BoxJoinRow[], byId: Record<string, BoxJoinRow | null> = {}) {
  const prepare = (sql: string) => ({
    all: async <T,>() => ({ results: rows as unknown as T[] }),
    bind: (...args: unknown[]) => ({
      first: async <T,>() => (byId[args[0] as string] ?? null) as unknown as T | null,
    }),
    sql,
  });
  return { prepare } as unknown as D1Database;
}

describe("loadLiveBoxes / loadLiveBoxById", () => {
  test("loadLiveBoxes maps every row from db.all()", async () => {
    const db = makeFakeDb([makeRow({ id: "a" }), makeRow({ id: "b" })]);
    const boxes = await loadLiveBoxes(db);
    expect(boxes).toHaveLength(2);
    expect(boxes.map((b) => b.id)).toEqual(["a", "b"]);
  });

  test("loadLiveBoxes with no results -> empty array, not a throw", async () => {
    const db = makeFakeDb([]);
    expect(await loadLiveBoxes(db)).toEqual([]);
  });

  test("loadLiveBoxById returns the mapped box for a known id", async () => {
    const row = makeRow({ id: "known" });
    const db = makeFakeDb([], { known: row });
    const box = await loadLiveBoxById(db, "known");
    expect(box?.id).toBe("known");
  });

  test("loadLiveBoxById returns null for an unknown id", async () => {
    const db = makeFakeDb([], {});
    expect(await loadLiveBoxById(db, "unknown")).toBeNull();
  });
});
