/**
 * boxAlerts.ts — email-alert subscriptions (host/adopter/giver), the
 * cooldown-gated send path triggered from a check-in, and the confirm/stop/
 * resubscribe token flows shared by all three roles (Blessing Boxes
 * slice 6).
 *
 * WHY one table/module for three recipient kinds instead of three: a host
 * (added by an admin), an approved adopter (created on approval — see
 * boxAdopters.ts), and a giver (self-signed-up from a box's card) all need
 * the identical confirm/stop/cooldown machinery — writing it three times
 * would triple the surface area for the one bug this file exists to avoid
 * (double-sending, or emailing an unconfirmed/unsubscribed address). `role`
 * is the only thing that varies; every function here branches on it rather
 * than being copy-pasted per role.
 *
 * WHO GETS WHAT (rolesToNotify, below) — the task's own spec, restated here
 * since it's the one rule every other function in this file exists to
 * serve: host + approved adopters get an email when a box is reported
 * EMPTY or has a PROBLEM. Givers get an email when their chosen box is
 * reported EMPTY or LOW. Givers NEVER get a problem report. The free-text
 * note on a 'filled'/'problem' check-in is NEVER included in any email this
 * file sends — every function here takes only `kind`/`boxName`/`boxUrl`,
 * structurally no parameter exists for a note to travel through.
 *
 * ONLY ON CHANGE: an 'empty'/'low' check-in only triggers an alert if the
 * box's status computed from check-ins BEFORE this one wasn't already that
 * value — a box sitting empty for a week shouldn't re-alert on every
 * subsequent "still empty" tap. 'problem' has no such gate (every report is
 * independently worth flagging). See notifyBoxAlerts()'s own header for how
 * the caller (the checkins route) supplies `prevStatus`.
 *
 * COOLDOWN: at most one alert email per subscription per
 * ALERT_COOLDOWN_HOURS (6) — claimed ATOMICALLY, before any Resend call, via
 * one `UPDATE ... WHERE last_alerted_at IS NULL OR < ? RETURNING ...`
 * statement (claimAlertRecipients). A read-then-write ("SELECT eligible
 * rows, then UPDATE each") would let two overlapping check-ins both read
 * "not yet cooled down" and both send — same race checkinRateLimit.ts's own
 * header warns against for its unrelated counter.
 *
 * NEVER BLOCKS THE CHECK-IN: notifyBoxAlerts() is called from the checkins
 * route wrapped end-to-end in try/catch, via ctx.waitUntil() when a live
 * ExecutionContext is available (falls back to an un-awaited, caught
 * promise otherwise) — a Resend outage, a missing alert_subscriptions table
 * (migration 0010 not yet applied on this environment), or any other
 * failure here must degrade to a console warning, never fail or slow the
 * check-in response itself.
 */

import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { composeBilingualEmail, sendResendBatch, sendResendEmail, unsubscribeHeaders, type OutboundEmail } from "@/lib/emailSend";
import { isWithinConfirmWindow, randomHexToken } from "@/lib/alertTokens";
import type { BoxStatus, CheckinKind } from "@/lib/blessingBoxes";

export const ALERT_COOLDOWN_HOURS = 6;
const ALERT_COOLDOWN_MS = ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;

/** ponytail: a hard, inline cap on recipients per event rather than a queue — fine at Pueblo's real subscriber volume; if a box ever legitimately needs to alert more than 200 people from one check-in, the upgrade path is a durable queue (e.g. a D1-backed outbox table drained by a scheduled worker) instead of this synchronous batch send. */
export const MAX_ALERT_RECIPIENTS_PER_EVENT = 200;

export type AlertRole = "host" | "adopter" | "giver";
type AlertableKind = Extract<CheckinKind, "empty" | "low" | "problem">;

export interface AlertSubscriptionRow {
  id: number;
  role: AlertRole;
  venue_id: string;
  email: string;
  adopter_id: number | null;
  confirmed_at: string | null;
  confirm_token: string;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  last_alerted_at: string | null;
  created_at: string;
}

// ─── Who gets what ──────────────────────────────────────────────────────────

/**
 * The one place "who gets what" is encoded — see this file's own header.
 * `prevStatus` is required for 'empty'/'low' (the only two kinds that gate
 * on a status CHANGE) and ignored for 'problem' (which always qualifies,
 * every report is independently worth flagging).
 */
export function rolesToNotify(kind: AlertableKind, prevStatus: BoxStatus | null): AlertRole[] {
  if (kind === "problem") return ["host", "adopter"];
  if (kind === "empty") return prevStatus === "empty" ? [] : ["host", "adopter", "giver"];
  if (kind === "low") return prevStatus === "low" ? [] : ["giver"];
  return [];
}

// ─── Recipient claim (atomic, BEFORE any Resend call) ──────────────────────

interface ClaimedRecipient {
  id: number;
  email: string;
  unsubscribe_token: string;
}

function claimRecipientsSql(roleCount: number): string {
  const placeholders = Array(roleCount).fill("?").join(", ");
  // LIMIT is a fixed internal constant (MAX_ALERT_RECIPIENTS_PER_EVENT),
  // never user input — inlined rather than bound, since SQLite/D1's support
  // for a bound parameter in LIMIT position is inconsistent across drivers.
  return `
    UPDATE alert_subscriptions
    SET last_alerted_at = ?
    WHERE id IN (
      SELECT id FROM alert_subscriptions
      WHERE venue_id = ? AND role IN (${placeholders})
        AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
        AND (last_alerted_at IS NULL OR last_alerted_at < ?)
      LIMIT ${MAX_ALERT_RECIPIENTS_PER_EVENT}
    )
    RETURNING id, email, unsubscribe_token
  `;
}

/**
 * Atomically claims every eligible (confirmed, not unsubscribed, cooled
 * down) subscription for `venueId`/`roles` — the UPDATE itself is the claim,
 * so only rows this call actually claims are ever emailed (see this file's
 * own header, COOLDOWN).
 */
export async function claimAlertRecipients(
  db: D1Database,
  venueId: string,
  roles: AlertRole[],
  now: Date,
): Promise<ClaimedRecipient[]> {
  if (roles.length === 0) return [];
  const cooldownThreshold = new Date(now.getTime() - ALERT_COOLDOWN_MS).toISOString();
  const result = await db
    .prepare(claimRecipientsSql(roles.length))
    .bind(now.toISOString(), venueId, ...roles, cooldownThreshold)
    .all<ClaimedRecipient>();
  return result.results ?? [];
}

// ─── Email content ──────────────────────────────────────────────────────────

const ALERT_COPY: Record<AlertableKind, { subjectKey: string; bodyLineKey: string }> = {
  empty: { subjectKey: "email.alert.empty.subject", bodyLineKey: "email.alert.empty.line1" },
  low: { subjectKey: "email.alert.low.subject", bodyLineKey: "email.alert.low.line1" },
  problem: { subjectKey: "email.alert.problem.subject", bodyLineKey: "email.alert.problem.line1" },
};

/** Builds one recipient's alert email — its OWN stop link, never a shared one. */
function buildAlertEmail(opts: {
  to: string;
  unsubscribeToken: string;
  kind: AlertableKind;
  boxName: string;
  boxUrl: string;
  origin: string;
}): OutboundEmail {
  const copy = ALERT_COPY[opts.kind];
  const stopApiUrl = `${opts.origin}/api/public/alerts/stop?t=${opts.unsubscribeToken}`;
  const stopPageUrl = `${opts.origin}/alerts/stop?t=${opts.unsubscribeToken}`;
  const { subject, text, html } = composeBilingualEmail({
    subjectKey: copy.subjectKey,
    bodyLineKeys: [copy.bodyLineKey, "email.alert.line2", "email.stopLine"],
    vars: { box: opts.boxName, url: opts.boxUrl, stopUrl: stopPageUrl },
  });
  return { to: opts.to, subject, text, html, headers: unsubscribeHeaders(stopApiUrl) };
}

// ─── Orchestration — called from the checkins route ────────────────────────

export interface NotifyBoxAlertsInput {
  venueId: string;
  kind: CheckinKind;
  /** Box status computed from check-ins BEFORE this one — null when unknown/unavailable, treated as "not already this status" (i.e. an alert still fires). */
  prevStatus: BoxStatus | null;
  origin: string;
  now?: Date;
}

/**
 * The checkins route's one entry point. Fully self-contained failure
 * handling — see this file's own header, NEVER BLOCKS THE CHECK-IN. Looks up
 * the box's own name (never trusts a caller-supplied one, so a stale name
 * can't leak into an email) and its public URL, computes which roles
 * qualify, claims recipients, and sends via ONE batched Resend call.
 */
export async function notifyBoxAlerts(db: D1Database, input: NotifyBoxAlertsInput): Promise<void> {
  if (input.kind !== "empty" && input.kind !== "low" && input.kind !== "problem") return;
  const kind = input.kind;
  const now = input.now ?? new Date();

  const roles = rolesToNotify(kind, input.prevStatus);
  if (roles.length === 0) return;

  const recipients = await claimAlertRecipients(db, input.venueId, roles, now);
  if (recipients.length === 0) return;

  const boxRow = await db.prepare("SELECT name FROM venues WHERE id = ?").bind(input.venueId).first<{ name: string }>();
  const boxName = boxRow?.name ?? input.venueId;
  const boxUrl = `${input.origin}/box/${encodeURIComponent(input.venueId)}`;

  const emails = recipients.map((r) =>
    buildAlertEmail({
      to: r.email,
      unsubscribeToken: r.unsubscribe_token,
      kind,
      boxName,
      boxUrl,
      origin: input.origin,
    }),
  );
  await sendResendBatch(emails);
}

// ─── Giver sign-up (self-service, double opt-in) ───────────────────────────

export type GiverSignupAction = "new" | "resend" | "noop" | "reactivate";

interface ExistingGiverRow {
  id: number;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

/**
 * Upsert semantics exactly per the task's own spec:
 *   - no row yet -> insert (unconfirmed), action "new"
 *   - row exists, unconfirmed, still active -> rotate the token AND
 *     created_at (so the 7-day confirm window restarts from THIS resend,
 *     not the original signup — a resent link that's already stale on
 *     arrival would be a worse bug than the extra column write), action
 *     "resend"
 *   - row exists, confirmed, active -> send nothing, action "noop"
 *   - row exists, previously unsubscribed -> clear unsubscribed_at AND
 *     confirmed_at, rotate the token, action "reactivate" (needs a fresh
 *     confirm — the fact someone once stopped this address is exactly the
 *     case double opt-in exists to re-check)
 * Every branch returns the SAME shape so the route can send the SAME
 * generic "check your email" response regardless of which happened — no
 * enumeration of whether an address was already subscribed.
 */
export async function upsertGiverSubscription(
  db: D1Database,
  input: { venueId: string; email: string },
  now: Date = new Date(),
): Promise<{ action: GiverSignupAction; confirmToken: string | null }> {
  const existing = await db
    .prepare("SELECT id, confirmed_at, unsubscribed_at FROM alert_subscriptions WHERE role = 'giver' AND venue_id = ? AND email = ?")
    .bind(input.venueId, input.email)
    .first<ExistingGiverRow>();

  if (!existing) {
    const confirmToken = randomHexToken();
    await db
      .prepare(
        "INSERT INTO alert_subscriptions (role, venue_id, email, confirm_token, unsubscribe_token, created_at) VALUES ('giver', ?, ?, ?, ?, ?)",
      )
      .bind(input.venueId, input.email, confirmToken, randomHexToken(), now.toISOString())
      .run();
    return { action: "new", confirmToken };
  }

  if (existing.confirmed_at && !existing.unsubscribed_at) {
    return { action: "noop", confirmToken: null };
  }

  const action: GiverSignupAction = existing.unsubscribed_at ? "reactivate" : "resend";
  const confirmToken = randomHexToken();
  await db
    .prepare(
      "UPDATE alert_subscriptions SET confirm_token = ?, created_at = ?, confirmed_at = NULL, unsubscribed_at = NULL WHERE id = ?",
    )
    .bind(confirmToken, now.toISOString(), existing.id)
    .run();
  return { action, confirmToken };
}

/** Sends the giver's confirm email — no stop link (nothing to stop until confirmed), per the task's own list of which emails carry one. */
export async function sendGiverConfirmEmail(opts: { to: string; boxName: string; origin: string; confirmToken: string }): Promise<void> {
  const url = `${opts.origin}/alerts/confirm?t=${opts.confirmToken}`;
  const { subject, text, html } = composeBilingualEmail({
    subjectKey: "email.alertConfirm.subject",
    bodyLineKeys: ["email.alertConfirm.line1", "email.alertConfirm.line2", "email.alertConfirm.cta"],
    vars: { box: opts.boxName, url },
  });
  await sendResendEmail({ to: opts.to, subject, text, html });
}

// ─── Host management (admin-only) ──────────────────────────────────────────

export type HostAddResult = "added" | "already" | "refused";

interface ExistingHostRow {
  id: number;
  unsubscribed_at: string | null;
}

export async function loadHostSubscriptions(db: D1Database, venueId: string): Promise<{ id: number; email: string }[]> {
  const result = await db
    .prepare("SELECT id, email FROM alert_subscriptions WHERE role = 'host' AND venue_id = ? AND unsubscribed_at IS NULL ORDER BY created_at ASC")
    .bind(venueId)
    .all<{ id: number; email: string }>();
  return result.results ?? [];
}

/**
 * Admin-added host rows start ALREADY confirmed — the admin vouches for the
 * address, per the task's own spec, so there's no double opt-in for a host
 * the way there is for an adopter/giver. Refuses (never silently
 * resubscribes) an email that previously clicked its own stop link — same
 * rule the task states for the general case; this also covers an admin's
 * own prior "Remove" (DELETE, below), since both set the same
 * unsubscribed_at column and there is no way to tell them apart. That is a
 * real, reported gap (see AGENTS.md's own note on this route) rather than
 * a redesign of the spec's literal DELETE/refuse behavior.
 */
export async function addHostSubscription(
  db: D1Database,
  input: { venueId: string; email: string },
  now: Date = new Date(),
): Promise<HostAddResult> {
  const existing = await db
    .prepare("SELECT id, unsubscribed_at FROM alert_subscriptions WHERE role = 'host' AND venue_id = ? AND email = ?")
    .bind(input.venueId, input.email)
    .first<ExistingHostRow>();

  if (existing) {
    return existing.unsubscribed_at ? "refused" : "already";
  }

  await db
    .prepare(
      "INSERT INTO alert_subscriptions (role, venue_id, email, confirm_token, unsubscribe_token, confirmed_at, created_at) VALUES ('host', ?, ?, ?, ?, ?, ?)",
    )
    .bind(input.venueId, input.email, randomHexToken(), randomHexToken(), now.toISOString(), now.toISOString())
    .run();
  return "added";
}

/** DELETE /api/admin/blessing-boxes/[id]/host-alerts — per the task's own literal spec, sets unsubscribed_at (does not hard-delete the row). */
export async function removeHostSubscription(db: D1Database, venueId: string, email: string, now: Date = new Date()): Promise<void> {
  await db
    .prepare("UPDATE alert_subscriptions SET unsubscribed_at = ? WHERE role = 'host' AND venue_id = ? AND email = ? AND unsubscribed_at IS NULL")
    .bind(now.toISOString(), venueId, email)
    .run();
}

/** Best-effort "you'll now get alerts" email to a newly-added host — no stop-link omission here, this IS a welcome email per the task's own list. */
export async function sendHostWelcomeEmail(opts: { to: string; boxName: string; origin: string; unsubscribeToken: string }): Promise<void> {
  const stopApiUrl = `${opts.origin}/api/public/alerts/stop?t=${opts.unsubscribeToken}`;
  const stopPageUrl = `${opts.origin}/alerts/stop?t=${opts.unsubscribeToken}`;
  const { subject, text, html } = composeBilingualEmail({
    subjectKey: "email.hostWelcome.subject",
    bodyLineKeys: ["email.hostWelcome.line1", "email.hostWelcome.line2", "email.stopLine"],
    vars: { box: opts.boxName, stopUrl: stopPageUrl },
  });
  await sendResendEmail({ to: opts.to, subject, text, html, headers: unsubscribeHeaders(stopApiUrl) });
}

// ─── Adopter approval side effects (statements for the approve/reject db.batch()) ──
// Both functions below return ReturnType<D1Database["prepare"]> rather than
// the ambient D1PreparedStatement type — that type isn't among
// cloudflare-env.d.ts's narrow runtime imports (see that file's own header
// for why this project avoids a bare `wrangler types` include), and
// deriving it from D1Database's own method signature avoids adding a second
// ambient import for one local type — same convention adminProposals.ts
// already uses for its own batch()-bound statement.

/**
 * The statement the box-adopters approve route adds to its atomic
 * db.batch() — an upsert, NOT a plain INSERT OR IGNORE (2026 review
 * correction to the task's own literal wording): a re-approved adopter
 * whose email had a PRIOR subscription row that was later unsubscribed
 * (rejected/removed, or their own stop click) would otherwise stay
 * unsubscribed forever, since INSERT OR IGNORE leaves an existing row
 * untouched on the UNIQUE(role, venue_id, email) conflict. ON CONFLICT DO
 * UPDATE reactivates that row (clears unsubscribed_at, repoints adopter_id
 * at the newly-approved application, refreshes confirmed_at) while leaving
 * its existing confirm/unsubscribe tokens intact — the newly-generated
 * tokens bound into the INSERT branch are only used on a genuine first
 * insert.
 */
export function upsertApprovedAdopterSubscriptionStatement(
  db: D1Database,
  input: { venueId: string; email: string; adopterId: number; timestamp: string },
): ReturnType<D1Database["prepare"]> {
  return db
    .prepare(
      `INSERT INTO alert_subscriptions (role, venue_id, email, adopter_id, confirmed_at, confirm_token, unsubscribe_token, created_at)
       VALUES ('adopter', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(role, venue_id, email) DO UPDATE SET
         unsubscribed_at = NULL,
         adopter_id = excluded.adopter_id,
         confirmed_at = excluded.confirmed_at`,
    )
    .bind(
      input.venueId,
      input.email,
      input.adopterId,
      input.timestamp,
      randomHexToken(),
      randomHexToken(),
      input.timestamp,
    );
}

/** The statement the box-adopters reject route adds to its atomic db.batch() when rejecting a PREVIOUSLY APPROVED adopter (the "Remove" action) — stops their alerts, never touches box_adopters.status's own row (that's the caller's separate UPDATE). A no-op (0 rows) when no subscription exists yet, e.g. rejecting a still-pending application. */
export function unsubscribeAdopterSubscriptionStatement(
  db: D1Database,
  adopterId: number,
  timestamp: string,
): ReturnType<D1Database["prepare"]> {
  return db
    .prepare("UPDATE alert_subscriptions SET unsubscribed_at = ? WHERE role = 'adopter' AND adopter_id = ? AND unsubscribed_at IS NULL")
    .bind(timestamp, adopterId);
}

/** Best-effort "you're approved" email to a newly-approved adopter. */
export async function sendAdopterApprovedEmail(opts: {
  to: string;
  boxName: string;
  displayName: string;
  origin: string;
  unsubscribeToken: string;
}): Promise<void> {
  const stopApiUrl = `${opts.origin}/api/public/alerts/stop?t=${opts.unsubscribeToken}`;
  const stopPageUrl = `${opts.origin}/alerts/stop?t=${opts.unsubscribeToken}`;
  const { subject, text, html } = composeBilingualEmail({
    subjectKey: "email.adoptApproved.subject",
    bodyLineKeys: ["email.adoptApproved.line1", "email.adoptApproved.line2", "email.stopLine"],
    vars: { box: opts.boxName, displayName: opts.displayName, stopUrl: stopPageUrl },
  });
  await sendResendEmail({ to: opts.to, subject, text, html, headers: unsubscribeHeaders(stopApiUrl) });
}

// ─── Confirm / stop / resubscribe (giver + host + adopter shared tokens) ───

export async function findSubscriptionByConfirmToken(db: D1Database, token: string): Promise<AlertSubscriptionRow | null> {
  return db.prepare("SELECT * FROM alert_subscriptions WHERE confirm_token = ?").bind(token).first<AlertSubscriptionRow>();
}

/** Idempotent — returns true only the FIRST time a row is actually confirmed (mirrors boxAdopters.ts's markAdopterEmailConfirmed), so a caller can decide whether to send a one-time notice. */
export async function confirmSubscription(db: D1Database, id: number, timestamp: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE alert_subscriptions SET confirmed_at = ? WHERE id = ? AND confirmed_at IS NULL")
    .bind(timestamp, id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** True when `row`'s confirm token is still within its 7-day validity window (alertTokens.ts's shared CONFIRM_TOKEN_MAX_AGE_MS). */
export function isSubscriptionConfirmTokenValid(row: Pick<AlertSubscriptionRow, "created_at">, now: Date = new Date()): boolean {
  return isWithinConfirmWindow(row.created_at, now);
}

export type StopResult = "stopped" | "not_found" | "rate_limited";

/**
 * Looks up a subscription by its UNSUBSCRIBE token and stops it — used by
 * BOTH the API stop route (mail-client one-click) and the human-facing
 * /alerts/stop page's own GET (the task's own "visiting it stops the emails
 * immediately" rule — a mail scanner prefetching the link only causes an
 * unwanted unsubscribe, the safe direction). Rate-limited per token value
 * (fold into the SAME neutral "not found" outcome as a genuinely unknown
 * token, so a brute-force attempt learns nothing either way) via the
 * existing checkinRateLimit.ts module and CHECKIN_RATE_LIMIT_SECRET — no new
 * secret needed.
 */
export async function stopSubscriptionByToken(db: D1Database, token: string, rateLimitSecret: string, now: Date = new Date()): Promise<StopResult> {
  const allowed = await checkAndIncrement(db, rateLimitSecret, { scope: "alert-token", id: token }, 30, now);
  if (!allowed) return "rate_limited";

  const row = await db.prepare("SELECT id FROM alert_subscriptions WHERE unsubscribe_token = ?").bind(token).first<{ id: number }>();
  if (!row) return "not_found";

  await db.prepare("UPDATE alert_subscriptions SET unsubscribed_at = ? WHERE id = ?").bind(now.toISOString(), row.id).run();
  return "stopped";
}

export type ResubscribeResult = "resubscribed" | "not_found" | "rate_limited";

/** The "that was a mistake" undo on /alerts/stop — clears unsubscribed_at only; does not touch confirmed_at (they already proved the address once). */
export async function resubscribeByToken(db: D1Database, token: string, rateLimitSecret: string, now: Date = new Date()): Promise<ResubscribeResult> {
  const allowed = await checkAndIncrement(db, rateLimitSecret, { scope: "alert-token", id: token }, 30, now);
  if (!allowed) return "rate_limited";

  const row = await db.prepare("SELECT id FROM alert_subscriptions WHERE unsubscribe_token = ?").bind(token).first<{ id: number }>();
  if (!row) return "not_found";

  await db.prepare("UPDATE alert_subscriptions SET unsubscribed_at = NULL WHERE id = ?").bind(row.id).run();
  return "resubscribed";
}
