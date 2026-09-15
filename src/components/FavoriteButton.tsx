"use client";

import { Star } from "lucide-react";
import { useIsFavorite, toggleFavorite } from "@/lib/favorites";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

interface FavoriteButtonProps {
  venueId: string;
  venueName?: string;
  locale?: Locale;
  size?: number;
}

export default function FavoriteButton({
  venueId,
  venueName,
  locale = "en",
  size = 20,
}: FavoriteButtonProps) {
  const favorited = useIsFavorite(venueId);

  const label = venueName
    ? favorited
      ? t("favorite.remove", locale, { name: venueName })
      : t("favorite.add", locale, { name: venueName })
    : favorited
    ? t("favorite.removeGeneric", locale)
    : t("favorite.addGeneric", locale);

  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      onClick={() => toggleFavorite(venueId)}
      className={
        // 36px -> 44px hit area; negative margin cancels the growth so rows
        // this sits in (BottomSheet/DesktopVenueWindow headers) don't shift
        // (mobile review #12).
        "shrink-0 flex items-center justify-center w-11 h-11 -m-1 rounded-md transition-colors " +
        "hover:bg-[var(--color-bone-100)] " +
        PRESS_FEEDBACK + " " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
      }
    >
      <Star
        size={size}
        aria-hidden
        fill={favorited ? "currentColor" : "none"}
        style={{ color: favorited ? "var(--color-clay-500)" : "var(--color-ink-400)" }}
      />
    </button>
  );
}
