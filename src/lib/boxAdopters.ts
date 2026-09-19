/**
 * boxAdopters.ts — shared D1 row shapes, SQL, and thin D1-reading/writing
 * helpers for the "adopt a box" layer (Blessing Boxes slice 6). Same split
 * this repo already uses for blessingBoxes.ts / boxPhotos.ts: query +
 * row-mapping logic lives here, route handlers own their own try/catch and
 * auth.
 *
 * WHY a separate file from blessingBoxes.ts: an adoption application has its
 * own moderation lifecycle (pending/approved/rejected) independent of a
 * box's live status/check-in state, its own private PII column (`email`,
 * `note` — unlike every other blessing-box table so far, which the Build
 * Plan holds to a strict "no name, no email, no IP, ever" rule; see this
 * file's own migration header for why an adoption application is the one
 * deliberate exception), and its own admin review queue — same "enough
 * surface area to justify a dedicated module" reasoning boxPhotos.ts's own
 * header gives for staying out of blessingBoxes.ts. blessingBoxes.ts imports
 * one function from here (loadApprovedAdopterNamesForVenues) to populate
 * PublicBlessingBox.box.adopters — never the reverse, so there's no import
 * cycle.
 */

import { isWithinConfirmWindow, randomHexToken } from "@/lib/alertTokens";
import { composeBilingualEmail, sendResendEmail } from "@/lib/emailSend";

// ─── D1 row shapes ──────────────────────────────────────────────────────────

/** Mirrors migrations/0010_box_adopters_alerts.sql's `box_adopters` table exactly. PRIVATE: email/note are never mapped into a public shape. */
export interface BoxAdopterRow {
  id: number;
  venue_id: string;
  display_name: string;
  email: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  email_confirmed_at: string | null;
  confirm_token: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
}

/** One row for the admin adoption-requests queue — box name joined once, never N+1. */
export interface AdminBoxAdopterRow {
  id: number;
  venue_id: string;
  venue_name: string;
  display_name: string;
  email: string;
  note: string | null;
  status: BoxAdopterRow["status"];
  email_confirmed_at: string | null;
  created_at: string;
}

// ─── SQL ────────────────────────────────────────────────────────────────────

const SELECT_PENDING_ADOPTERS_SQL = `
  SELECT a.id, a.venue_id, v.name AS venue_name, a.display_name, a.email, a.note,
         a.status, a.email_confirmed_at, a.created_at
  FROM box_adopters a
  JOIN venues v ON v.id = a.venue_id
  WHERE a.status = 'pending'
  ORDER BY a.created_at DESC
`;

const SELECT_APPROVED_ADOPTERS_SQL = `
  SELECT a.id, a.venue_id, v.name AS venue_name, a.display_name, a.email, a.note,
         a.status, a.email_confirmed_at, a.created_at
  FROM box_adopters a
  JOIN venues v ON v.id = a.venue_id
  WHERE a.status = 'approved'
  ORDER BY a.created_at DESC
`;

const SELECT_ADOPTER_BY_ID_SQL = "SELECT * FROM box_adopters WHERE id = ?";

const SELECT_ADOPTER_BY_CONFIRM_TOKEN_SQL = "SELECT * FROM box_adopters WHERE confirm_token = ?";

const INSERT_ADOPTER_SQL = `
  INSERT INTO box_adopters (venue_id, display_name, email, note, confirm_token)
  VALUES (?, ?, ?, ?, ?)
`;

/**
 * Approved display names for one or many boxes, OLDEST first per the task's
 * own spec ("Cared for by A, B" reads as an accumulating roster, not a
 * "most recent adopter" callout) — the one deliberate ORDER BY direction
 * difference from every other "newest first" list in this app.
 */
function selectApprovedAdopterNamesForVenuesSql(count: number): string {
  const placeholders = Array(count).fill("?").join(", ");
  return `
    SELECT venue_id, display_name
    FROM box_adopters
    WHERE status = 'approved' AND venue_id IN (${placeholders})
    ORDER BY created_at ASC
  `;
}

// ─── D1 reads ───────────────────────────────────────────────────────────────

export async function loadPendingAdopters(db: D1Database): Promise<AdminBoxAdopterRow[]> {
  const result = await db.prepare(SELECT_PENDING_ADOPTERS_SQL).all<AdminBoxAdopterRow>();
  return result.results ?? [];
}

export async function loadApprovedAdopters(db: D1Database): Promise<AdminBoxAdopterRow[]> {
  const result = await db.prepare(SELECT_APPROVED_ADOPTERS_SQL).all<AdminBoxAdopterRow>();
  return result.results ?? [];
}

/** How many applications are awaiting a decision — the admin nav's cheap badge count, same "COUNT only" convention boxPhotos.ts's countPendingReview() uses. */
export async function countPendingAdopters(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM box_adopters WHERE status = 'pending'").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function loadAdopterById(db: D1Database, id: number): Promise<BoxAdopterRow | null> {
  return db.prepare(SELECT_ADOPTER_BY_ID_SQL).bind(id).first<BoxAdopterRow>();
}

export async function loadAdopterByConfirmToken(db: D1Database, token: string): Promise<BoxAdopterRow | null> {
  return db.prepare(SELECT_ADOPTER_BY_CONFIRM_TOKEN_SQL).bind(token).first<BoxAdopterRow>();
}

/**
 * Batched "every approved adopter name per box" for the public list endpoint
 * and /box/<id> — one query for every box, not N+1, mirroring boxPhotos.ts's
 * loadLatestApprovedPhotosForVenues. Empty input returns an empty map
 * without touching D1.
 */
export async function loadApprovedAdopterNamesForVenues(
  db: D1Database,
  venueIds: string[],
): Promise<Map<string, string[]>> {
  const byVenue = new Map<string, string[]>();
  if (venueIds.length === 0) return byVenue;

  const result = await db
    .prepare(selectApprovedAdopterNamesForVenuesSql(venueIds.length))
    .bind(...venueIds)
    .all<{ venue_id: string; display_name: string }>();

  for (const row of result.results ?? []) {
    const existing = byVenue.get(row.venue_id);
    if (existing) existing.push(row.display_name);
    else byVenue.set(row.venue_id, [row.display_name]);
  }
  return byVenue;
}

// ─── D1 writes ──────────────────────────────────────────────────────────────

export interface NewAdopterApplication {
  venueId: string;
  displayName: string;
  email: string;
  note: string | null;
}

/** Inserts one new pending, unconfirmed application and returns its id + the confirm token to email. */
export async function insertAdopterApplication(
  db: D1Database,
  input: NewAdopterApplication,
): Promise<{ id: number; confirmToken: string }> {
  const confirmToken = randomHexToken();
  const result = await db
    .prepare(INSERT_ADOPTER_SQL)
    .bind(input.venueId, input.displayName, input.email, input.note, confirmToken)
    .run();
  const id = result.meta?.last_row_id;
  if (typeof id !== "number") {
    throw new Error("box_adopters insert did not return a last_row_id");
  }
  return { id, confirmToken };
}

/**
 * Marks an application's email as confirmed. A no-op (returns false) if it
 * was already confirmed — the confirm route uses this to decide whether to
 * send the "waiting for review" admin alert (only on the FIRST confirm, not
 * every re-click of an already-confirmed link).
 */
export async function markAdopterEmailConfirmed(db: D1Database, id: number, timestamp: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE box_adopters SET email_confirmed_at = ? WHERE id = ? AND email_confirmed_at IS NULL")
    .bind(timestamp, id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** True when `row`'s confirm token is still within its 7-day validity window (alertTokens.ts's shared CONFIRM_TOKEN_MAX_AGE_MS). */
export function isAdopterConfirmTokenValid(row: Pick<BoxAdopterRow, "created_at">, now: Date = new Date()): boolean {
  return isWithinConfirmWindow(row.created_at, now);
}

// ─── Emails ─────────────────────────────────────────────────────────────────
// Kept here (rather than boxAlerts.ts) because both fire directly off this
// file's own write path (insertAdopterApplication / markAdopterEmailConfirmed)
// — boxAlerts.ts's own adopter email (sendAdopterApprovedEmail) is a
// different lifecycle event (admin approval, alongside the
// alert_subscriptions upsert), not an adoption-APPLICATION event.

/** Sent right after insertAdopterApplication(). No stop link — nothing to stop until the application is even confirmed, same "no stop link before there's anything to unsubscribe from" convention sendGiverConfirmEmail (boxAlerts.ts) uses. */
export async function sendAdopterConfirmEmail(opts: {
  to: string;
  boxName: string;
  origin: string;
  confirmToken: string;
}): Promise<void> {
  const url = `${opts.origin}/alerts/confirm?t=${opts.confirmToken}`;
  const { subject, text, html } = composeBilingualEmail({
    subjectKey: "email.adoptConfirm.subject",
    bodyLineKeys: ["email.adoptConfirm.line1", "email.adoptConfirm.line2", "email.adoptConfirm.cta"],
    vars: { box: opts.boxName, url },
  });
  await sendResendEmail({ to: opts.to, subject, text, html });
}

/**
 * Best-effort internal notice that a NEWLY-CONFIRMED application is waiting
 * for review — sent by POST /api/public/alerts/confirm only on the FIRST
 * confirm of a given application (markAdopterEmailConfirmed's own
 * idempotency), never on a re-click of an already-confirmed link. Plain
 * internal text mail, same shape/recipient as the checkins route's own
 * problem-report and photo-upload admin notices — not a subscriber-facing
 * bilingual email, so it doesn't go through composeBilingualEmail.
 */
export async function sendAdopterConfirmedAdminEmail(
  db: D1Database,
  adopter: Pick<BoxAdopterRow, "venue_id" | "display_name" | "email" | "note">,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  const boxName =
    (await db.prepare("SELECT name FROM venues WHERE id = ?").bind(adopter.venue_id).first<{ name: string }>())
      ?.name ?? adopter.venue_id;
  const lines = [
    `A new box-adoption application is confirmed and waiting for review.`,
    ``,
    `Box: ${boxName}`,
    `Name: ${adopter.display_name}`,
    `Email: ${adopter.email}`,
    `Note: ${adopter.note ?? "(none)"}`,
    ``,
    `Review it at https://pueblofoodmap.com/admin/box-adopters`,
  ];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "Pueblo Food Map <noreply@pueblofoodmap.com>",
      to: ["issues@pueblofoodmap.com"],
      subject: `[PFM Blessing Box] New adoption application — ${boxName}`,
      text: lines.join("\n"),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
