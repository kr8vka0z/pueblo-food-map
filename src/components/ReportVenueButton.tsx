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
        "border border-[var(--color-ink-300)] text-[var(--color-ink-600)] " +
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
