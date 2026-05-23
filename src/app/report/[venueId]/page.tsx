/**
 * /report/[venueId] — venue issue report page.
 *
 * Server component: looks up the venue by ID from the static venue list,
 * then renders the ReportForm client component with venue context pre-filled.
 *
 * If venueId doesn't match any venue, renders a graceful not-found message
 * rather than erroring out.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { venues } from "@/data/venues";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import ReportForm from "@/components/ReportForm";

interface Props {
  params: Promise<{ venueId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { venueId } = await params;
  const venue = venues.find((v) => v.id === venueId);
  return {
    title: venue
      ? `Report an issue — ${venue.name} | Pueblo Food Map`
      : "Report an issue | Pueblo Food Map",
  };
}

export default async function ReportPage({ params }: Props) {
  const { venueId } = await params;

  // Read locale cookie server-side — same pattern as layout.tsx
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const locale: Locale = rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

  const venue = venues.find((v) => v.id === venueId);

  if (!venue) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6">
        <p className="text-[var(--color-ink-700)] mb-4">Venue not found.</p>
        <Link
          href="/"
          className="text-sm text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] font-medium"
        >
          {t("report.backToMap", locale)}
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* Top nav bar */}
      <nav className="h-12 flex items-center px-4 border-b border-[var(--color-bone-200)] shrink-0">
        <Link
          href="/"
          className={
            "text-sm font-medium text-[var(--color-sage-600)] " +
            "hover:text-[var(--color-sage-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] rounded"
          }
        >
          ← {t("report.backToMap", locale)}
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8">
        <h1
          className="text-2xl font-normal text-[var(--color-ink-900)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("report.title", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mb-6">
          {t("report.subtitle", locale)}
        </p>

        {/* Venue context header */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-white p-4 mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">
            {t("report.venueLabel", locale)}
          </p>
          <p className="text-base font-medium text-[var(--color-ink-900)]">
            {venue.name}
          </p>
          <p className="text-sm text-[var(--color-ink-500)]">{venue.address}</p>
        </div>

        {/* Client form component */}
        <ReportForm
          venueId={venue.id}
          venueName={venue.name}
          venueAddress={venue.address}
          locale={locale}
        />

        {/* Fallback email link */}
        <p className="mt-6 text-xs text-center text-[var(--color-ink-400)]">
          {t("report.fallback", locale)}
        </p>
      </div>
    </main>
  );
}
