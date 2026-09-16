"use client";

/**
 * SponsorCredit — "Sponsored by Pueblo Food Project" link, bottom-right of the
 * welcome splash.
 *
 * It used to sit on the map too. Kyle (2026-09-16) moved the map's sponsor
 * credit to the top of the Menu drawer (HamburgerMenu) so the map's corner
 * holds only the Mapbox credits.
 *
 * Spec: github.com/kr8vka0z/pueblo-food-map/issues/69
 */

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";

interface SponsorCreditProps {
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
  /** Hide the credit (e.g. when BottomSheet is fully expanded on mobile). */
  hidden?: boolean;
}

export default function SponsorCredit({
  locale: localeProp,
  hidden = false,
}: SponsorCreditProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        zIndex: 1000,
        display: hidden ? "none" : undefined,
      }}
    >
      <a
        href="https://pueblofoodproject.org/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12 }}
        className={
          "text-[var(--color-ink-500)] " +
          "hover:text-[var(--color-ink-700)] hover:underline " +
          "focus-visible:outline-none focus-visible:underline " +
          "focus-visible:text-[var(--color-ink-700)] " +
          "transition-colors duration-150"
        }
      >
        {t("sponsor.text", locale)}
      </a>
    </div>
  );
}
