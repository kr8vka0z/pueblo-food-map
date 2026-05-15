"use client";

import type { Locale } from "@/lib/i18n";

interface LocaleToggleProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
}

export default function LocaleToggle({ locale, onChange }: LocaleToggleProps) {
  return (
    <div
      className="flex items-center rounded-full border border-[var(--color-bone-300)] bg-[var(--color-bone-100)] overflow-hidden"
      style={{ height: 28 }}
      role="group"
      aria-label="Language selection"
    >
      {(["en", "es"] as Locale[]).map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-pressed={active}
            className={
              "px-3 text-xs font-semibold transition-colors duration-150 h-full " +
              (active
                ? "bg-[var(--color-ink-700)] text-[var(--color-bone-50)]"
                : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]")
            }
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
