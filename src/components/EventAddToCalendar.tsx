"use client";

/**
 * EventAddToCalendar — the one interactive piece of the event page (#762):
 * the "Add to calendar" button. It is a separate client island because making
 * the .ics file needs the browser (Blob + a download link); everything else on
 * the page is server HTML that reads fine without JavaScript. The file itself
 * comes from the same helper the map card uses (src/lib/eventCalendar.ts).
 */

import { CalendarPlus } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { downloadEventCalendar } from "@/lib/eventCalendar";
import { eventSecondaryButton } from "@/lib/interactionStyles";
import type { PublicEventDetail } from "@/lib/events";

export default function EventAddToCalendar({ event, locale }: { event: PublicEventDetail; locale: Locale }) {
  return (
    <button
      type="button"
      onClick={() => downloadEventCalendar(event, locale)}
      className={eventSecondaryButton("w-full")}
    >
      <CalendarPlus size={16} aria-hidden />
      {t("events.card.calendar", locale)}
    </button>
  );
}
