/**
 * eventCalendar.ts — "Add to calendar" for one event: builds the .ics from the
 * event in the page's language and downloads it. Browser-only (downloadIcs).
 *
 * WHY it is its own file: the map card (EventCardBody) and the event page
 * (EventAddToCalendar, #762) must produce the same file, so the filename rule,
 * the description layout and the page URL live in one place instead of two
 * copies that could drift.
 */

import { t, type Locale } from "@/lib/i18n";
import { localizeEvent } from "@/lib/eventCard";
import { buildIcs, downloadIcs } from "@/lib/eventIcs";
import type { PublicEventDetail } from "@/lib/events";
import { safeUrl } from "@/lib/safeUrl";
import { eventShareUrl } from "@/lib/share";

// ASCII-only so every OS accepts the download name; the real name is in the file.
export function icsFilename(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${slug || "event"}.ics`;
}

export function downloadEventCalendar(event: PublicEventDetail, locale: Locale): void {
  const text = localizeEvent(event, locale);
  const moreInfo = safeUrl(event.link_url);
  const parts = [text.description];
  if (text.whatToBring) parts.push(`${t("events.card.bring", locale)}: ${text.whatToBring}`);
  if (moreInfo) parts.push(`${t("events.card.moreInfo", locale)}: ${moreInfo}`);
  downloadIcs(
    icsFilename(text.name),
    buildIcs({
      id: event.id,
      summary: text.name,
      description: parts.filter(Boolean).join("\n\n"),
      location: event.address,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      url: eventShareUrl(event.id, locale),
    }),
  );
}
