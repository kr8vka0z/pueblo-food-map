/**
 * /admin/events — the Events tab (#757): list of special events with name,
 * date, status and an edit link; "Add event" lives in the list's empty state
 * and above the table.
 *
 * Same chain as every admin page (AGENTS.md "Admin authentication"):
 * getAdminDb() gates the page and fails closed via handlePageAuthError. The
 * events READ deliberately fails soft on its own (`.catch`), apart from that gate: the
 * `events` table may not exist yet (the production migration is a manual
 * step), and a missing table must show EventsList's "couldn't load, retry"
 * panel, not a 500. Auth failures still redirect/403 as usual. Events are
 * live (no Publish step), so this page has no Publish panel.
 *
 * "Sent in by the public" (#883) sits above the list: pending "Share an
 * event" submissions, read the same fail-soft way (the event_submissions
 * table may not exist yet). A failed read shows no section rather than an
 * error, because the events list right under it already reports a D1 problem.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts } from "@/lib/adminNavCounts";
import { loadEventList } from "@/lib/adminEventReads";
import AdminNav from "@/components/AdminNav";
import EventsList from "@/components/EventsList";
import EventSubmissionsList from "@/components/EventSubmissionsList";
import { loadPendingEventSubmissions } from "@/lib/eventSubmissions";

export default async function AdminEventsPage() {
  const { db, identity } = await getAdminDb(await headers()).catch(handlePageAuthError);
  const [events, navCounts, submissions] = await Promise.all([
    loadEventList(db).catch(() => null), // null = "couldn't load" state, see header
    loadAdminNavCounts(db),
    loadPendingEventSubmissions(db).catch(() => []),
  ]);

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={identity.email} active="events" counts={navCounts} showActivity={identity.isOwner === true} />
      <div className="space-y-4 px-4 py-6 sm:px-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Events</h2>
        <EventSubmissionsList items={submissions} />
        <EventsList events={events} />
      </div>
    </main>
  );
}
