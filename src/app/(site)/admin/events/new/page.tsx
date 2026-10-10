/**
 * /admin/events/new — "Add event" (#757). Auth gate + the place-picker's
 * venue list on the server, the form (EventForm) on the client; same split as
 * /admin/venues/new. If the venue list can't be read the form still works
 * with a typed address (venues is an older table than events, so this is
 * defensive only).
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import { loadVenueChoices, type VenueChoice } from "@/lib/adminEventReads";
import AdminNav from "@/components/AdminNav";
import EventForm from "@/components/EventForm";

export default async function NewEventPage() {
  let email: string;
  let showActivity = false;
  let venues: VenueChoice[] = [];
  let navCounts: AdminNavCounts;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;
    [venues, navCounts] = await Promise.all([loadVenueChoices(db).catch(() => [] as VenueChoice[]), loadAdminNavCounts(db)]);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="events" counts={navCounts} showActivity={showActivity} />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Add event</h2>
        <EventForm venues={venues} />
      </div>
    </main>
  );
}
