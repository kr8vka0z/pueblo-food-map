/**
 * Tests for src/lib/boxAdopters.ts (Blessing Boxes slice 6) — the D1
 * shapes/SQL/helpers layer, proved against fake D1Database objects, same
 * convention boxPhotos.test.ts uses. sendResendEmail is mocked but
 * composeEmail runs for real (same split boxAlerts.test.ts uses), so
 * email-content tests below see the actual composed text.
 */

import { describe, expect, test, vi } from "vitest";

const mockSendResendEmail = vi.fn();
vi.mock("@/lib/emailSend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/emailSend")>("@/lib/emailSend");
  return { ...actual, sendResendEmail: (...args: unknown[]) => mockSendResendEmail(...args) };
});

import {
  countPendingAdopters,
  insertAdopterApplication,
  isAdopterConfirmTokenValid,
  loadAdopterByConfirmToken,
  loadAdopterById,
  loadApprovedAdopterNamesForVenues,
  loadApprovedAdopters,
  loadPendingAdopters,
  sendAdopterConfirmEmail,
} from "@/lib/boxAdopters";

describe("loadPendingAdopters / loadApprovedAdopters", () => {
  test("loadPendingAdopters returns [] with no rows", async () => {
    const db = { prepare: () => ({ all: async () => ({ results: [] }) }) } as unknown as D1Database;
    expect(await loadPendingAdopters(db)).toEqual([]);
  });

  test("loadPendingAdopters queries status = 'pending', joined to the venue name", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadPendingAdopters(db);
    expect(seenSql).toContain("status = 'pending'");
    expect(seenSql).toContain("venue_name");
  });

  test("loadApprovedAdopters queries status = 'approved'", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { all: async () => ({ results: [] }) };
      },
    } as unknown as D1Database;
    await loadApprovedAdopters(db);
    expect(seenSql).toContain("status = 'approved'");
  });
});

describe("countPendingAdopters", () => {
  test("returns 0 when the count row is missing", async () => {
    const db = { prepare: () => ({ first: async () => null }) } as unknown as D1Database;
    expect(await countPendingAdopters(db)).toBe(0);
  });

  test("returns the row's count", async () => {
    const db = { prepare: () => ({ first: async () => ({ n: 2 }) }) } as unknown as D1Database;
    expect(await countPendingAdopters(db)).toBe(2);
  });
});

describe("loadAdopterById / loadAdopterByConfirmToken", () => {
  test("loadAdopterById returns the row by id", async () => {
    const row = { id: 1, status: "pending" };
    const db = { prepare: () => ({ bind: () => ({ first: async () => row }) }) } as unknown as D1Database;
    expect(await loadAdopterById(db, 1)).toEqual(row);
  });

  test("loadAdopterByConfirmToken queries by confirm_token, not id", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ first: async () => null }) };
      },
    } as unknown as D1Database;
    await loadAdopterByConfirmToken(db, "abc");
    expect(seenSql).toContain("confirm_token = ?");
  });
});

describe("loadApprovedAdopterNamesForVenues", () => {
  test("empty id list short-circuits to an empty map without querying", async () => {
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    const map = await loadApprovedAdopterNamesForVenues(db, []);
    expect(map.size).toBe(0);
  });

  test("groups display names per venue, preserving row order (oldest first per the query's own ORDER BY)", async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: [
              { venue_id: "a", display_name: "The Nguyen Family" },
              { venue_id: "a", display_name: "Mesa Church" },
              { venue_id: "b", display_name: "Jane Doe" },
            ],
          }),
        }),
      }),
    } as unknown as D1Database;
    const map = await loadApprovedAdopterNamesForVenues(db, ["a", "b"]);
    expect(map.get("a")).toEqual(["The Nguyen Family", "Mesa Church"]);
    expect(map.get("b")).toEqual(["Jane Doe"]);
  });

  test("orders by created_at ASC (oldest first) — a public 'Cared for by' roster, not a most-recent callout", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    await loadApprovedAdopterNamesForVenues(db, ["a"]);
    expect(seenSql).toContain("ORDER BY created_at ASC");
  });

  test("the PUBLIC query never selects the private email column — structural, not just 'never mapped'", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    await loadApprovedAdopterNamesForVenues(db, ["a"]);
    expect(seenSql).not.toMatch(/\bemail\b/);
  });
});

describe("insertAdopterApplication", () => {
  test("returns the new row's id and a confirm token, both bound into the INSERT", async () => {
    let boundArgs: unknown[] = [];
    const db = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { run: async () => ({ meta: { last_row_id: 7 } }) };
        },
      }),
    } as unknown as D1Database;
    const result = await insertAdopterApplication(db, {
      venueId: "box-1",
      displayName: "Jane Doe",
      email: "jane@example.com",
      note: "We stock it every Sunday",
      lang: "es",
    });
    expect(result.id).toBe(7);
    expect(typeof result.confirmToken).toBe("string");
    expect(result.confirmToken).toHaveLength(64); // 32 bytes hex-encoded
    // lang bound LAST (0011) — "Store it on the row."
    expect(boundArgs).toEqual(["box-1", "Jane Doe", "jane@example.com", "We stock it every Sunday", result.confirmToken, "es"]);
  });

  test("throws if D1 doesn't return a last_row_id — never silently returns an undefined id", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ run: async () => ({ meta: {} }) }) }),
    } as unknown as D1Database;
    await expect(
      insertAdopterApplication(db, { venueId: "a", displayName: "x", email: "x@example.com", note: null, lang: "en" }),
    ).rejects.toThrow("last_row_id");
  });
});

describe("sendAdopterConfirmEmail", () => {
  test("includes the 'if you didn't ask for this' disclaimer (2026-09-18 security review, item 7)", async () => {
    mockSendResendEmail.mockClear();
    await sendAdopterConfirmEmail({ to: "jane@example.com", boxName: "Test Box", origin: "https://pueblofoodmap.com", confirmToken: "tok", lang: "en" });
    expect(mockSendResendEmail).toHaveBeenCalledTimes(1);
    const { text } = mockSendResendEmail.mock.calls[0][0] as { text: string };
    expect(text).toContain("If you didn't ask for this, you can ignore this email.");
  });

  // Blessing Boxes slice 6, single-language alert emails: the applicant's
  // OWN signup-time lang picks the whole message, not a fixed default.
  test("lang 'es' renders the Spanish confirm email only", async () => {
    mockSendResendEmail.mockClear();
    await sendAdopterConfirmEmail({ to: "jane@example.com", boxName: "Test Box", origin: "https://pueblofoodmap.com", confirmToken: "tok", lang: "es" });
    const { subject, text } = mockSendResendEmail.mock.calls[0][0] as { subject: string; text: string };
    expect(subject).toContain("Confirma tu solicitud");
    expect(text).toContain("Si tú no pediste esto");
    expect(text).not.toContain("If you didn't ask for this");
  });
});

describe("isAdopterConfirmTokenValid", () => {
  test("true when created just now", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    expect(isAdopterConfirmTokenValid({ created_at: now.toISOString() }, now)).toBe(true);
  });

  test("true at exactly 7 days old", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const created = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(isAdopterConfirmTokenValid({ created_at: created.toISOString() }, now)).toBe(true);
  });

  test("false once older than 7 days", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");
    const created = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1000);
    expect(isAdopterConfirmTokenValid({ created_at: created.toISOString() }, now)).toBe(false);
  });
});
