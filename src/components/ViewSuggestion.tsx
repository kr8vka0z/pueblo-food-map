"use client";

/**
 * ViewSuggestion — the one-line drop-down under an empty, focused search bar
 * that offers the OTHER view (#514). Takes the spot the old CategoryDropdown
 * (#95) used to occupy — #513 already deleted that dropdown along with the
 * search bar's category browse; this is the one thing tapping an EMPTY,
 * focused search bar now offers.
 *
 * Mockup (Kyle-approved, "YES - nailed it"): atlas-kb
 * "projects/Pueblo Food Map/Map-List Switch Redesign - Search Suggestion
 * Mockup.html", screens 1-2.
 *
 * Rendered by MapWrapper only while the search input is focused AND the
 * query is empty — mutually exclusive with SearchResultsPopover (query
 * non-empty + matches) and EmptySearchPopover (query non-empty + no
 * matches), which both require a non-empty query.
 *
 * Two directions, same spot, same row:
 *   - On the map: "See all places as a list" (list icon) → switches to list.
 *   - On the list: "Back to the map" (map icon) → switches to map — UNLESS
 *     the map can't mount (#165), in which case this renders NOTHING rather
 *     than a dead row (#514 spec: "hide the back-to-map lines rather than
 *     showing dead ones").
 */

import { Map as MapIcon, List as ListIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ViewMode } from "@/lib/useMapUI";
import type { Locale } from "@/lib/i18n";

interface ViewSuggestionProps {
  /** Current view mode — decides which direction the row offers. */
  mode: ViewMode;
  /** Places count honouring active filters (never the search query — this
   * row only ever renders while the query is empty). */
  count: number;
  /** Called when the row is tapped; parent switches view and closes the popover. */
  onSelect: () => void;
  /** #165 — true while the map can't mount. See file header. */
  mapDisabled?: boolean;
  locale?: Locale;
}

export default function ViewSuggestion({
  mode,
  count,
  onSelect,
  mapDisabled = false,
  locale = "en",
}: ViewSuggestionProps) {
  // Map is unreachable — no destination to offer, so offer nothing (rather
  // than a button that silently does nothing when tapped).
  if (mode === "list" && mapDisabled) return null;

  const goingToList = mode === "map";
  const label = t(
    goingToList ? "viewSuggestion.seeAsList" : "viewSuggestion.backToMap",
    locale,
  );
  const countText = t("viewSuggestion.placesCount", locale, { count: String(count) });
  const Icon = goingToList ? ListIcon : MapIcon;

  return (
    <div
      className={
        // Identical anchor to EmptySearchPopover / SearchResultsPopover.
        "absolute left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[520px] " +
        "top-[calc(56px+max(1rem,env(safe-area-inset-top)))] md:top-[84px] " +
        "z-[999] " +
        "bg-[var(--color-bone-50)] " +
        "rounded-[var(--radius-lg)] " +
        "elevation-2 " +
        "border border-[var(--color-bone-200)] " +
        "overflow-hidden"
      }
    >
      <button
        type="button"
        // Keeps the input focused through the click (same pattern as
        // SearchResultsPopover's rows) so the 150ms blur grace period
        // (MapWrapper's blurTimerRef) never races this tap closed before
        // onSelect fires.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSelect}
        className={
          "flex items-center gap-3 w-full px-4 h-[52px] text-left " +
          "text-sm font-semibold text-[var(--color-sage-700)] " +
          "hover:bg-[var(--color-bone-100)] transition-colors duration-100 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset " +
          "focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        <Icon size={18} aria-hidden className="shrink-0 text-[var(--color-sage-600)]" />
        <span className="flex-1 min-w-0">
          <span className="block truncate">{label}</span>
          <span className="block truncate text-xs font-normal text-[var(--color-ink-500)]">
            {countText}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[var(--color-ink-400)] text-lg leading-none">
          ›
        </span>
      </button>
    </div>
  );
}
