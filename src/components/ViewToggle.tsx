"use client";

import { Map as MapIcon, List as ListIcon } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

export type ViewMode = "map" | "list";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  locale?: Locale;
  /**
   * When true the "map" button is rendered disabled rather than silently
   * ignoring taps. WHY this exists: MapWrapper suppresses the map mount when
   * the map can't load (#165), so choosing "map" there is a no-op. That
   * no-op was tolerable while the only way to reach this control was opening
   * the menu; #191 puts it on the main screen, where a resident tapping a
   * live-looking button and getting nothing back is a dead end with no
   * feedback. Disabled state says "not available" instead of saying nothing.
   */
  mapDisabled?: boolean;
}

export default function ViewToggle({
  mode,
  onChange,
  locale = "en",
  mapDisabled = false,
}: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label={t("view.toggleAria", locale)}
      // Flush with its container (Kyle, 2026-09-16): SearchBar is the only
      // caller now (HamburgerMenu's row was deleted with the bottom nav), and
      // it wants the switch to read as the search pill's own right end — full
      // height, no border of its own. The bordered/28px and 36px-tall
      // treatments this used to also support (HamburgerMenu row, an earlier
      // SearchBar instance) had no other callers left; collapsed to this one.
      className="flex items-center rounded-full bg-[var(--color-bone-100)] overflow-hidden"
      style={{ height: "100%" }}
    >
      {(["map", "list"] as const).map((m) => {
        const active = mode === m;
        const Icon = m === "map" ? MapIcon : ListIcon;
        const disabled = m === "map" && mapDisabled;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={
              "flex items-center gap-1 px-3.5 text-xs font-semibold transition-colors duration-150 h-full " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
              (disabled
                ? "text-[var(--color-ink-400)] opacity-60 cursor-not-allowed "
                : "") +
              (active
                ? "bg-[var(--color-ink-700)] text-[var(--color-bone-50)]"
                : disabled
                  ? ""
                  : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]")
            }
          >
            <Icon size={14} aria-hidden />
            {/*
              Icons only on phones (under md, 768px), words from md up (Kyle,
              2026-09-16): on a phone the words cost the search box typing
              room — ~65px in Spanish — and the map/list glyphs read on their
              own there; laptops have the room, so the words stay. sr-only
              (not `hidden`) keeps the accessible name — the icon is
              aria-hidden. This replaces the earlier "labels at every width,
              icon-only only with a chip under 400px" rule (spec §4.1/§4.3).
            */}
            <span className="max-md:sr-only">
              {t(m === "map" ? "view.map" : "view.list", locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
