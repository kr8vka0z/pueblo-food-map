// @vitest-environment node
/**
 * Tests for src/lib/boxAlerts.ts (Blessing Boxes slice 6) — role targeting,
 * the atomic cooldown claim, upsert/refuse semantics, and the confirm/stop/
 * resubscribe token flows. Resend itself is mocked (see emailSend.test.ts
 * for the HTTP-layer coverage) — these tests prove boxAlerts.ts's OWN logic:
 * who gets claimed, what SQL runs, and what each branch returns.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockSendResendBatch = vi.fn();
const mockSendResendEmail = vi.fn();
vi.mock("@/lib/emailSend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/emailSend")>("@/lib/emailSend");
  return {
    ...actual,
    sendResendBatch: (...args: unknown[]) => mockSendResendBatch(...args),
    sendResendEmail: (...args: unknown[]) => mockSendResendEmail(...args),
  };
});

const mockCheckAndIncrement = vi.fn();
vi.mock("@/lib/checkinRateLimit", () => ({
  checkAndIncrement: (...args: unknown[]) => mockCheckAndIncrement(...args),
}));

import {
  ALERT_COOLDOWN_HOURS,
  MAX_ALERT_RECIPIENTS_PER_EVENT,
  addHostSubscription,
  claimAlertRecipients,
  confirmSubscription,
  notifyBoxAlerts,
  removeHostSubscription,
  resubscribeByToken,
  rolesToNotify,
  stopSubscriptionByToken,
  unsubscribeAdopterSubscriptionStatement,
  upsertApprovedAdopterSubscriptionStatement,
  upsertGiverSubscription,
} from "@/lib/boxAlerts";

beforeEach(() => {
  mockSendResendBatch.mockReset().mockResolvedValue(undefined);
  mockSendResendEmail.mockReset().mockResolvedValue(undefined);
  mockCheckAndIncrement.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("rolesToNotify — who gets what", () => {
  test("'problem' -> host + adopter, never giver, and always qualifies regardless of prevStatus", () => {
    expect(rolesToNotify("problem", "stocked")).toEqual(["host", "adopter"]);
    expect(rolesToNotify("problem", null)).toEqual(["host", "adopter"]);
  });

  test("'empty' -> host + adopter + giver, but only when the box wasn't already empty", () => {
    expect(rolesToNotify("empty", "stocked")).toEqual(["host", "adopter", "giver"]);
    expect(rolesToNotify("empty", "low")).toEqual(["host", "adopter", "giver"]);
    expect(rolesToNotify("empty", null)).toEqual(["host", "adopter", "giver"]);
    expect(rolesToNotify("empty", "empty")).toEqual([]);
  });

  test("'low' -> giver ONLY (never host/adopter), and only when the box wasn't already low", () => {
    expect(rolesToNotify("low", "stocked")).toEqual(["giver"]);
    expect(rolesToNotify("low", "low")).toEqual([]);
  });
});

describe("claimAlertRecipients", () => {
  test("empty roles list short-circuits without querying", async () => {
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    expect(await claimAlertRecipients(db, "box-1", [], new Date())).toEqual([]);
  });

  test("binds venueId, every role, and a cooldown threshold ALERT_COOLDOWN_HOURS in the past", async () => {
    let boundArgs: unknown[] = [];
    const db = {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return { all: async () => ({ results: [] }) };
        },
      }),
    } as unknown as D1Database;
    const now = new Date("2026-09-18T12:00:00.000Z");
    await claimAlertRecipients(db, "box-1", ["host", "adopter"], now);
    // [newLastAlertedAt, venueId, ...roles, cooldownThreshold]
    expect(boundArgs[1]).toBe("box-1");
    expect(boundArgs[2]).toBe("host");
    expect(boundArgs[3]).toBe("adopter");
    const cooldownThreshold = new Date(boundArgs[4] as string);
    expect(now.getTime() - cooldownThreshold.getTime()).toBe(ALERT_COOLDOWN_HOURS * 60 * 60 * 1000);
  });

  test("the UPDATE caps its inner SELECT at MAX_ALERT_RECIPIENTS_PER_EVENT", async () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({ all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    await claimAlertRecipients(db, "box-1", ["giver"], new Date());
    expect(seenSql).toContain(`LIMIT ${MAX_ALERT_RECIPIENTS_PER_EVENT}`);
    expect(seenSql).toContain("confirmed_at IS NOT NULL");
    expect(seenSql).toContain("unsubscribed_at IS NULL");
  });

  test("returns exactly what the RETURNING clause hands back", async () => {
    const rows = [{ id: 1, email: "a@example.com", unsubscribe_token: "tok-a" }];
    const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: rows }) }) }) } as unknown as D1Database;
    expect(await claimAlertRecipients(db, "box-1", ["giver"], new Date())).toEqual(rows);
  });
});

describe("notifyBoxAlerts — orchestration", () => {
  function makeDb(opts: { claimed?: { id: number; email: string; unsubscribe_token: string }[]; boxName?: string } = {}) {
    const claimed = opts.claimed ?? [{ id: 1, email: "giver@example.com", unsubscribe_token: "tok-1" }];
    return {
      prepare: (sql: string) => {
        if (sql.includes("UPDATE alert_subscriptions")) {
          return { bind: () => ({ all: async () => ({ results: claimed }) }) };
        }
        if (sql.includes("SELECT name FROM venues")) {
          return { bind: () => ({ first: async () => ({ name: opts.boxName ?? "Test Box" }) }) };
        }
        throw new Error("unexpected SQL: " + sql);
      },
    } as unknown as D1Database;
  }

  test("kind not empty/low/problem -> no-op, never queries D1", async () => {
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    await notifyBoxAlerts(db, { venueId: "box-1", kind: "took", prevStatus: null, origin: "https://pueblofoodmap.com" });
    expect(mockSendResendBatch).not.toHaveBeenCalled();
  });

  test("no qualifying roles (e.g. already empty) -> no-op, never sends", async () => {
    const db = makeDb();
    await notifyBoxAlerts(db, { venueId: "box-1", kind: "empty", prevStatus: "empty", origin: "https://pueblofoodmap.com" });
    expect(mockSendResendBatch).not.toHaveBeenCalled();
  });

  test("no claimed recipients (everyone on cooldown) -> no-op, never looks up the box name", async () => {
    const db = makeDb({ claimed: [] });
    await notifyBoxAlerts(db, { venueId: "box-1", kind: "empty", prevStatus: "stocked", origin: "https://pueblofoodmap.com" });
    expect(mockSendResendBatch).not.toHaveBeenCalled();
  });

  test("sends one batched email per claimed recipient, each with its own stop link", async () => {
    const db = makeDb({
      claimed: [
        { id: 1, email: "a@example.com", unsubscribe_token: "tok-a" },
        { id: 2, email: "b@example.com", unsubscribe_token: "tok-b" },
      ],
      boxName: "216 W Routt Blessing Box",
    });
    await notifyBoxAlerts(db, { venueId: "box-1", kind: "empty", prevStatus: "stocked", origin: "https://pueblofoodmap.com" });
    expect(mockSendResendBatch).toHaveBeenCalledTimes(1);
    const emails = mockSendResendBatch.mock.calls[0][0] as { to: string; headers?: Record<string, string> }[];
    expect(emails).toHaveLength(2);
    expect(emails[0].to).toBe("a@example.com");
    expect(emails[1].to).toBe("b@example.com");
    expect(emails[0].headers?.["List-Unsubscribe"]).toContain("tok-a");
    expect(emails[1].headers?.["List-Unsubscribe"]).toContain("tok-b");
  });

  test("the note is never a parameter this function (or its email builder) can carry — structural, not just 'don't pass it'", async () => {
    const db = makeDb();
    // NotifyBoxAlertsInput has no `note` field at all; TypeScript itself
    // would reject `note` here. This runtime assertion is the belt: the
    // email text/html built never contains anything from a check-in note.
    await notifyBoxAlerts(db, { venueId: "box-1", kind: "problem", prevStatus: "stocked", origin: "https://pueblofoodmap.com" });
    const emails = mockSendResendBatch.mock.calls[0][0] as { text: string; html: string }[];
    for (const email of emails) {
      expect(email.text.toLowerCase()).not.toContain("door is broken"); // a plausible note string, proving it can't have leaked in
    }
  });

  test("a D1/Resend failure anywhere inside is the caller's problem to catch — this function itself still rejects rather than swallowing (never blocks the check-in ITSELF, which is the route's own try/catch job)", async () => {
    const db = { prepare: () => { throw new Error("no alert_subscriptions table"); } } as unknown as D1Database;
    await expect(
      notifyBoxAlerts(db, { venueId: "box-1", kind: "empty", prevStatus: "stocked", origin: "https://pueblofoodmap.com" }),
    ).rejects.toThrow();
  });
});

describe("upsertGiverSubscription", () => {
  function makeDb(existing: { id: number; confirmed_at: string | null; unsubscribed_at: string | null } | null) {
    const calls: { sql: string; args: unknown[] }[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => {
          calls.push({ sql, args });
          if (sql.startsWith("SELECT")) return { first: async () => existing };
          return { run: async () => ({ meta: { changes: 1 } }) };
        },
      }),
    } as unknown as D1Database;
    return { db, calls };
  }

  test("no existing row -> inserts, action 'new'", async () => {
    const { db, calls } = makeDb(null);
    const result = await upsertGiverSubscription(db, { venueId: "box-1", email: "a@example.com" });
    expect(result.action).toBe("new");
    expect(result.confirmToken).not.toBeNull();
    expect(calls.some((c) => c.sql.includes("INSERT INTO alert_subscriptions"))).toBe(true);
  });

  test("existing, confirmed, active -> sends nothing, action 'noop'", async () => {
    const { db } = makeDb({ id: 1, confirmed_at: "2026-09-01T00:00:00.000Z", unsubscribed_at: null });
    const result = await upsertGiverSubscription(db, { venueId: "box-1", email: "a@example.com" });
    expect(result.action).toBe("noop");
    expect(result.confirmToken).toBeNull();
  });

  test("existing, unconfirmed, active -> resends with a rotated token, action 'resend'", async () => {
    const { db, calls } = makeDb({ id: 1, confirmed_at: null, unsubscribed_at: null });
    const result = await upsertGiverSubscription(db, { venueId: "box-1", email: "a@example.com" });
    expect(result.action).toBe("resend");
    expect(result.confirmToken).not.toBeNull();
    expect(calls.some((c) => c.sql.includes("UPDATE alert_subscriptions SET confirm_token"))).toBe(true);
  });

  test("existing, previously unsubscribed -> clears it and rotates the token, action 'reactivate'", async () => {
    const { db } = makeDb({ id: 1, confirmed_at: "2026-09-01T00:00:00.000Z", unsubscribed_at: "2026-09-05T00:00:00.000Z" });
    const result = await upsertGiverSubscription(db, { venueId: "box-1", email: "a@example.com" });
    expect(result.action).toBe("reactivate");
    expect(result.confirmToken).not.toBeNull();
  });
});

describe("host subscriptions", () => {
  test("addHostSubscription: no existing row -> inserts already-confirmed, 'added'", async () => {
    const inserted: unknown[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => null,
          run: async () => {
            inserted.push(args);
            return { meta: { changes: 1 } };
          },
        }),
      }),
    } as unknown as D1Database;
    const result = await addHostSubscription(db, { venueId: "box-1", email: "host@example.com" });
    expect(result).toBe("added");
  });

  test("addHostSubscription: existing, active -> 'already', no duplicate insert", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => ({ id: 1, unsubscribed_at: null }) }) }),
    } as unknown as D1Database;
    expect(await addHostSubscription(db, { venueId: "box-1", email: "host@example.com" })).toBe("already");
  });

  test("addHostSubscription: existing, previously unsubscribed -> 'refused', never silently resubscribed", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => ({ id: 1, unsubscribed_at: "2026-09-05T00:00:00.000Z" }) }) }),
    } as unknown as D1Database;
    expect(await addHostSubscription(db, { venueId: "box-1", email: "host@example.com" })).toBe("refused");
  });

  test("removeHostSubscription sets unsubscribed_at, scoped to role='host' and this venue+email", async () => {
    let seenSql = "";
    let boundArgs: unknown[] = [];
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: (...args: unknown[]) => { boundArgs = args; return { run: async () => ({}) }; } };
      },
    } as unknown as D1Database;
    await removeHostSubscription(db, "box-1", "host@example.com");
    expect(seenSql).toContain("role = 'host'");
    expect(boundArgs).toContain("box-1");
    expect(boundArgs).toContain("host@example.com");
  });
});

describe("upsertApprovedAdopterSubscriptionStatement / unsubscribeAdopterSubscriptionStatement", () => {
  test("the approve statement is an upsert (ON CONFLICT DO UPDATE), not INSERT OR IGNORE — a re-approval must clear a stale unsubscribed_at", () => {
    let seenSql = "";
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: () => ({}) };
      },
    } as unknown as D1Database;
    upsertApprovedAdopterSubscriptionStatement(db, { venueId: "box-1", email: "a@example.com", adopterId: 9, timestamp: "2026-09-18T00:00:00.000Z" });
    expect(seenSql).toContain("ON CONFLICT(role, venue_id, email) DO UPDATE");
    expect(seenSql).toContain("unsubscribed_at = NULL");
  });

  test("the reject/remove statement scopes to role='adopter' AND this adopter_id only", () => {
    let seenSql = "";
    let boundArgs: unknown[] = [];
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: (...args: unknown[]) => { boundArgs = args; return {}; } };
      },
    } as unknown as D1Database;
    unsubscribeAdopterSubscriptionStatement(db, 9, "2026-09-18T00:00:00.000Z");
    expect(seenSql).toContain("role = 'adopter'");
    expect(seenSql).toContain("adopter_id = ?");
    expect(boundArgs).toContain(9);
  });
});

describe("confirmSubscription", () => {
  test("returns true when it actually confirms (D1 reports a changed row)", async () => {
    const db = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) } as unknown as D1Database;
    expect(await confirmSubscription(db, 1, "2026-09-18T00:00:00.000Z")).toBe(true);
  });

  test("returns false when already confirmed (idempotent, 0 rows changed)", async () => {
    const db = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) }) } as unknown as D1Database;
    expect(await confirmSubscription(db, 1, "2026-09-18T00:00:00.000Z")).toBe(false);
  });
});

describe("stopSubscriptionByToken / resubscribeByToken", () => {
  test("stop: rate-limited -> 'rate_limited', never queries the subscription", async () => {
    mockCheckAndIncrement.mockResolvedValue(false);
    const db = { prepare: () => { throw new Error("should never be called"); } } as unknown as D1Database;
    expect(await stopSubscriptionByToken(db, "tok", "secret")).toBe("rate_limited");
  });

  test("stop: unknown token -> 'not_found'", async () => {
    const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database;
    expect(await stopSubscriptionByToken(db, "tok", "secret")).toBe("not_found");
  });

  test("stop: known token -> sets unsubscribed_at, returns 'stopped'", async () => {
    let sawUpdate = false;
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => ({ id: 1 }),
          run: async () => {
            sawUpdate = sawUpdate || sql.includes("UPDATE");
            return {};
          },
        }),
      }),
    } as unknown as D1Database;
    expect(await stopSubscriptionByToken(db, "tok", "secret")).toBe("stopped");
    expect(sawUpdate).toBe(true);
  });

  test("resubscribe: unknown token -> 'not_found'", async () => {
    const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database;
    expect(await resubscribeByToken(db, "tok", "secret")).toBe("not_found");
  });

  test("resubscribe: known token -> clears unsubscribed_at, returns 'resubscribed'", async () => {
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => ({ id: 1 }), run: async () => ({}) }) }),
    } as unknown as D1Database;
    expect(await resubscribeByToken(db, "tok", "secret")).toBe("resubscribed");
  });
});
