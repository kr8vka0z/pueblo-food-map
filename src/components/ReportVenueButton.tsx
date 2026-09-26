"use client";

/**
 * ReportVenueButton — secondary action button mounted in venue popups.
 *
 * Navigates to /report/[venueId] where the user can describe a data issue.
 * Styled as a small outlined/text-link button — intentionally lower visual
 * weight than the "Get directions" primary action.
 */

import Link from "next/link";
import { Flag } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";

interface ReportVenueButtonProps {
  venueId: string;
  locale?: Locale;
}

export default function ReportVenueButton({
  venueId,
  locale = "en",
}: ReportVenueButtonProps) {
  return (
    <Link
      href={`/report/${venueId}`}
      className={
        "flex items-center justify-center gap-1.5 w-full h-9 rounded-[var(--radius-md)] " +
        // #233: keeps the lighter 36px look of a secondary action; an
        // invisible overlay makes the tap area 48px. 7px, not 6: an absolute
        // ::before resolves against the padding box, 34px inside the border.
        "relative before:absolute before:inset-x-0 before:-inset-y-[7px] " +
        // #534: --color-ink-300/--color-ink-600 undefined in globals.css
        // @theme. Border: bone-300 is the app's documented resting-border
        // token (DESIGN.md: "bone-300 — search bar border at rest"),
        // darkening to the already-defined ink-400 on hover below — same
        // rest/hover pattern as FeedbackForm's retry button. Text: ink-500
        // ("secondary metadata") matches this button's own doc comment
        // above — "intentionally lower visual weight" than a primary action.
        "border border-[var(--color-bone-300)] text-[var(--color-ink-500)] " +
        "text-sm font-medium transition-colors duration-150 " +
        "hover:bg-[var(--color-bone-100)] hover:border-[var(--color-ink-400)] " +
        "focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
      }
    >
      <Flag size={13} aria-hidden />
      {t("report.button", locale)}
    </Link>
  );
}
