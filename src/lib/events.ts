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
  status: EventStatus;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  published_at: string | null;
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
}

// Explicit column list (never SELECT *) so a future internal column can't
// leak into the public response by accident. `ends_at > ?` compares ISO-8601
// UTC text, which sorts chronologically (eventTime.ts always writes that shape).
export const PUBLIC_EVENTS_SQL = `SELECT id, name, name_es, host, host_es, description, description_es,
    what_to_bring, what_to_bring_es, starts_at, ends_at, lat, lng, address, venue_id, link_url
  FROM events
  WHERE status = 'published' AND ends_at > ?
  ORDER BY starts_at ASC`;

/** Published events that have not ended, soonest first. Throws on a D1 failure (the route turns that into an uncached empty list). */
export async function loadPublicEvents(db: D1Database, now: Date = new Date()): Promise<PublicEvent[]> {
  const { results } = await db.prepare(PUBLIC_EVENTS_SQL).bind(now.toISOString()).all<PublicEvent>();
  return results;
}
