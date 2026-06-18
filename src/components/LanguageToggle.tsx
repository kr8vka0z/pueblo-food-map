"use client";

/**
 * LanguageToggle — EN | ES segmented pill toggle.
 *
 * Consumes LocaleContext via useLocale(). Renders a segmented button group:
 *   - Active locale has a filled background.
 *   - Inactive locale is outlined / text-only.
 *   - Keyboard accessible: Tab to focus, Enter/Space to activate.
 *   - Screen reader: announces "Language: English, button" / "Language: Spanish, button".
 *
 * Spec: github.com/kr8vka0z/pueblo-food-map/issues/68
 */

import { useLocale } from "@/lib/LocaleContext";
import { t, type Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

const SR_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
};

export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label={t("lang.toggle.label", locale)}
      className="flex items-center rounded-full border border-[var(--color-bone-300)] bg-[var(--color-bone-100)] overflow-hidden"
      style={{ height: 28 }}
    >
      {(["en", "es"] as Locale[]).map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            aria-label={`Language: ${SR_LABELS[l]}`}
            className={
              "px-3 text-xs font-semibold transition-colors duration-150 h-full " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset " +
              "focus-visible:ring-[var(--color-sage-500)] " +
              (active
                ? "bg-[var(--color-ink-700)] text-[var(--color-bone-50)]"
                : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]")
            }
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
