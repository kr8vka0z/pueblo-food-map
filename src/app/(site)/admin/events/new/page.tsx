/**
 * /admin/events/new — "Add event" (#757). Auth gate + the place-picker's
 * venue list on the server, the form (EventForm) on the client; same split as
 * /admin/venues/new. If the venue list can't be read the form still works
 * with a typed address (venues is an older table than events, so this is
 * defensive only).
 *
 * `?from=<submissionId>` (#883): "Make it a draft event" on a public
 * submission whose address couldn't be located lands here, the form filled
 * from that submission with the address typed and the pin unset, for the
 * admin to locate. A submission that is no longer pending opens the plain
 * empty form (the save would 409 anyway).
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import { loadVenueChoices, type VenueChoice } from "@/lib/adminEventReads";
import AdminNav from "@/components/AdminNav";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import { loadPendingEventSubmission, parseSubmissionPayload } from "@/lib/eventSubmissions";
import { utcIsoToPuebloLocal } from "@/lib/eventTime";

export default async function NewEventPage({ searchParams }: { searchParams?: Promise<{ from?: string }> }) {
  const { from } = searchParams ? await searchParams : {};
  let email: string;
  let showActivity = false;
  let venues: VenueChoice[] = [];
  let navCounts: AdminNavCounts;
  let fromSubmission: { id: string; values: Partial<EventFormValues> } | null = null;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;
    [venues, navCounts] = await Promise.all([loadVenueChoices(db).catch(() => [] as VenueChoice[]), loadAdminNavCounts(db)]);
    const sub = from ? await loadPendingEventSubmission(db, from).catch(() => null) : null;
    const p = sub ? parseSubmissionPayload(sub.payload) : null;
    if (sub && p) {
      fromSubmission = {
        id: sub.id,
        values: {
          name: p.name,
          host: p.host,
          description: p.description,
          whatToBring: p.whatToBring ?? "",
          startsLocal: utcIsoToPuebloLocal(p.startsAt),
          endsLocal: utcIsoToPuebloLocal(p.endsAt),
          address: p.address,
          venueName: p.venueName ?? "",
          linkUrl: p.linkUrl ?? "",
          linkLabel: p.linkLabel,
        },
      };
    }
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="events" counts={navCounts} showActivity={showActivity} />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Add event</h2>
        {fromSubmission && (
          <p className="max-w-2xl text-sm text-[var(--color-ink-700)]">
            Sent in by the public. We couldn&rsquo;t find the address on the map: press Find location or pick a place, then
            save the draft. The flyer is added when you save.
          </p>
        )}
        <EventForm venues={venues} initialValues={fromSubmission?.values} submissionId={fromSubmission?.id} />
      </div>
    </main>
  );
}
