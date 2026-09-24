// @vitest-environment node
/**
 * Real-SQLite proof for emailRetention.ts's three UPDATE/DELETE statements
 * (#594) — same "run the actual exported SQL against a schema built from
 * real migration files" pattern adminBoxes.sql.test.ts established. The
 * unit test (emailRetention.test.ts) mocks D1 and can't catch a real SQL
 * mistake (a bad column name, a UNIQUE-constraint collision) the way this
 * file, against a real SQLite engine, can.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  runEmailRetentionCleanup,
  retentionCutoffIso,
  EMAIL_RETENTION_DAYS,
  EmailRetentionPartialFailure,
} from "@/lib/emailRetention";

// D1Database's real shape is a thin promise-returning wrapper around
// better-sqlite3's synchronous API — this fake matches the one surface
// runEmailRetentionCleanup uses (`prepare().bind().run()`, with
// `result.meta.changes`), same convention as this repo's other D1 fakes.
function wrapAsD1(db: Database.Database): D1Database {
  return {
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            const info = stmt.run(...args);
            return { meta: { changes: info.changes } };
          },
        }),
      };
    },
  } as unknown as D1Database;
}

function buildDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0002_public_submissions.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0001_init_admin_schema.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0005_blessing_boxes.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0010_box_adopters_alerts.sql"), "utf-8"));
  db.exec(readFileSync(join(process.cwd(), "migrations", "0011_alert_email_lang.sql"), "utf-8"));
  return db;
}

const NOW = new Date("2026-09-24T00:00:00.000Z");
// One day past the 90-day cutoff, and one day inside it.
const OLD = new Date(NOW.getTime() - (EMAIL_RETENTION_DAYS + 1) * 86_400_000).toISOString();
const RECENT = new Date(NOW.getTime() - (EMAIL_RETENTION_DAYS - 1) * 86_400_000).toISOString();

function insertSubmission(
  db: Database.Database,
  row: { id: number; kind: "new_venue" | "closure"; email: string | null; createdAt: string; payload: object },
) {
  db.prepare(
    `INSERT INTO public_submissions (id, kind, payload, submitter_email, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(row.id, row.kind, JSON.stringify(row.payload), row.email, row.createdAt);
}

function insertAdopter(
  db: Database.Database,
  row: { id: number; email: string; status: "pending" | "approved" | "rejected"; reviewedAt: string | null },
) {
  db.prepare(
    `INSERT INTO box_adopters (id, venue_id, display_name, email, status, reviewed_at, confirm_token, created_at)
     VALUES (?, 'box-a', 'Test Adopter', ?, ?, ?, ?, '2026-01-01T00:00:00.000Z')`,
  ).run(row.id, row.email, row.status, row.reviewedAt, `token-${row.id}`);
}

function insertSubscription(
  db: Database.Database,
  row: { id: number; role: "host" | "adopter" | "giver"; venueId: string; email: string; unsubscribedAt: string | null },
) {
  db.prepare(
    `INSERT INTO alert_subscriptions (id, role, venue_id, email, confirm_token, unsubscribe_token, unsubscribed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00.000Z')`,
  ).run(row.id, row.role, row.venueId, row.email, `confirm-${row.id}`, `unsub-${row.id}`, row.unsubscribedAt);
}

describe("retentionCutoffIso", () => {
  test("90 days before `now`", () => {
    expect(retentionCutoffIso(NOW)).toBe(new Date(NOW.getTime() - 90 * 86_400_000).toISOString());
  });
});

describe("runEmailRetentionCleanup — real SQLite", () => {
  let sqlite: Database.Database;
  let db: D1Database;

  beforeEach(() => {
    sqlite = buildDb();
    db = wrapAsD1(sqlite);
  });

  test("blanks a 91-day-old submission's column AND strips the email out of payload", async () => {
    insertSubmission(sqlite, {
      id: 1,
      kind: "new_venue",
      email: "old@example.com",
      createdAt: OLD,
      payload: { venueName: "Old Place", submitterEmail: "old@example.com" },
    });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.submissionsBlanked).toBe(1);
    const row = sqlite.prepare("SELECT submitter_email, payload FROM public_submissions WHERE id = 1").get() as {
      submitter_email: string | null;
      payload: string;
    };
    expect(row.submitter_email).toBeNull();
    expect(JSON.parse(row.payload)).toEqual({ venueName: "Old Place" });
  });

  test("strips contactEmail (closure kind) from payload, leaves other fields intact", async () => {
    insertSubmission(sqlite, {
      id: 2,
      kind: "closure",
      email: "reporter@example.com",
      createdAt: OLD,
      payload: { venueId: "v1", contactEmail: "reporter@example.com", description: "closed" },
    });

    await runEmailRetentionCleanup(db, NOW);

    const row = sqlite.prepare("SELECT payload FROM public_submissions WHERE id = 2").get() as { payload: string };
    expect(JSON.parse(row.payload)).toEqual({ venueId: "v1", description: "closed" });
  });

  test("leaves a submission inside the 90-day window untouched", async () => {
    insertSubmission(sqlite, {
      id: 3,
      kind: "new_venue",
      email: "recent@example.com",
      createdAt: RECENT,
      payload: { venueName: "New Place", submitterEmail: "recent@example.com" },
    });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.submissionsBlanked).toBe(0);
    const row = sqlite.prepare("SELECT submitter_email FROM public_submissions WHERE id = 3").get() as {
      submitter_email: string | null;
    };
    expect(row.submitter_email).toBe("recent@example.com");
  });

  test("an already-blanked old submission is not re-counted (idempotent)", async () => {
    insertSubmission(sqlite, { id: 4, kind: "new_venue", email: null, createdAt: OLD, payload: { venueName: "X" } });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.submissionsBlanked).toBe(0);
  });

  test("blanks a rejected box_adopters row reviewed over 90 days ago, keeps the row", async () => {
    insertAdopter(sqlite, { id: 1, email: "adopter@example.com", status: "rejected", reviewedAt: OLD });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.adoptersBlanked).toBe(1);
    const row = sqlite.prepare("SELECT email, status FROM box_adopters WHERE id = 1").get() as {
      email: string;
      status: string;
    };
    expect(row.email).toBe("");
    expect(row.status).toBe("rejected"); // row kept for audit, per #594
  });

  test("leaves an approved or pending adopter untouched regardless of age", async () => {
    insertAdopter(sqlite, { id: 2, email: "approved@example.com", status: "approved", reviewedAt: OLD });
    insertAdopter(sqlite, { id: 3, email: "pending@example.com", status: "pending", reviewedAt: null });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.adoptersBlanked).toBe(0);
    expect((sqlite.prepare("SELECT email FROM box_adopters WHERE id = 2").get() as { email: string }).email).toBe(
      "approved@example.com",
    );
  });

  test("leaves a rejected adopter reviewed inside the 90-day window untouched", async () => {
    insertAdopter(sqlite, { id: 4, email: "recent@example.com", status: "rejected", reviewedAt: RECENT });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.adoptersBlanked).toBe(0);
  });

  test("deletes an alert_subscriptions row unsubscribed over 90 days ago", async () => {
    insertSubscription(sqlite, { id: 1, role: "giver", venueId: "box-a", email: "giver@example.com", unsubscribedAt: OLD });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.subscriptionsDeleted).toBe(1);
    expect(sqlite.prepare("SELECT * FROM alert_subscriptions WHERE id = 1").get()).toBeUndefined();
  });

  test("two old unsubscribed rows sharing role+venue (the UNIQUE(role, venue_id, email) case) both delete cleanly", async () => {
    insertSubscription(sqlite, { id: 1, role: "giver", venueId: "box-a", email: "one@example.com", unsubscribedAt: OLD });
    insertSubscription(sqlite, { id: 2, role: "giver", venueId: "box-a", email: "two@example.com", unsubscribedAt: OLD });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.subscriptionsDeleted).toBe(2);
    expect(sqlite.prepare("SELECT COUNT(*) as n FROM alert_subscriptions").get()).toEqual({ n: 0 });
  });

  test("leaves an active (never unsubscribed) or recently-unsubscribed subscription untouched", async () => {
    insertSubscription(sqlite, { id: 1, role: "host", venueId: "box-a", email: "host@example.com", unsubscribedAt: null });
    insertSubscription(sqlite, { id: 2, role: "adopter", venueId: "box-a", email: "adopter@example.com", unsubscribedAt: RECENT });

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.subscriptionsDeleted).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) as n FROM alert_subscriptions").get()).toEqual({ n: 2 });
  });

  // A single-statement UPDATE aborts entirely if json_remove throws on ANY
  // matched row (SQLite has no per-row error recovery within one
  // statement) — the json_valid guard in BLANK_SUBMISSIONS_SQL exists
  // specifically to stop one malformed row from rolling back every other
  // row's column blank in the same run.
  test("a malformed payload still gets submitter_email blanked (payload itself left alone), and does not block the well-formed row beside it", async () => {
    insertSubmission(sqlite, {
      id: 5,
      kind: "new_venue",
      email: "clean@example.com",
      createdAt: OLD,
      payload: { venueName: "Clean Place", submitterEmail: "clean@example.com" },
    });
    // Bypasses insertSubmission's JSON.stringify to write a genuinely
    // malformed payload column directly.
    sqlite
      .prepare(
        `INSERT INTO public_submissions (id, kind, payload, submitter_email, status, created_at)
         VALUES (6, 'new_venue', 'not valid json', 'broken@example.com', 'pending', ?)`,
      )
      .run(OLD);

    const counts = await runEmailRetentionCleanup(db, NOW);

    expect(counts.submissionsBlanked).toBe(2);
    const clean = sqlite.prepare("SELECT submitter_email, payload FROM public_submissions WHERE id = 5").get() as {
      submitter_email: string | null;
      payload: string;
    };
    expect(clean.submitter_email).toBeNull();
    expect(JSON.parse(clean.payload)).toEqual({ venueName: "Clean Place" });

    const broken = sqlite.prepare("SELECT submitter_email, payload FROM public_submissions WHERE id = 6").get() as {
      submitter_email: string | null;
      payload: string;
    };
    expect(broken.submitter_email).toBeNull(); // primary target still cleared
    expect(broken.payload).toBe("not valid json"); // left alone — can't safely touch it
  });

  test("a failure in one table's statement does not block the other two", async () => {
    // box_adopters and alert_subscriptions have real, valid old rows.
    // Deliberately break the SUBMISSIONS table (drop it) so its statement
    // throws — the other two tables' cleanup must still run and commit.
    sqlite.exec("DROP TABLE public_submissions");
    insertAdopter(sqlite, { id: 1, email: "adopter@example.com", status: "rejected", reviewedAt: OLD });
    insertSubscription(sqlite, { id: 1, role: "giver", venueId: "box-a", email: "giver@example.com", unsubscribedAt: OLD });

    await expect(runEmailRetentionCleanup(db, NOW)).rejects.toThrow(/email retention cleanup/);

    expect((sqlite.prepare("SELECT email FROM box_adopters WHERE id = 1").get() as { email: string }).email).toBe("");
    expect(sqlite.prepare("SELECT * FROM alert_subscriptions WHERE id = 1").get()).toBeUndefined();
  });

  test("the thrown EmailRetentionPartialFailure carries the counts of the statements that DID succeed", async () => {
    sqlite.exec("DROP TABLE public_submissions");
    insertAdopter(sqlite, { id: 1, email: "adopter@example.com", status: "rejected", reviewedAt: OLD });
    insertSubscription(sqlite, { id: 1, role: "giver", venueId: "box-a", email: "giver@example.com", unsubscribedAt: OLD });

    let caught: unknown;
    try {
      await runEmailRetentionCleanup(db, NOW);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(EmailRetentionPartialFailure);
    expect((caught as EmailRetentionPartialFailure).counts).toEqual({
      submissionsBlanked: 0,
      adoptersBlanked: 1,
      subscriptionsDeleted: 1,
    });
  });
});
