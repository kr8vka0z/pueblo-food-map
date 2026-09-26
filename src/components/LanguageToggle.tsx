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
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

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
      // No overflow-hidden (#233): it would clip the segments' ::before tap
      // overlays below. Each segment rounds its own outer end instead, which
      // draws the same pill.
      className="flex items-center rounded-full border border-[var(--color-bone-300)] bg-[var(--color-bone-100)]"
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
              "relative px-3 text-xs font-semibold transition-colors duration-150 h-full " +
              "first:rounded-l-full last:rounded-r-full " +
              // #233: 26px-tall segments → 48px hit areas. 11px up/down, and
              // 10px outward only (EN left, ES right) so each clears 48 wide
              // while the two still meet at the divider rather than overlap.
              "before:absolute before:inset-x-0 before:-inset-y-[11px] " +
              "first:before:-left-2.5 last:before:-right-2.5 " +
              PRESS_FEEDBACK + " " +
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
