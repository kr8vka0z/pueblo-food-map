/**
 * activityLog.ts — data + shaping for the owner-only admin Activity page
 * (/admin/activity, #679).
 *
 * Two sources, merged newest first, grouped by day and then by sign-in:
 * - `auth_events` (migrations/0017): sign-ins, sign-outs, failed sign-ins,
 *   passkey changes — written by src/lib/authEvents.ts.
 * - `audit_log`: every admin write, now carrying the `session_id` of the
 *   sign-in that made it. Rows from before 0017, and system actors
 *   (refresh-pipeline), have none.
 *
 * Grouping rules (buildActivityDays):
 * - A sign-in heads a group; that session's actions, sign-out and passkey
 *   changes sit under it, oldest first.
 * - Actions by a system actor (no "@" in actor_email) form one "Automatic"
 *   group per day.
 * - Human actions with no session (before sign-ins were recorded) form one
 *   group per person per day.
 * - Each failed sign-in is its own (red) group.
 *
 * Only ever called for the owner — the page checks identity.isOwner and
 * 404s otherwise, before any of this runs. Every read goes through the
 * `db` getAdminDb() returned.
 */

export const ACTIVITY_TIME_ZONE = "America/Denver";
export const DEFAULT_RANGE_DAYS = 30;
/** Rows fetched per source per page; the page offers "Show older" past it. */
export const ACTIVITY_PAGE_SIZE = 300;
// D1 caps bound parameters per statement at 100.
const MAX_IN_PARAMS = 90;

export type ActivityType = "all" | "sign_ins" | "failed" | "edits" | "approvals" | "publishes" | "removals";
export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "sign_ins", label: "Sign-ins" },
  { value: "failed", label: "Failed sign-ins" },
  { value: "edits", label: "Edits" },
  { value: "approvals", label: "Approvals & rejections" },
  { value: "publishes", label: "Publishes" },
  { value: "removals", label: "Removals" },
];

/** `person` filter: "" (everyone), "automatic", or a lower-cased email. */
export interface ActivityFilters {
  person: string;
  type: ActivityType;
  from: string; // YYYY-MM-DD, local (ACTIVITY_TIME_ZONE)
  to: string; // YYYY-MM-DD, local, inclusive
  q: string;
  /** Inclusive upper bound (ISO) for "Show older" pages; undefined on the first page. */
  until?: string;
}

export interface AuthEventRow {
  id: number;
  event: "sign_in" | "sign_out" | "sign_in_failed" | "passkey_added" | "passkey_removed";
  email: string | null;
  user_id: string | null;
  session_id: string | null;
  method: string | null;
  ip: string | null;
  user_agent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  detail_json: string | null;
  created_at: string;
}

export type ActionKind = "edit" | "approval" | "publish" | "removal";

export interface AuditActionRow {
  id: number;
  actor_email: string;
  entity: string;
  entity_id: string;
  action: "create" | "update" | "publish" | "archive";
  before_json: string | null;
  after_json: string;
  timestamp: string;
  session_id: string | null;
  venue_id: string | null;
  venue_name: string | null;
  from_proposal: number;
  kind: ActionKind;
}

// ---------------------------------------------------------------------------
// Dates (America/Denver)
// ---------------------------------------------------------------------------

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function tzOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ACTIVITY_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** UTC instant (ms) of local midnight at the start of `ymd`. */
export function localDayStartMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12);
  return Date.UTC(y, m - 1, d) - tzOffsetMs(noonUtc);
}

/** Local calendar date (YYYY-MM-DD) of an instant. */
export function localYmd(instant: Date | string | number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: ACTIVITY_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Parses the page's search params into safe filters (defaults: everyone, all types, last 30 days). */
export function parseActivityFilters(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): ActivityFilters {
  const today = localYmd(now);
  let from = first(params.from);
  let to = first(params.to);
  if (!YMD.test(to)) to = today;
  if (!YMD.test(from)) from = shiftYmd(to, -(DEFAULT_RANGE_DAYS - 1));
  if (from > to) [from, to] = [to, from];
  const typeParam = first(params.type) as ActivityType;
  const type = ACTIVITY_TYPES.some((t) => t.value === typeParam) ? typeParam : "all";
  const person = first(params.person).trim().toLowerCase().slice(0, 254);
  const q = first(params.q).trim().slice(0, 100);
  const untilParam = first(params.until);
  const until = untilParam && !Number.isNaN(Date.parse(untilParam)) ? new Date(untilParam).toISOString() : undefined;
  return { person, type, from, to, q, until };
}

/** [lower, upper] ISO bounds, both inclusive. */
export function activityBounds(filters: ActivityFilters): { lower: string; upper: string } {
  const lower = new Date(localDayStartMs(filters.from)).toISOString();
  const rangeUpper = new Date(localDayStartMs(shiftYmd(filters.to, 1)) - 1).toISOString();
  const upper = filters.until && filters.until < rangeUpper ? filters.until : rangeUpper;
  return { lower, upper };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Which place/box an audit row is about. Box rows reference their own table's
// id; everything else about a place uses the venue id directly. Publish rows
// (entity_id = the publish timestamp) match nothing, by design.
const ACTION_SELECT_SQL = `
SELECT * FROM (
  SELECT a.id, a.actor_email, a.entity, a.entity_id, a.action, a.before_json, a.after_json,
         a.timestamp, a.session_id, v.id AS venue_id, v.name AS venue_name,
         EXISTS (
           SELECT 1 FROM change_proposals cp
           WHERE cp.target_venue_id = a.entity_id AND cp.status = 'approved'
             AND cp.applied_at = a.timestamp AND cp.reviewed_by = a.actor_email
         ) AS from_proposal
  FROM audit_log a
  LEFT JOIN venues v ON v.id = CASE a.entity
    WHEN 'venue' THEN a.entity_id
    WHEN 'box_host_alert' THEN a.entity_id
    WHEN 'box_photo' THEN (SELECT venue_id FROM box_photos WHERE id = CAST(a.entity_id AS INTEGER))
    WHEN 'box_adopter' THEN (SELECT venue_id FROM box_adopters WHERE id = CAST(a.entity_id AS INTEGER))
    WHEN 'box_checkin' THEN (SELECT venue_id FROM box_checkins WHERE id = CAST(a.entity_id AS INTEGER))
  END
  WHERE a.timestamp >= ? AND a.timestamp <= ?
) x`;

const ACTION_KIND_SQL = `CASE
    WHEN action = 'publish' THEN 'publish'
    WHEN action = 'archive' THEN 'removal'
    WHEN entity IN ('box_photo', 'box_adopter') OR from_proposal = 1
      OR after_json LIKE '%"event":"public_submission_marked_done"%' THEN 'approval'
    ELSE 'edit'
  END`;

const TYPE_TO_KIND: Partial<Record<ActivityType, ActionKind>> = {
  edits: "edit",
  approvals: "approval",
  publishes: "publish",
  removals: "removal",
};

export async function loadActivityActions(db: D1Database, filters: ActivityFilters, limit = ACTIVITY_PAGE_SIZE): Promise<AuditActionRow[]> {
  if (filters.type === "sign_ins" || filters.type === "failed") return [];
  const { lower, upper } = activityBounds(filters);
  const where: string[] = [];
  const args: unknown[] = [lower, upper];
  if (filters.person === "automatic") where.push("actor_email NOT LIKE '%@%'");
  else if (filters.person) {
    where.push("lower(actor_email) = ?");
    args.push(filters.person);
  }
  const kind = TYPE_TO_KIND[filters.type];
  if (kind) {
    where.push(`(${ACTION_KIND_SQL}) = ?`);
    args.push(kind);
  }
  if (filters.q) {
    where.push("venue_name LIKE ? ESCAPE '\\'");
    args.push(`%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const sql = `SELECT *, ${ACTION_KIND_SQL} AS kind FROM (${ACTION_SELECT_SQL}) y
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY timestamp DESC, id DESC LIMIT ?`;
  args.push(limit);
  const result = await db.prepare(sql).bind(...args).all<AuditActionRow>();
  return result.results ?? [];
}

export async function loadActivityAuthEvents(db: D1Database, filters: ActivityFilters, limit = ACTIVITY_PAGE_SIZE): Promise<AuthEventRow[]> {
  // A place search or an action-only type narrows to actions; automatic
  // changes have no sign-ins.
  if (filters.q || filters.person === "automatic" || TYPE_TO_KIND[filters.type]) return [];
  const { lower, upper } = activityBounds(filters);
  const where = ["created_at >= ?", "created_at <= ?"];
  const args: unknown[] = [lower, upper];
  if (filters.type === "sign_ins") where.push("event <> 'sign_in_failed'");
  if (filters.type === "failed") where.push("event = 'sign_in_failed'");
  if (filters.person) {
    where.push("lower(email) = ?");
    args.push(filters.person);
  }
  args.push(limit);
  const result = await db
    .prepare(`SELECT * FROM auth_events WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(...args)
    .all<AuthEventRow>();
  return result.results ?? [];
}

/** The sign-in rows heading sessions whose actions are on this page but whose sign-in isn't (earlier, or filtered out). */
export async function loadSignInsForSessions(db: D1Database, sessionIds: string[]): Promise<AuthEventRow[]> {
  const unique = [...new Set(sessionIds)];
  const rows: AuthEventRow[] = [];
  for (let i = 0; i < unique.length; i += MAX_IN_PARAMS) {
    const chunk = unique.slice(i, i + MAX_IN_PARAMS);
    const result = await db
      .prepare(`SELECT * FROM auth_events WHERE event = 'sign_in' AND session_id IN (${chunk.map(() => "?").join(", ")})`)
      .bind(...chunk)
      .all<AuthEventRow>();
    rows.push(...(result.results ?? []));
  }
  return rows;
}

/** People for the filter: everyone who signed in or made a change (never a failed attempt's email). */
export async function loadActivityPeople(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT lower(actor_email) AS email FROM audit_log WHERE actor_email LIKE '%@%'
       UNION SELECT DISTINCT lower(email) FROM auth_events WHERE event = 'sign_in' AND email IS NOT NULL
       ORDER BY email LIMIT 50`,
    )
    .all<{ email: string }>();
  return (result.results ?? []).map((r) => r.email);
}

export interface ActivityPage {
  actions: AuditActionRow[];
  events: AuthEventRow[];
  sessionHeaders: AuthEventRow[];
  /** Pass as `until` for the next ("Show older") page; null when there's nothing older in range. */
  nextUntil: string | null;
}

/**
 * Loads one page. When a source fills its page, the page is cut at the
 * newest of the fill points, so the two merged streams never skip rows; the
 * next page resumes there (inclusive), so rows sharing that timestamp aren't
 * lost either.
 */
export async function loadActivityPage(db: D1Database, filters: ActivityFilters, limit = ACTIVITY_PAGE_SIZE): Promise<ActivityPage> {
  let [actions, events] = await Promise.all([loadActivityActions(db, filters, limit), loadActivityAuthEvents(db, filters, limit)]);
  const fillPoints = [
    actions.length === limit ? actions[actions.length - 1].timestamp : null,
    events.length === limit ? events[events.length - 1].created_at : null,
  ].filter((t): t is string => t !== null);
  let nextUntil: string | null = null;
  if (fillPoints.length) {
    const cutoff = fillPoints.sort().at(-1)!;
    const keptActions = actions.filter((a) => a.timestamp > cutoff);
    const keptEvents = events.filter((e) => e.created_at > cutoff);
    if (keptActions.length + keptEvents.length > 0) {
      actions = keptActions;
      events = keptEvents;
      nextUntil = cutoff;
    } else {
      // More than a full page shares one timestamp — show them all, move past it.
      nextUntil = new Date(Date.parse(cutoff) - 1).toISOString();
    }
  }
  const known = new Set(events.filter((e) => e.event === "sign_in").map((e) => e.session_id));
  const missing = [...actions.map((a) => a.session_id), ...events.map((e) => e.session_id)].filter(
    (id): id is string => !!id && !known.has(id),
  );
  const sessionHeaders = missing.length ? await loadSignInsForSessions(db, missing) : [];
  return { actions, events, sessionHeaders, nextUntil };
}

// ---------------------------------------------------------------------------
// Presentation helpers (pure)
// ---------------------------------------------------------------------------

/** "Safari on Mac" from a user agent — enough to recognise a device, not a fingerprint. */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\/|FxiOS/.test(ua)
      ? "Firefox"
      : /CriOS|Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}

/** "203.0.113.x" / "2607:3640:121::…" — the full address shows on hover. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::…`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.x` : ip;
}

export function describeLocation(row: Pick<AuthEventRow, "city" | "region" | "country">): string {
  return [row.city, row.region, row.country].filter(Boolean).join(", ");
}

export const METHOD_LABELS: Record<string, string> = {
  passkey: "passkey",
  email_link: "sign-in link",
  email_code: "email code",
};

const FAILURE_REASONS: Record<string, string> = {
  not_allowlisted: "sign-in requested for an email that isn't an admin",
  INVALID_OTP: "wrong sign-in code",
  OTP_EXPIRED: "sign-in code had expired",
  TOO_MANY_ATTEMPTS: "too many wrong codes",
  // Rows from before #684 (sign-in links).
  INVALID_TOKEN: "sign-in link was invalid, expired or already used",
  EXPIRED_TOKEN: "sign-in link had expired",
  passkey_failed: "passkey wasn't accepted",
};

export function describeFailure(row: AuthEventRow): string {
  let reason = "";
  try {
    reason = row.detail_json ? String((JSON.parse(row.detail_json) as { reason?: unknown }).reason ?? "") : "";
  } catch {
    reason = "";
  }
  if (FAILURE_REASONS[reason]) return FAILURE_REASONS[reason];
  if (row.method === "passkey") return "passkey wasn't accepted";
  return reason ? `sign-in failed (${reason})` : "sign-in failed";
}

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Bookkeeping columns every write touches — noise in a "what changed" line.
const DIFF_IGNORED = new Set([
  "updated_at",
  "updated_by",
  "created_at",
  "created_by",
  "published_at",
  "published_by",
  "reviewed_at",
  "reviewed_by",
  "hidden_at",
  "hidden_by",
]);
const MAX_DIFF_FIELDS = 6;
const MAX_VALUE_CHARS = 60;

function showValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text;
}

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

/** Field-level before → after, over the keys both sides carry. */
export function diffFields(beforeJson: string | null, afterJson: string | null): { changes: FieldChange[]; more: number } {
  const before = parseJson(beforeJson);
  const after = parseJson(afterJson);
  if (!before || !after) return { changes: [], more: 0 };
  const changed = Object.keys(after).filter(
    (key) => key in before && !DIFF_IGNORED.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  return {
    changes: changed.slice(0, MAX_DIFF_FIELDS).map((field) => ({ field, before: showValue(before[field]), after: showValue(after[field]) })),
    more: Math.max(0, changed.length - MAX_DIFF_FIELDS),
  };
}

export interface ActionSummary {
  /** The tag, e.g. "Edited", "Approved photo". Consecutive equal tags collapse. */
  tag: string;
  tone: "neutral" | "good" | "bad";
  changes: FieldChange[];
  moreChanges: number;
  /** One-line extra detail (publish counts). */
  note?: string;
  prUrl?: string;
}

export function summarizeAction(row: AuditActionRow): ActionSummary {
  const after = parseJson(row.after_json) ?? {};
  const diff = diffFields(row.before_json, row.after_json);
  const base = { changes: diff.changes, moreChanges: diff.more };
  if (row.action === "publish") {
    const n = (key: string) => (typeof after[key] === "number" ? (after[key] as number) : 0);
    const parts = [
      n("promotedCount") && `${n("promotedCount")} new`,
      n("editedCount") && `${n("editedCount")} edited`,
      n("archivedCount") && `${n("archivedCount")} removed`,
    ].filter(Boolean);
    return {
      tag: "Published",
      tone: "good",
      changes: [],
      moreChanges: 0,
      note: parts.length ? parts.join(", ") : undefined,
      prUrl: typeof after.prUrl === "string" && after.prUrl.startsWith("https://github.com/") ? after.prUrl : undefined,
    };
  }
  if (row.action === "archive") return { tag: "Removed", tone: "bad", ...base };
  if (row.action === "create") return { tag: "Added", tone: "good", changes: [], moreChanges: 0 };
  if (row.entity === "box_photo" || row.entity === "box_adopter") {
    const what = row.entity === "box_photo" ? "photo" : "sponsor";
    if (after.status === "approved") return { tag: `Approved ${what}`, tone: "good", ...base };
    if (after.status === "rejected") return { tag: `Rejected ${what}`, tone: "bad", ...base };
    return { tag: `Updated ${what}`, tone: "neutral", ...base };
  }
  if (row.entity === "box_checkin") {
    return after.visibility === "hidden"
      ? { tag: "Hid check-in", tone: "bad", changes: [], moreChanges: 0 }
      : { tag: "Unhid check-in", tone: "neutral", changes: [], moreChanges: 0 };
  }
  if (row.entity === "box_host_alert") {
    return row.before_json === null
      ? { tag: "Added host alert", tone: "neutral", changes: [], moreChanges: 0, note: showValue(after.email) }
      : { tag: "Removed host alert", tone: "neutral", changes: [], moreChanges: 0, note: showValue(after.email) };
  }
  if (after.event === "public_submission_marked_done") return { tag: "Marked suggestion done", tone: "good", changes: [], moreChanges: 0 };
  if (row.from_proposal) return { tag: "Approved data refresh", tone: "good", ...base };
  return { tag: "Edited", tone: "neutral", ...base };
}

export function isAutomaticActor(actor: string): boolean {
  return !actor.includes("@");
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export type ActivityItem =
  | { kind: "action"; at: string; row: AuditActionRow }
  | { kind: "auth"; at: string; row: AuthEventRow };

export type ActivityGroup =
  | { kind: "session"; key: string; at: string; signIn: AuthEventRow | null; email: string | null; items: ActivityItem[] }
  | { kind: "automatic"; key: string; at: string; actor: string; items: ActivityItem[] }
  | { kind: "unrecorded"; key: string; at: string; email: string; items: ActivityItem[] }
  | { kind: "failed"; key: string; at: string; row: AuthEventRow }
  | { kind: "event"; key: string; at: string; row: AuthEventRow };

export interface ActivityDay {
  ymd: string;
  label: string;
  groups: ActivityGroup[];
}

type MutableGroup = Exclude<ActivityGroup, { kind: "failed" } | { kind: "event" }>;

/** Merges one page of rows into days → groups (see file header for the rules). */
export function buildActivityDays(page: Pick<ActivityPage, "actions" | "events" | "sessionHeaders">): ActivityDay[] {
  const groups = new Map<string, ActivityGroup>();
  const signIns = new Map<string, AuthEventRow>();
  for (const row of [...page.sessionHeaders, ...page.events]) {
    if (row.event === "sign_in" && row.session_id) signIns.set(row.session_id, row);
  }

  const sessionGroup = (sessionId: string, email: string | null): MutableGroup => {
    const key = `session:${sessionId}`;
    let group = groups.get(key) as MutableGroup | undefined;
    if (!group) {
      const signIn = signIns.get(sessionId) ?? null;
      group = { kind: "session", key, at: signIn?.created_at ?? "", signIn, email: signIn?.email ?? email, items: [] };
      groups.set(key, group);
    }
    return group;
  };
  const add = (group: MutableGroup, item: ActivityItem) => {
    group.items.push(item);
    if (item.at > group.at) group.at = item.at;
  };

  for (const row of page.events) {
    if (row.event === "sign_in_failed") {
      groups.set(`failed:${row.id}`, { kind: "failed", key: `failed:${row.id}`, at: row.created_at, row });
    } else if (row.session_id) {
      const group = sessionGroup(row.session_id, row.email);
      if (row.event !== "sign_in") add(group, { kind: "auth", at: row.created_at, row });
    } else {
      groups.set(`event:${row.id}`, { kind: "event", key: `event:${row.id}`, at: row.created_at, row });
    }
  }

  for (const row of page.actions) {
    const item: ActivityItem = { kind: "action", at: row.timestamp, row };
    if (isAutomaticActor(row.actor_email)) {
      const key = `automatic:${localYmd(row.timestamp)}:${row.actor_email}`;
      let group = groups.get(key) as MutableGroup | undefined;
      if (!group) {
        group = { kind: "automatic", key, at: row.timestamp, actor: row.actor_email, items: [] };
        groups.set(key, group);
      }
      add(group, item);
    } else if (row.session_id) {
      add(sessionGroup(row.session_id, row.actor_email), item);
    } else {
      const email = row.actor_email.toLowerCase();
      const key = `unrecorded:${localYmd(row.timestamp)}:${email}`;
      let group = groups.get(key) as MutableGroup | undefined;
      if (!group) {
        group = { kind: "unrecorded", key, at: row.timestamp, email, items: [] };
        groups.set(key, group);
      }
      add(group, item);
    }
  }

  const days = new Map<string, ActivityDay>();
  const sorted = [...groups.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  for (const group of sorted) {
    if ("items" in group) group.items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const ymd = localYmd(group.at);
    let day = days.get(ymd);
    if (!day) {
      day = { ymd, label: formatDayLabel(ymd), groups: [] };
      days.set(ymd, day);
    }
    day.groups.push(group);
  }
  return [...days.values()];
}
