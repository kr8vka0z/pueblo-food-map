/**
 * /admin/events/[id]/edit — "Edit event" (#757). Auth gate, then the event
 * row + the place-picker's venue list; EventForm does the rest.
 *
 * The event read fails soft on its own (`.catch`, apart from the auth gate) so a
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
import { loadAdminNavCounts } from "@/lib/adminNavCounts";
import { loadEvent, loadVenueChoices, type VenueChoice } from "@/lib/adminEventReads";
import { utcIsoToPuebloLocal } from "@/lib/eventTime";
import { publicFlyerOf, type EventRow } from "@/lib/events";
import AdminNav from "@/components/AdminNav";
import EventForm, { type EventFormValues } from "@/components/EventForm";
import EventsList from "@/components/EventsList";
import { cardClass, formPageBodyClass, pageTitleClass, tapLinkClass } from "@/lib/adminCardStyles";

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
    venueName: e.venue_name ?? "",
    linkUrl: e.link_url ?? "",
    // NULL (every event saved before #882) is "Visit website", the form's default.
    linkLabel: e.link_label || "website",
    linkLabelCustom: e.link_label_custom ?? "",
    linkLabelCustomEs: e.link_label_custom_es ?? "",
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
  const { db, identity } = await getAdminDb(await headers()).catch(handlePageAuthError);
  const [event, venues, navCounts] = await Promise.all([
    loadEvent(db, id).catch(() => undefined), // undefined = the read failed
    loadVenueChoices(db).catch(() => [] as VenueChoice[]),
    loadAdminNavCounts(db),
  ]);

  if (event === null) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={identity.email} active="events" counts={navCounts} showActivity={identity.isOwner === true} />
      <div className={formPageBodyClass}>
        <h2 className={pageTitleClass}>Edit event</h2>
        {event === undefined ? (
          // null list = EventsList's shared "couldn't load / Retry" panel (Retry re-runs this page's read).
          <EventsList events={null} />
        ) : event.status === "archived" ? (
          <div className={cardClass}>
            <p className="text-sm text-[var(--color-ink-700)]">
              <span className="font-medium text-[var(--color-ink-900)]">{event.name}</span> is archived. Archiving is final, so it can&rsquo;t be edited.
            </p>
            <Link href="/admin/events" className={`mt-3 text-sm ${tapLinkClass}`}>
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
