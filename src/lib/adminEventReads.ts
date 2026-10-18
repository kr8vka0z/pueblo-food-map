/**
 * adminEventReads.ts — the admin Events pages' D1 reads (#757). Each throws
 * on a D1 failure; the PAGE decides what that means (the list and edit pages
 * catch it and render a "couldn't load, retry" panel, because the `events`
 * table may not exist yet in an environment whose migration hasn't been
 * applied — see src/app/api/public/events/route.ts for the same reason).
 */

import type { EventRow } from "@/lib/events";
import type { EventStatus } from "@/lib/adminEventValidation";

/** One row of the admin list — only what the table shows. */
export interface EventListItem {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
}

/** A place the admin can pick for an event; its coordinates and address are copied into the event. */
export interface VenueChoice {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// Archived events sort last; otherwise newest start first. 500 is far beyond
// a year of one-off events — a ceiling, not paging (upgrade path: paginate).
const LIST_SQL = `SELECT id, name, starts_at, ends_at, status FROM events
  ORDER BY (status = 'archived'), starts_at DESC LIMIT 500`;

export async function loadEventList(db: D1Database): Promise<EventListItem[]> {
  const { results } = await db.prepare(LIST_SQL).all<EventListItem>();
  return results;
}

export async function loadEvent(db: D1Database, id: string): Promise<EventRow | null> {
  return db.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
}

/** Non-archived venues for the place picker. Boxes included: they are places people go. */
export async function loadVenueChoices(db: D1Database): Promise<VenueChoice[]> {
  const { results } = await db
    .prepare("SELECT id, name, address, lat, lng FROM venues WHERE status != 'archived' ORDER BY name COLLATE NOCASE")
    .all<VenueChoice>();
  return results;
}
