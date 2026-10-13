/**
 * StyxCredit — the "Designed, built and managed by The Styx Group" line.
 *
 * WHY: Kyle asked for the agency credit on this site (2026-10-12), in two
 * places: SiteFooter (every inside page) and the bottom of the Menu drawer
 * (the only spot reachable from the full-screen map, which has no footer).
 * One component so the wording and link can't drift between the two.
 *
 * WHY no 44px tap target: the link sits inside a sentence (WCAG 2.5.8's
 * inline exemption), and padding it would break the line. WHY underline: the
 * link keeps the line's muted ink-400, so the underline is what marks it.
 */

import { t, type Locale } from "@/lib/i18n";

export default function StyxCredit({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <p className={`text-xs text-[var(--color-ink-400)] ${className}`}>
      {t("credit.builtBy", locale)}{" "}
      <a
        href="https://thestyxgroup.com"
        target="_blank"
        rel="noopener noreferrer"
        // whitespace-nowrap: in the 280-288px Menu the name split across two lines.
        className="whitespace-nowrap underline hover:text-[var(--color-ink-700)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
      >
        The Styx Group
      </a>
    </p>
  );
}
