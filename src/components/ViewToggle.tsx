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
   */
  size?: "sm" | "md";
}

const SIZE_STYLES: Record<"sm" | "md", { height: number; iconSize: number; paddingX: string }> = {
  sm: { height: 28, iconSize: 13, paddingX: "px-2.5" },
  md: { height: 38, iconSize: 14, paddingX: "px-3" },
};

export default function ViewToggle({ mode, onChange, locale = "en", size = "sm" }: ViewToggleProps) {
  const { height, iconSize, paddingX } = SIZE_STYLES[size];
  return (
    <div
      role="group"
      aria-label={t("view.toggleAria", locale)}
      className="flex items-center rounded-full border border-[var(--color-bone-300)] bg-[var(--color-bone-100)] overflow-hidden"
      style={{ height }}
    >
      {(["map", "list"] as const).map((m) => {
        const active = mode === m;
        const Icon = m === "map" ? MapIcon : ListIcon;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m)}
            className={
              `flex items-center gap-1 ${paddingX} text-xs font-semibold transition-colors duration-150 h-full ` +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
              (active
                ? "bg-[var(--color-ink-700)] text-[var(--color-bone-50)]"
                : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]")
            }
          >
            <Icon size={iconSize} aria-hidden />
            {t(m === "map" ? "view.map" : "view.list", locale)}
          </button>
        );
      })}
    </div>
  );
}
