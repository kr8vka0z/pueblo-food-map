"use client";

import { Map as MapIcon, List as ListIcon } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

export type ViewMode = "map" | "list";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  locale?: Locale;
}

export default function ViewToggle({ mode, onChange, locale = "en" }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label={t("view.toggleAria", locale)}
      className="absolute left-1/2 -translate-x-1/2 top-[72px] z-[1000] flex items-center gap-0.5 rounded-full bg-[var(--color-bone-50)] p-0.5 elevation-2"
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
              "flex items-center gap-1.5 px-3 h-8 rounded-full text-sm font-medium transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              (active
                ? "bg-[var(--color-sage-500)] text-[var(--color-bone-50)]"
                : "text-[var(--color-ink-600)] hover:bg-[var(--color-bone-100)]")
            }
          >
            <Icon size={15} aria-hidden />
            {t(m === "map" ? "view.map" : "view.list", locale)}
          </button>
        );
      })}
    </div>
  );
}
