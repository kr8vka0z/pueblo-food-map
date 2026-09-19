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

const mockLogFormFailure = vi.fn();
vi.mock("@/lib/logger", () => ({
  logFormFailure: (...args: unknown[]) => mockLogFormFailure(...args),
}));

import {
  ALERT_COOLDOWN_HOURS,
  MAX_ALERT_RECIPIENTS_PER_EVENT,
  findHostSubscription,
  insertHostSubscriptionStatement,
  claimAlertRecipients,
  confirmSubscription,
  notifyBoxAlerts,
  removeHostSubscriptionStatement,
  resubscribeByToken,
  rolesToNotify,
  sendGiverConfirmEmail,
  stopSubscriptionByToken,
  unsubscribeAdopterSubscriptionStatement,
  upsertApprovedAdopterSubscriptionStatement,
  upsertGiverSubscription,
} from "@/lib/boxAlerts";

beforeEach(() => {
  mockSendResendBatch.mockReset().mockResolvedValue(undefined);
  mockSendResendEmail.mockReset().mockResolvedValue(undefined);
  mockCheckAndIncrement.mockReset().mockResolvedValue(true);
  mockLogFormFailure.mockReset();
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

  // 2026-09-18 security review, item 13: recipients are already CLAIMED
  // (last_alerted_at set) before the send even starts — a Resend failure
  // here silently loses their alert unless logged. Count only, never
  // addresses.
  test("a sendResendBatch failure logs the recipient COUNT (never addresses), then still rejects (item 13)", async () => {
    mockSendResendBatch.mockRejectedValue(new Error("Resend batch API error 500"));
    const db = makeDb({
      claimed: [
        { id: 1, email: "a@example.com", unsubscribe_token: "tok-a" },
        { id: 2, email: "b@example.com", unsubscribe_token: "tok-b" },
      ],
    });
    await expect(
      notifyBoxAlerts(db, { venueId: "box-1", kind: "empty", prevStatus: "stocked", origin: "https://pueblofoodmap.com" }),
    ).rejects.toThrow("Resend batch API error 500");
    expect(mockLogFormFailure).toHaveBeenCalledTimes(1);
    const [form, reason, detail] = mockLogFormFailure.mock.calls[0];
    expect(form).toBe("alerts");
    expect(reason).toBe("send_failed");
    expect(detail.recipientCount).toBe(2);
    expect(JSON.stringify(detail)).not.toContain("@example.com");
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

  // 2026-09-18 security review, item 9: two concurrent signups for the same
  // venue+email can both pass the "no existing row" SELECT before either
  // INSERTs — the UNIQUE(role, venue_id, email) index then rejects the
  // loser. That must be recovered (re-read + treat like an existing row),
  // never surfaced as an unhandled exception.
  test("INSERT loses a UNIQUE-constraint race -> re-reads and falls through to the existing-row branch", async () => {
    let selectCount = 0;
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            selectCount += 1;
            // First SELECT (before the INSERT attempt): nothing yet. Second
            // SELECT (after the UNIQUE violation): the winner's row, already
            // confirmed and active.
            return selectCount === 1 ? null : { id: 1, confirmed_at: "2026-09-01T00:00:00.000Z", unsubscribed_at: null };
          },
          run: async () => {
            if (sql.startsWith("INSERT")) throw new Error("UNIQUE constraint failed: alert_subscriptions.role, alert_subscriptions.venue_id, alert_subscriptions.email");
            return { meta: { changes: 1 } };
          },
        }),
      }),
    } as unknown as D1Database;

    const result = await upsertGiverSubscription(db, { venueId: "box-1", email: "a@example.com" });
    expect(result.action).toBe("noop"); // the winner's row was already confirmed+active
    expect(selectCount).toBe(2);
  });

  test("INSERT throws a non-UNIQUE error -> rethrown, never swallowed", async () => {
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => null,
          run: async () => {
            if (sql.startsWith("INSERT")) throw new Error("no such table: alert_subscriptions");
            return { meta: { changes: 1 } };
          },
        }),
      }),
    } as unknown as D1Database;

    await expect(upsertGiverSubscription(db, { venueId: "box-1", email: "a@example.com" })).rejects.toThrow(
      "no such table",
    );
  });
});

describe("sendGiverConfirmEmail", () => {
  test("includes the 'if you didn't ask for this' disclaimer (2026-09-18 security review, item 7)", async () => {
    mockSendResendEmail.mockClear();
    await sendGiverConfirmEmail({ to: "giver@example.com", boxName: "Test Box", origin: "https://pueblofoodmap.com", confirmToken: "tok" });
    expect(mockSendResendEmail).toHaveBeenCalledTimes(1);
    const { text } = mockSendResendEmail.mock.calls[0][0] as { text: string };
    expect(text).toContain("If you didn't ask for this, you can ignore this email.");
  });
});

// 2026-09-18 security review, item 8: addHostSubscription/removeHostSubscription
// used to run their own INSERT/UPDATE directly. The host-alerts route now
// needs to batch that write with an audit_log INSERT (same atomic pairing
// the box-adopters approve/reject routes already use) — a plain awaited
// `run()` can't be combined into a db.batch(), so both are now split into a
// read (findHostSubscription) plus a statement builder the route batches
// itself. This is the covering criterion for renaming/restructuring these
// tests (item 8's own instruction: "item 8 explicitly authorizes rewriting
// makeFakeDb and the existing 'added'/'update' assertions").
describe("host subscriptions", () => {
  test("findHostSubscription: no existing row -> null", async () => {
    const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database;
    expect(await findHostSubscription(db, "box-1", "host@example.com")).toBeNull();
  });

  test("findHostSubscription: existing row -> returned as-is", async () => {
    const row = { id: 1, unsubscribed_at: null };
    const db = { prepare: () => ({ bind: () => ({ first: async () => row }) }) } as unknown as D1Database;
    expect(await findHostSubscription(db, "box-1", "host@example.com")).toEqual(row);
  });

  test("insertHostSubscriptionStatement: binds an ALREADY-confirmed row (no double opt-in for a host)", () => {
    let seenSql = "";
    let boundArgs: unknown[] = [];
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: (...args: unknown[]) => { boundArgs = args; return {}; } };
      },
    } as unknown as D1Database;
    const now = new Date("2026-09-18T00:00:00.000Z");
    insertHostSubscriptionStatement(db, { venueId: "box-1", email: "host@example.com" }, now);
    expect(seenSql).toContain("INSERT INTO alert_subscriptions");
    expect(boundArgs[0]).toBe("box-1");
    expect(boundArgs[1]).toBe("host@example.com");
    expect(boundArgs[4]).toBe(now.toISOString()); // confirmed_at
  });

  test("removeHostSubscriptionStatement: sets unsubscribed_at, scoped to role='host' and this venue+email", () => {
    let seenSql = "";
    let boundArgs: unknown[] = [];
    const db = {
      prepare: (sql: string) => {
        seenSql = sql;
        return { bind: (...args: unknown[]) => { boundArgs = args; return {}; } };
      },
    } as unknown as D1Database;
    removeHostSubscriptionStatement(db, "box-1", "host@example.com");
    expect(seenSql).toContain("role = 'host'");
    expect(boundArgs).toContain("box-1");
    expect(boundArgs).toContain("host@example.com");
  });

  // 2026-09-18 security review, item 2, BLOCKER: removing a host must also
  // kill their OLD unsubscribe token, or anyone still holding a copy of an
  // alert email this row received (every one carries the stop link) could
  // resubscribe the removed host right back.
  test("removeHostSubscriptionStatement: ALSO rotates unsubscribe_token — the old token stops working", () => {
    let boundArgs: unknown[] = [];
    const db = {
      prepare: () => ({ bind: (...args: unknown[]) => { boundArgs = args; return {}; } }),
    } as unknown as D1Database;
    removeHostSubscriptionStatement(db, "box-1", "host@example.com");
    const newToken = boundArgs.find((a) => typeof a === "string" && /^[0-9a-f]{64}$/.test(a));
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe("host@example.com");
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

  // 2026-09-18 security review, item 2, BLOCKER — same reasoning as
  // removeHostSubscriptionStatement's own token-rotation test above: a
  // removed/rejected adopter's old stop link must die with the removal.
  test("the reject/remove statement ALSO rotates unsubscribe_token — the old token stops working", () => {
    let boundArgs: unknown[] = [];
    const db = {
      prepare: () => ({ bind: (...args: unknown[]) => { boundArgs = args; return {}; } }),
    } as unknown as D1Database;
    unsubscribeAdopterSubscriptionStatement(db, 9, "2026-09-18T00:00:00.000Z");
    const newToken = boundArgs.find((a) => typeof a === "string" && /^[0-9a-f]{64}$/.test(a));
    expect(newToken).toBeDefined();
  });

  // End-to-end proof (not just "a token was bound somewhere") that the
  // rotated token actually invalidates the OLD one: a stateful fake
  // capturing whatever value the rotate-UPDATE binds, then answering the
  // resubscribe lookup with null unless the caller presents THAT value.
  test("after the rotate-UPDATE runs, resubscribeByToken with the OLD token -> 'not_found'", async () => {
    const OLD_TOKEN = "old-token-that-should-die";
    let capturedNewToken: string | null = null;
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => {
          if (sql.includes("UPDATE alert_subscriptions SET unsubscribed_at = ?, unsubscribe_token = ?")) {
            capturedNewToken = args[1] as string;
            return { run: async () => ({}) };
          }
          if (sql.includes("SELECT id FROM alert_subscriptions WHERE unsubscribe_token = ?")) {
            const presented = args[0] as string;
            return { first: async () => (presented === capturedNewToken ? { id: 9 } : null) };
          }
          if (sql.includes("UPDATE alert_subscriptions SET unsubscribed_at = NULL")) {
            return { run: async () => ({}) };
          }
          throw new Error("unexpected SQL: " + sql);
        },
      }),
    } as unknown as D1Database;

    // The reject route's own db.batch() would run this statement — a
    // .bind() call is enough to capture the token this test cares about,
    // since D1's batch() executes every bound statement it's given.
    unsubscribeAdopterSubscriptionStatement(db, 9, "2026-09-18T00:00:00.000Z");
    expect(capturedNewToken).not.toBeNull();

    expect(await resubscribeByToken(db, OLD_TOKEN, "secret")).toBe("not_found");
    expect(await resubscribeByToken(db, capturedNewToken!, "secret")).toBe("resubscribed");
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
