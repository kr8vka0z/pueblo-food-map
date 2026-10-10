/**
 * events.ts — types and the public read for special events (#757, umbrella
 * #156; table in migrations/0018_events.sql).
 *
 * Events are LIVE (read from D1 at request time), never part of the venue
 * Publish snapshot — same model as blessing boxes (src/lib/blessingBoxes.ts).
 * The public shape deliberately omits every internal column (created_by /
 * updated_by, timestamps, status, cancel notes, flyer_key): the feed only
 * ever carries published events that have not ended, so the extra fields
 * would either be constant (status) or belong to a later slice (flyer).
 */

import type { EventStatus } from "@/lib/adminEventValidation";
import { flyerPublicPath } from "@/lib/eventFlyers";

/** One row of the `events` table, as admin pages read it. */
export interface EventRow {
  id: string;
  name: string;
  name_es: string | null;
  host: string | null;
  host_es: string | null;
  description: string | null;
  description_es: string | null;
  what_to_bring: string | null;
  what_to_bring_es: string | null;
  cancel_note: string | null;
  cancel_note_es: string | null;
  starts_at: string;
  ends_at: string;
  lat: number;
  lng: number;
  address: string;
  venue_id: string | null;
  link_url: string | null;
  flyer_key: string | null;
  // Added by migration 0019; absent on a database that has not applied it yet.
  flyer_width?: number | null;
  flyer_height?: number | null;
  flyer_alt?: string | null;
  flyer_alt_es?: string | null;
  status: EventStatus;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  published_at: string | null;
}

/**
 * What the card needs to show the flyer (#760): where to load it, the stored
 * size (so the space is reserved before it loads), and the admin's alt text.
 * `src` is a path on this site, never the raw R2 key.
 */
export interface PublicFlyer {
  src: string;
  width: number;
  height: number;
  alt: string | null;
  alt_es: string | null;
}

/** What GET /api/public/events returns per event. */
export interface PublicEvent {
  id: string;
  name: string;
  name_es: string | null;
  host: string | null;
  host_es: string | null;
  description: string | null;
  description_es: string | null;
  what_to_bring: string | null;
  what_to_bring_es: string | null;
  starts_at: string;
  ends_at: string;
  lat: number;
  lng: number;
  address: string;
  venue_id: string | null;
  link_url: string | null;
  /** Absent or null when the event has no flyer, or migration 0019 is not applied yet. */
  flyer?: PublicFlyer | null;
}

/**
 * What GET /api/public/events/[id] returns (#759): the feed's fields plus the
 * two things a shared link to a finished event needs — whether it was
 * cancelled, and the admin's note. `cancel_note*` is null unless the event is
 * cancelled, so a stale note on a republished event can never surface.
 */
export interface PublicEventDetail extends PublicEvent {
  status: "published" | "cancelled";
  cancel_note: string | null;
  cancel_note_es: string | null;
}

// Explicit column list (never SELECT *) so a future internal column can't
// leak into the public response by accident. `ends_at > ?` compares ISO-8601
// UTC text, which sorts chronologically (eventTime.ts always writes that shape).
export const PUBLIC_EVENTS_SQL = `SELECT id, name, name_es, host, host_es, description, description_es,
    what_to_bring, what_to_bring_es, starts_at, ends_at, lat, lng, address, venue_id, link_url
  FROM events
  WHERE status = 'published' AND ends_at > ?
  ORDER BY starts_at ASC`;

// The same query plus the flyer columns (#760). The one above stays valid on a
// database that has not applied migration 0019: the loaders try this one first
// and fall back, so a deploy that reaches production before its migration
// still serves every event, just without flyers. It is DERIVED from the older
// string (columns spliced in before FROM), so the two WHERE clauses can never drift.
const FLYER_COLUMNS = "flyer_key, flyer_width, flyer_height, flyer_alt, flyer_alt_es";
const withFlyerColumns = (sql: string): string => sql.replace("\n  FROM events", `,\n    ${FLYER_COLUMNS}\n  FROM events`);
export const PUBLIC_EVENTS_WITH_FLYER_SQL = withFlyerColumns(PUBLIC_EVENTS_SQL);

interface FlyerColumns {
  flyer_key?: string | null;
  flyer_width?: number | null;
  flyer_height?: number | null;
  flyer_alt?: string | null;
  flyer_alt_es?: string | null;
}

/**
 * True only for the database's "that column isn't there" error, i.e. migration
 * 0019 has not been applied. Callers fall back only on this and rethrow
 * everything else.
 */
export function isMissingColumnError(err: unknown): boolean {
  return err instanceof Error && /no such column|has no column/i.test(err.message);
}

/** The card-ready flyer for a row's five flyer columns, or null (none stored, columns missing, or a key outside our shape). */
export function publicFlyerOf(row: FlyerColumns): PublicFlyer | null {
  const src = row.flyer_key ? flyerPublicPath(row.flyer_key) : null;
  return src && row.flyer_width && row.flyer_height
    ? { src, width: row.flyer_width, height: row.flyer_height, alt: row.flyer_alt ?? null, alt_es: row.flyer_alt_es ?? null }
    : null;
}

/** Folds the five flyer columns into one `flyer` object (or null), so the raw R2 key never reaches the public JSON. */
function withPublicFlyer<T extends FlyerColumns>(row: T): Omit<T, keyof FlyerColumns> & { flyer: PublicFlyer | null } {
  const { flyer_key, flyer_width, flyer_height, flyer_alt, flyer_alt_es, ...rest } = row;
  return { ...rest, flyer: publicFlyerOf({ flyer_key, flyer_width, flyer_height, flyer_alt, flyer_alt_es }) };
}

/** Published events that have not ended, soonest first. Throws on a D1 failure (the route turns that into an uncached empty list). */
export async function loadPublicEvents(db: D1Database, now: Date = new Date()): Promise<PublicEvent[]> {
  const iso = now.toISOString();
  try {
    const { results } = await db.prepare(PUBLIC_EVENTS_WITH_FLYER_SQL).bind(iso).all<PublicEvent & FlyerColumns>();
    return results.map(withPublicFlyer) as PublicEvent[];
  } catch (err) {
    // Migration 0019 not applied yet. Any other error (a transient D1 failure,
    // a missing table) is rethrown: the route turns it into its degraded,
    // uncached answer instead of silently serving flyer-less data as healthy.
    if (!isMissingColumnError(err)) throw err;
    const { results } = await db.prepare(PUBLIC_EVENTS_SQL).bind(iso).all<PublicEvent>();
    return results;
  }
}

/**
 * The events the sitemap lists (#762): published and not yet ended (upcoming
 * and live), soonest first, with `updated_at` as the sitemap's last-modified.
 * Cancelled, draft and archived events are never listed. Throws on a D1
 * failure; the sitemap catches it and lists no events. Reads only columns that
 * exist since migration 0018, so it also works before 0019 is applied.
 */
export async function loadSitemapEvents(db: D1Database, now: Date = new Date()): Promise<{ id: string; updated_at: string }[]> {
  const { results } = await db
    .prepare("SELECT id, updated_at FROM events WHERE status = 'published' AND ends_at > ? ORDER BY starts_at ASC")
    .bind(now.toISOString())
    .all<{ id: string; updated_at: string }>();
  return results;
}

// Same explicit column list as the feed plus the three detail columns. Only
// 'published' (including after it ended) and 'cancelled' are readable: a draft
// or archived row answers exactly like an unknown id, so the response never
// reveals that a draft exists.
export const PUBLIC_EVENT_BY_ID_SQL = `SELECT id, name, name_es, host, host_es, description, description_es,
    what_to_bring, what_to_bring_es, starts_at, ends_at, lat, lng, address, venue_id, link_url,
    status, cancel_note, cancel_note_es
  FROM events
  WHERE id = ? AND status IN ('published', 'cancelled')`;

export const PUBLIC_EVENT_BY_ID_WITH_FLYER_SQL = withFlyerColumns(PUBLIC_EVENT_BY_ID_SQL);

/** One event for a shared link, or null (unknown, draft, archived). Throws on a D1 failure (the route turns that into an uncached 404). */
export async function loadPublicEventById(db: D1Database, id: string): Promise<PublicEventDetail | null> {
  let row: PublicEventDetail | null;
  try {
    const found = await db.prepare(PUBLIC_EVENT_BY_ID_WITH_FLYER_SQL).bind(id).first<PublicEventDetail & FlyerColumns>();
    row = found ? (withPublicFlyer(found) as PublicEventDetail) : null;
  } catch (err) {
    // Migration 0019 not applied yet — see loadPublicEvents.
    if (!isMissingColumnError(err)) throw err;
    row = await db.prepare(PUBLIC_EVENT_BY_ID_SQL).bind(id).first<PublicEventDetail>();
  }
  if (!row) return null;
  return row.status === "cancelled" ? row : { ...row, cancel_note: null, cancel_note_es: null };
}
