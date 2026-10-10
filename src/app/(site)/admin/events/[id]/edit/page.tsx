/**
 * /admin/events/[id]/edit — "Edit event" (#757). Auth gate, then the event
 * row + the place-picker's venue list; EventForm does the rest.
 *
 * The event read is its own try/catch (separate from the auth gate) so a
 * missing `events` table or a D1 blip renders a "couldn't load, retry"
 * panel instead of a 500; an unknown id is a real 404 (notFound()). An
 * archived event is read-only: archiving is final, same as venues, so the
 * page explains that instead of offering a form whose saves would 409.
 * `?saved=1` (set by EventForm after a create) shows the "Saved" banner with
 * the "view on map" link.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, type AdminNavCounts } from "@/lib/adminNavCounts";
import { loadEvent, loadVenueChoices, type VenueChoice } from "@/lib/adminEventReads";
import { utcIsoToPuebloLocal } from "@/lib/eventTime";
import { publicFlyerOf, type EventRow } from "@/lib/events";
import AdminNav from "@/components/AdminNav";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import EventsList from "@/components/EventsList";

function toFormValues(e: EventRow): Partial<EventFormValues> {
  return {
    name: e.name,
    nameEs: e.name_es ?? "",
    host: e.host ?? "",
    hostEs: e.host_es ?? "",
    description: e.description ?? "",
    descriptionEs: e.description_es ?? "",
    whatToBring: e.what_to_bring ?? "",
    whatToBringEs: e.what_to_bring_es ?? "",
    cancelNote: e.cancel_note ?? "",
    cancelNoteEs: e.cancel_note_es ?? "",
    startsLocal: utcIsoToPuebloLocal(e.starts_at),
    endsLocal: utcIsoToPuebloLocal(e.ends_at),
    venueId: e.venue_id ?? "",
    address: e.address,
    lat: String(e.lat),
    lng: String(e.lng),
    linkUrl: e.link_url ?? "",
  };
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = searchParams ? await searchParams : {};
  let email: string;
  let showActivity = false;
  let event: EventRow | null | undefined; // undefined = the read failed
  let venues: VenueChoice[] = [];
  let navCounts: AdminNavCounts;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    showActivity = identity.isOwner === true;
    [event, venues, navCounts] = await Promise.all([
      loadEvent(db, id).catch(() => undefined),
      loadVenueChoices(db).catch(() => [] as VenueChoice[]),
      loadAdminNavCounts(db),
    ]);
  } catch (err) {
    handlePageAuthError(err);
  }

  if (event === null) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="events" counts={navCounts} showActivity={showActivity} />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <h2 className="wordmark text-xl text-[var(--color-ink-900)]">Edit event</h2>
        {event === undefined ? (
          // null list = EventsList's shared "couldn't load / Retry" panel (Retry re-runs this page's read).
          <EventsList events={null} />
        ) : event.status === "archived" ? (
          <div className="max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4">
            <p className="text-sm text-[var(--color-ink-700)]">
              <span className="font-medium text-[var(--color-ink-900)]">{event.name}</span> is archived. Archiving is final, so it can&rsquo;t be edited.
            </p>
            <Link href="/admin/events" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2">
              Back to events
            </Link>
          </div>
        ) : (
          <EventForm
            venues={venues}
            eventId={event.id}
            initialValues={toFormValues(event)}
            status={event.status}
            expectedUpdatedAt={event.updated_at}
            initialFlyer={publicFlyerOf(event)}
            justSaved={saved === "1"}
          />
        )}
      </div>
    </main>
  );
}
