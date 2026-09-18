/**
 * Tests for src/lib/blessingBoxes.ts (Blessing Boxes slice 1, extended in
 * slice 2).
 *
 * Covers the pure mapping logic (mapRowToPublicBox/mapRowsToPublicBoxes),
 * the isBlessingBox type guard, and — the one privacy-load-bearing
 * assertion in this file — that host_contact never appears anywhere on the
 * mapped public shape, even when the source row carries one. D1-backed
 * reads (loadLiveBoxes/loadLiveBoxById) are proved against a fake
 * D1Database, same convention as other lib tests in this repo that avoid a
 * real binding (see adminProposals.test.ts).
 *
 * Slice 2 additions: computeBoxStatus (the state-diagram rule, every
 * branch), computeLastFilledAt (no 7-day window), and the mapping/loader
 * tests updated to exercise real check-in-derived status instead of the
 * old always-"unknown" placeholder.
 */

import { describe, test, expect } from "vitest";
import {
  BOX_STATUS_PLACEHOLDER,
  isBlessingBox,
  computeBoxStatus,
  computeLastFilledAt,
  mapRowToPublicBox,
  mapRowsToPublicBoxes,
  loadLiveBoxes,
  loadLiveBoxById,
  loadVisibleCheckins,
  loadVisibleCheckinsForVenues,
  type BoxJoinRow,
  type CheckinStatusInput,
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

  test("status is 'unknown' when no check-ins are passed (slice 2: no signal -> BOX_STATUS_PLACEHOLDER's value)", () => {
    const box = mapRowToPublicBox(makeRow());
    expect(box.box.status).toBe(BOX_STATUS_PLACEHOLDER);
    expect(BOX_STATUS_PLACEHOLDER).toBe("unknown");
    expect(box.box.lastFilledAt).toBeNull();
    expect(box.box.recentCheckins).toEqual([]);
  });

  test("status/lastFilledAt/recentCheckins are computed from the check-ins passed in", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const checkins: CheckinStatusInput[] = [
      { kind: "filled", visibility: "visible", created_at: "2026-09-17T09:00:00.000Z" },
      { kind: "took", visibility: "visible", created_at: "2026-09-17T10:00:00.000Z" },
    ];
    const box = mapRowToPublicBox(makeRow(), checkins, now);
    expect(box.box.status).toBe("stocked");
    expect(box.box.lastFilledAt).toBe("2026-09-17T09:00:00.000Z");
    expect(box.box.recentCheckins).toEqual([
      { kind: "took", createdAt: "2026-09-17T10:00:00.000Z" },
      { kind: "filled", createdAt: "2026-09-17T09:00:00.000Z" },
    ]);
  });

  test("a non-null removed_on drives status to out_of_service regardless of check-ins", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const checkins: CheckinStatusInput[] = [
      { kind: "filled", visibility: "visible", created_at: "2026-09-17T09:00:00.000Z" },
    ];
    const box = mapRowToPublicBox(makeRow({ removed_on: "2026-09-10" }), checkins, now);
    expect(box.box.status).toBe("out_of_service");
  });

  test("recentCheckins never includes a 'problem' check-in", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const checkins: CheckinStatusInput[] = [
      { kind: "problem", visibility: "visible", created_at: "2026-09-17T09:00:00.000Z" },
      { kind: "took", visibility: "visible", created_at: "2026-09-17T08:00:00.000Z" },
    ];
    const box = mapRowToPublicBox(makeRow(), checkins, now);
    expect(box.box.recentCheckins.map((c) => c.kind)).toEqual(["took"]);
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

  // ─── Slice 5 (photos) ─────────────────────────────────────────────────────

  test("latestPhoto defaults to null when no photo is passed", () => {
    const box = mapRowToPublicBox(makeRow());
    expect(box.box.latestPhoto).toBeNull();
  });

  test("latestPhoto is passed straight through when provided", () => {
    const box = mapRowToPublicBox(makeRow(), [], new Date(), { id: 42, createdAt: "2026-09-18T10:00:00.000Z" });
    expect(box.box.latestPhoto).toEqual({ id: 42, createdAt: "2026-09-18T10:00:00.000Z" });
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

// ─── computeBoxStatus / computeLastFilledAt (slice 2) ───────────────────────
// Every branch of the state diagram (Blessing Boxes - 2 Box Status.html),
// proved directly against the pure function — this is the "one testable
// function" the slice's acceptance criteria call for.

const NOW = new Date("2026-09-17T12:00:00.000Z");

function ci(overrides: Partial<CheckinStatusInput> = {}): CheckinStatusInput {
  return { kind: "filled", visibility: "visible", created_at: "2026-09-17T09:00:00.000Z", ...overrides };
}

describe("computeBoxStatus", () => {
  test("no check-ins at all -> unknown", () => {
    expect(computeBoxStatus([], NOW, false)).toBe("unknown");
  });

  test("latest visible check-in is 'filled' -> stocked", () => {
    expect(computeBoxStatus([ci({ kind: "filled" })], NOW, false)).toBe("stocked");
  });

  test("latest visible check-in is 'low' -> low", () => {
    expect(computeBoxStatus([ci({ kind: "low" })], NOW, false)).toBe("low");
  });

  test("latest visible check-in is 'empty' -> empty", () => {
    expect(computeBoxStatus([ci({ kind: "empty" })], NOW, false)).toBe("empty");
  });

  test("'took' never sets a status — no other signal present -> unknown", () => {
    expect(computeBoxStatus([ci({ kind: "took" })], NOW, false)).toBe("unknown");
  });

  test("'problem' never sets a status — no other signal present -> unknown", () => {
    expect(computeBoxStatus([ci({ kind: "problem" })], NOW, false)).toBe("unknown");
  });

  test("a later 'took' does not override an earlier 'filled' — status stays stocked", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-17T08:00:00.000Z" }),
      ci({ kind: "took", created_at: "2026-09-17T11:00:00.000Z" }),
    ];
    expect(computeBoxStatus(checkins, NOW, false)).toBe("stocked");
  });

  test("picks the MOST RECENT status-setting check-in, not the first in the array", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-15T08:00:00.000Z" }),
      ci({ kind: "empty", created_at: "2026-09-17T08:00:00.000Z" }),
    ];
    expect(computeBoxStatus(checkins, NOW, false)).toBe("empty");
  });

  test("'filled' always wins from any active status — moves back to stocked even after empty", () => {
    const checkins = [
      ci({ kind: "empty", created_at: "2026-09-15T08:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-17T08:00:00.000Z" }),
    ];
    expect(computeBoxStatus(checkins, NOW, false)).toBe("stocked");
  });

  test("a hidden check-in never counts, even if it's the newest", () => {
    const checkins = [
      ci({ kind: "filled", visibility: "visible", created_at: "2026-09-16T08:00:00.000Z" }),
      ci({ kind: "empty", visibility: "hidden", created_at: "2026-09-17T08:00:00.000Z" }),
    ];
    expect(computeBoxStatus(checkins, NOW, false)).toBe("stocked");
  });

  test("a status-setting check-in exactly at the 7-day boundary still counts", () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeBoxStatus([ci({ kind: "filled", created_at: sevenDaysAgo })], NOW, false)).toBe("stocked");
  });

  test("a status-setting check-in older than 7 days fades to unknown", () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeBoxStatus([ci({ kind: "filled", created_at: eightDaysAgo })], NOW, false)).toBe("unknown");
  });

  test("outOfService=true wins over any check-in, however recent", () => {
    const checkins = [ci({ kind: "filled", created_at: "2026-09-17T11:59:00.000Z" })];
    expect(computeBoxStatus(checkins, NOW, true)).toBe("out_of_service");
  });

  test("outOfService=true with zero check-ins is still out_of_service, not unknown", () => {
    expect(computeBoxStatus([], NOW, true)).toBe("out_of_service");
  });
});

describe("computeLastFilledAt", () => {
  test("no check-ins -> null", () => {
    expect(computeLastFilledAt([])).toBeNull();
  });

  test("no 'filled' check-in among other kinds -> null", () => {
    expect(computeLastFilledAt([ci({ kind: "took" }), ci({ kind: "low" })])).toBeNull();
  });

  test("returns the most recent visible 'filled' timestamp", () => {
    const checkins = [
      ci({ kind: "filled", created_at: "2026-09-01T08:00:00.000Z" }),
      ci({ kind: "filled", created_at: "2026-09-15T08:00:00.000Z" }),
    ];
    expect(computeLastFilledAt(checkins)).toBe("2026-09-15T08:00:00.000Z");
  });

  test("survives with NO 7-day window — an old fill still reports its real date", () => {
    const checkins = [ci({ kind: "filled", created_at: "2026-01-01T00:00:00.000Z" })];
    expect(computeLastFilledAt(checkins)).toBe("2026-01-01T00:00:00.000Z");
  });

  test("a hidden 'filled' check-in never counts", () => {
    const checkins = [ci({ kind: "filled", visibility: "hidden", created_at: "2026-09-15T08:00:00.000Z" })];
    expect(computeLastFilledAt(checkins)).toBeNull();
  });
});

// ─── D1 reads (fake D1Database) ─────────────────────────────────────────────

function makeFakeDb(
  rows: BoxJoinRow[],
  byId: Record<string, BoxJoinRow | null> = {},
  checkinsByVenue: Record<string, CheckinStatusInput[]> = {},
) {
  const prepare = (sql: string) => {
    if (sql.includes("FROM venues")) {
      return {
        all: async <T,>() => ({ results: rows as unknown as T[] }),
        bind: (...args: unknown[]) => ({
          first: async <T,>() => (byId[args[0] as string] ?? null) as unknown as T | null,
        }),
      };
    }
    // box_checkins reads — both the single-venue form (loadVisibleCheckins)
    // and the batched IN(...) form (loadVisibleCheckinsForVenues) bind one
    // id-per-arg, so one implementation serves both.
    return {
      bind: (...ids: unknown[]) => ({
        all: async <T,>() => ({
          results: (ids as string[]).flatMap((id) =>
            (checkinsByVenue[id] ?? []).map((c) => ({ venue_id: id, ...c })),
          ) as unknown as T[],
        }),
      }),
    };
  };
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

  test("loadLiveBoxes attaches each box's OWN check-ins, not another box's", async () => {
    const db = makeFakeDb(
      [makeRow({ id: "a" }), makeRow({ id: "b" })],
      {},
      { a: [ci({ kind: "filled" })], b: [ci({ kind: "empty" })] },
    );
    const boxes = await loadLiveBoxes(db, NOW);
    expect(boxes.find((b) => b.id === "a")?.box.status).toBe("stocked");
    expect(boxes.find((b) => b.id === "b")?.box.status).toBe("empty");
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

  test("loadLiveBoxById computes real status from that box's check-ins", async () => {
    const row = makeRow({ id: "known" });
    const db = makeFakeDb([], { known: row }, { known: [ci({ kind: "low" })] });
    const box = await loadLiveBoxById(db, "known", NOW);
    expect(box?.box.status).toBe("low");
  });

  // ─── Slice 5 (photos) — a real D1Database that discriminates the query
  // shape by SQL text, unlike makeFakeDb above (which only distinguishes
  // "FROM venues" from a shared checkins-shaped fallback). ──────────────────

  function makeFakeDbWithPhotos(row: BoxJoinRow, photoRows: { id: number; venue_id: string; created_at: string }[]) {
    const prepare = (sql: string) => {
      if (sql.includes("FROM venues")) {
        return { bind: () => ({ first: async () => row }) };
      }
      if (sql.includes("FROM box_photos")) {
        return { bind: (...ids: unknown[]) => ({ all: async () => ({ results: photoRows.filter((p) => (ids as string[]).includes(p.venue_id)) }) }) };
      }
      return { bind: () => ({ all: async () => ({ results: [] }) }) };
    };
    return { prepare } as unknown as D1Database;
  }

  test("loadLiveBoxById attaches the most recent approved photo", async () => {
    const row = makeRow({ id: "known" });
    const db = makeFakeDbWithPhotos(row, [{ id: 7, venue_id: "known", created_at: "2026-09-18T10:00:00.000Z" }]);
    const box = await loadLiveBoxById(db, "known");
    expect(box?.box.latestPhoto).toEqual({ id: 7, createdAt: "2026-09-18T10:00:00.000Z" });
  });

  test("loadLiveBoxById degrades latestPhoto to null (never throws) when the photos query fails — a photos-table outage must not take the box down", async () => {
    const row = makeRow({ id: "known" });
    const db = {
      prepare: (sql: string) => {
        if (sql.includes("FROM venues")) return { bind: () => ({ first: async () => row }) };
        if (sql.includes("FROM box_photos")) throw new Error("no such table: box_photos");
        return { bind: () => ({ all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    const box = await loadLiveBoxById(db, "known");
    expect(box?.id).toBe("known"); // the box itself still loads
    expect(box?.box.latestPhoto).toBeNull();
  });
});

describe("loadVisibleCheckins / loadVisibleCheckinsForVenues", () => {
  test("loadVisibleCheckins returns [] with no rows, not a throw", async () => {
    const db = makeFakeDb([], {}, {});
    expect(await loadVisibleCheckins(db, "a")).toEqual([]);
  });

  test("loadVisibleCheckinsForVenues with an empty id list short-circuits to an empty map without querying", async () => {
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    const map = await loadVisibleCheckinsForVenues(db, []);
    expect(map.size).toBe(0);
  });

  test("loadVisibleCheckinsForVenues groups rows by venue_id", async () => {
    const db = makeFakeDb([], {}, { a: [ci({ kind: "filled" })], b: [ci({ kind: "took" })] });
    const map = await loadVisibleCheckinsForVenues(db, ["a", "b"]);
    expect(map.get("a")?.map((c) => c.kind)).toEqual(["filled"]);
    expect(map.get("b")?.map((c) => c.kind)).toEqual(["took"]);
  });
});
