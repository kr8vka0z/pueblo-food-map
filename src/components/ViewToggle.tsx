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
   * Visual size. "sm" (28px) is the original HamburgerMenu row treatment.
   * "md" is the #191 inline-in-SearchBar instance — a 28px control on that
   * surface undershot the 36×36 CSS px tap-target floor a prior mobile
   * review fixed everywhere else on this bar (see SearchBar.tsx's
   * viewSwitch WHY comment), so a taller variant was added rather than
   * reusing 28px verbatim.
   *
   * WHY the "md" height constant is 38, not 36: Tailwind Preflight sets
   * box-sizing: border-box globally, and the group `<div>` below has a 1px
   * border on top and bottom. A `height: 36` style would render only a
   * 34px content box (36 − 2×1px border) for the `h-full` buttons inside
   * it — 2px short of the 36px floor. Setting 38 here nets a real 36px
   * button height once the border is subtracted.
   *
   * "flush" (Kyle, 2026-09-16) is the SearchBar instance now: no border of
   * its own and the full height of its container, so it reads as the pill's
   * right end rather than a button sitting inside it. The pill's own border
   * wraps it; buttons are 42px (phone) / 50px (desktop) tall.
   */
  size?: "sm" | "md" | "flush";
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
  /**
   * When true, BOTH labels go visually hidden under 400px wide (icon-only),
   * keeping their accessible names via sr-only. SearchBar sets this only
   * while a category chip is showing — docs/bottom-nav-spec.md §4.3: at 375px
   * chip + labelled toggle left ~48px of typing room.
   *
   * ponytail: one conditional, not a layout system. The 400px threshold is a
   * measured floor, not a breakpoint — if the chip's max-width ever changes,
   * re-measure rather than adjusting this number by eye.
   */
  collapseLabelsNarrow?: boolean;
}

const SIZE_STYLES: Record<"sm" | "md" | "flush", { height: number | string; iconSize: number; paddingX: string }> = {
  sm: { height: 28, iconSize: 13, paddingX: "px-2.5" },
  md: { height: 38, iconSize: 14, paddingX: "px-3" },
  flush: { height: "100%", iconSize: 14, paddingX: "px-3.5" },
};

export default function ViewToggle({
  mode,
  onChange,
  locale = "en",
  size = "sm",
  mapDisabled = false,
  collapseLabelsNarrow = false,
}: ViewToggleProps) {
  const { height, iconSize, paddingX } = SIZE_STYLES[size];
  return (
    <div
      role="group"
      aria-label={t("view.toggleAria", locale)}
      className={
        "flex items-center rounded-full bg-[var(--color-bone-100)] overflow-hidden" +
        (size === "flush" ? "" : " border border-[var(--color-bone-300)]")
      }
      style={{ height }}
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
              `flex items-center gap-1 ${paddingX} text-xs font-semibold transition-colors duration-150 h-full ` +
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
            <Icon size={iconSize} aria-hidden />
            {/*
              Both labels show at every width (docs/bottom-nav-spec.md §4.1):
              deleting the navy menu button returned the room, and a bare list
              glyph beside a map glyph made the resident guess. The one
              exception is collapseLabelsNarrow (§4.3). sr-only (not `hidden`)
              there keeps the accessible name — the icon is aria-hidden.
            */}
            <span className={collapseLabelsNarrow ? "max-[400px]:sr-only" : undefined}>
              {t(m === "map" ? "view.map" : "view.list", locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
