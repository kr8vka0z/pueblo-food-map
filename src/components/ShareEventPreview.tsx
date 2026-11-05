"use client";

/**
 * ShareEventPreview — the live card on the "Share an event" page (#883): the
 * real EventCardBody, in its `preview` mode, fed from the form's current
 * values, so what the sender sees is exactly the card the map will show.
 *
 * toPreviewEvent() maps the form into the PublicEventDetail the card reads.
 * Times are Pueblo wall clock converted with the same puebloLocalToUtcIso
 * the server uses; until the date and both times make a valid range they
 * stay empty and the card shows its "add a date" placeholder. There are no
 * coordinates yet (the admin's convert geocodes the address), so lat/lng are
 * 0 and the preview card never links directions.
 */

import { useId } from "react";
import type { Locale } from "@/lib/i18n";
import type { PublicEventDetail } from "@/lib/events";
import { puebloLocalToUtcIso } from "@/lib/eventTime";
import EventCardBody from "@/components/EventCardBody";
import type { ShareEventFlyer, ShareEventValues } from "@/components/ShareEventForm";

const noop = () => {};

export function toPreviewEvent(v: ShareEventValues, flyer: ShareEventFlyer | null): PublicEventDetail {
  const startsAt = v.date && v.start ? puebloLocalToUtcIso(`${v.date}T${v.start}`) : null;
  const endsAt = v.date && v.end ? puebloLocalToUtcIso(`${v.date}T${v.end}`) : null;
  const timed = startsAt && endsAt && endsAt > startsAt;
  return {
    id: "preview",
    status: "published",
    name: v.name.trim(),
    name_es: null,
    host: v.host.trim() || null,
    host_es: null,
    description: v.description.trim() || null,
    description_es: null,
    what_to_bring: v.whatToBring.trim() || null,
    what_to_bring_es: null,
    cancel_note: null,
    cancel_note_es: null,
    starts_at: timed ? startsAt : "",
    ends_at: timed ? endsAt : "",
    lat: 0,
    lng: 0,
    address: v.address.trim(),
    venue_id: null,
    venue_name: v.venueName.trim() || null,
    link_url: v.linkUrl.trim() || null,
    link_label: v.linkLabel,
    flyer: flyer ? { src: flyer.src, width: flyer.width, height: flyer.height, alt: null, alt_es: null } : null,
  };
}

export default function ShareEventPreview({
  values,
  flyer,
  locale,
}: {
  values: ShareEventValues;
  flyer: ShareEventFlyer | null;
  locale: Locale;
}) {
  const headingId = useId();
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-bone-50)] elevation-2">
      <EventCardBody
        event={toPreviewEvent(values, flyer)}
        locale={locale}
        userLocation={null}
        headingId={headingId}
        onClose={noop}
        onSeeOpenNow={noop}
        layout="panel"
        preview
      />
    </div>
  );
}
