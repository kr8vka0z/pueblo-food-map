"use client";

/**
 * VenueActionRow — the place card's first line (#917, DESIGN.md R4 and
 * "Card action row"): Call, Website, Share, Save, and on a computer the ×
 * at the right end. The phone card renders it inside VenueCardBody; the
 * computer panel renders it in DesktopVenueWindow's pinned top, so it stays
 * put while the card scrolls.
 *
 * WHY a missing Call or Website is a <button aria-disabled>, not a gap and
 * not a link: the row never shifts between places, and a keyboard or screen
 * reader still reaches it and hears why it's grey ("No phone number listed").
 * Not `disabled`, which would drop it from the Tab order.
 */

import { Phone, Globe } from "lucide-react";
import type { ReactNode } from "react";
import type { Venue } from "@/types/venue";
import { t, type Locale } from "@/lib/i18n";
import { safeUrl } from "@/lib/safeUrl";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { track, EVENTS } from "@/lib/analytics";
import ShareButton from "@/components/ShareButton";
import FavoriteButton from "@/components/FavoriteButton";

/**
 * The place's own website, or null. A Plentiful page is not the place's own
 * site: those places keep their See on Plentiful line lower in the card.
 * safeUrl: venue.url comes from OSM (anyone can edit); reject non-http(s).
 */
export function ownWebsite(venue: Pick<Venue, "url">): string | null {
  const url = safeUrl(venue.url);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase();
  return host === "plentiful.org" || host.endsWith(".plentiful.org") ? null : url;
}

// Same 48px box and -m-1 as ShareButton/FavoriteButton, so neighbours spaced
// gap-4 keep 8px between their hit areas (#233). `group relative` anchors the
// computer's label under the button.
const BUTTON =
  "group relative shrink-0 flex items-center justify-center w-12 h-12 -m-1 rounded-md transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] ";
const LIVE = BUTTON + "text-[var(--color-ink-400)] hover:bg-[var(--color-sage-100)] hover:text-[var(--color-ink-700)] " + PRESS_FEEDBACK;
// Grey: only the icon fades (ink 400 at 40%), so the keyboard ring stays full strength; no hover fill.
const MISSING = BUTTON + "cursor-default text-[var(--color-ink-400)]";

/** Computer only: a small dark label under the button on pointer and keyboard focus (a computer can't dial). */
function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={
        "pointer-events-none absolute left-0 top-[calc(100%+4px)] z-20 hidden whitespace-nowrap " +
        "rounded-[var(--radius-sm)] bg-[var(--color-ink-900)] px-2 py-1 text-xs font-medium text-[var(--color-bone-50)] " +
        "group-hover:block group-focus-visible:block"
      }
    >
      {children}
    </span>
  );
}

function Missing({ icon, label, compact }: { icon: ReactNode; label: string; compact: boolean }) {
  return (
    <button type="button" aria-disabled="true" aria-label={label} className={MISSING}>
      <span className="opacity-40">{icon}</span>
      {compact && <Tip>{label}</Tip>}
    </button>
  );
}

interface VenueActionRowProps {
  venue: Venue;
  locale: Locale;
  /** The computer panel: 18px icons and the hover labels. */
  compact?: boolean;
  /** The × at the row's right end (computer), or the phone's keyboard-only Close. */
  close?: ReactNode;
}

export default function VenueActionRow({ venue, locale, compact = false, close }: VenueActionRowProps) {
  const size = compact ? 18 : 20;
  const website = ownWebsite(venue);
  return (
    <div className="flex items-center gap-4">
      {venue.phone ? (
        <a
          href={`tel:${venue.phone}`}
          onClick={() => void track(EVENTS.CALL_CLICKED, { venueId: venue.id })}
          aria-label={t("action.call", locale, { phone: venue.phone })}
          className={LIVE}
        >
          <Phone size={size} aria-hidden />
          {compact && <Tip>{venue.phone}</Tip>}
        </a>
      ) : (
        <Missing icon={<Phone size={size} aria-hidden />} label={t("action.noPhone", locale)} compact={compact} />
      )}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void track(EVENTS.WEBSITE_CLICKED, { venueId: venue.id })}
          aria-label={t("action.website", locale, { name: venue.name })}
          title={t("action.website", locale, { name: venue.name })}
          className={LIVE}
        >
          <Globe size={size} aria-hidden />
        </a>
      ) : (
        <Missing icon={<Globe size={size} aria-hidden />} label={t("action.noWebsite", locale)} compact={compact} />
      )}
      <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={size} />
      <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={size} />
      {close}
    </div>
  );
}
