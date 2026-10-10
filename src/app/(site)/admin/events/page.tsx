/**
 * /admin/events — the Events tab (#757): list of special events with name,
 * date, status and an edit link; "Add event" lives in the list's empty state
 * and above the table.
 *
 * Same chain as every admin page (AGENTS.md "Admin authentication"):
 * getAdminDb() gates the page and fails closed via handlePageAuthError. The
 * events READ is deliberately a separate try/catch from that gate: the
 * `events` table may not exist yet (the production migration is a manual
 * step), and a missing table must show EventsList's "couldn't load, retry"
 * panel, not a 500. Auth failures still redirect/403 as usual. Events are
 * live (no Publish step), so this page has no Publish panel.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import { loadEventList, type EventListItem } from "@/lib/adminEventReads";
import AdminNav from "@/components/AdminNav";
import EventsList from "@/components/EventsList";

export default async function AdminEventsPage() {
  let email: string;
  let showActivity = false;
  let events: EventListItem[] | null = null;
  let navCounts: AdminNavCounts;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;
    [events, navCounts] = await Promise.all([
      loadEventList(db).catch(() => null), // null = "couldn't load" state, see header
      loadAdminNavCounts(db),
    ]);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="events" counts={navCounts} showActivity={showActivity} />
      <div className="space-y-4 px-4 py-6 sm:px-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Events</h2>
        <EventsList events={events} />
      </div>
    </main>
  );
}
