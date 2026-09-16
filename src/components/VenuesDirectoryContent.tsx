"use client";

/**
 * VenuesDirectoryContent — visible body of /venues.
 *
 * Extracted from src/app/venues/page.tsx so the directory's headings and
 * per-venue hours text read the visitor's locale via useLocale() (#289),
 * while the page itself stays a server-rendered, crawlable Server Component
 * (no cookies() read — AGENTS.md "Known bilingual limitation", #287). The
 * grouped-by-category data is computed server-side by groupVenuesByCategory
 * (still exported from page.tsx, pure and locale-independent) and passed in.
 */

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import SiteFooter from "@/components/SiteFooter";
import { DISPLAY_DAY_KEYS, formatSlot } from "@/lib/hours";
import type { Venue, VenueCategory } from "@/types/venue";

interface VenuesDirectoryContentProps {
  groups: { category: VenueCategory; items: Venue[] }[];
}

export default function VenuesDirectoryContent({ groups }: VenuesDirectoryContentProps) {
  const { locale } = useLocale();

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* Top nav bar — matches about.tsx / venue/[id]/page.tsx pattern */}
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
          ← {t("footer.backToMap", locale)}
        </Link>
      </nav>

      {/* Page content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-8">
        <div>
          <h1
            className="text-3xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("venues.heading", locale)}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-700)]">
            {t("venues.intro", locale)}
          </p>
        </div>

        {groups.map(({ category, items }) => {
          const headingId = `${category}-heading`;
          return (
            <section key={category} aria-labelledby={headingId}>
              <h2
                id={headingId}
                className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
              >
                {t(`category.full.${category}`, locale)}
              </h2>
              <ul className="space-y-4">
                {items.map((v) => {
                  const openDays = DISPLAY_DAY_KEYS.filter(
                    (day) => (v.hours_weekly?.[day]?.length ?? 0) > 0,
                  ).map(
                    (day) =>
                      `${t(`day.${day}`, locale)} ${v.hours_weekly![day]!.map(formatSlot).join(", ")}`,
                  );
                  const hoursText =
                    openDays.length > 0 ? openDays.join(" · ") : t("venues.noHours", locale);

                  return (
                    <li key={v.id}>
                      <Link
                        href={`/venue/${v.id}`}
                        className={
                          "text-base font-semibold text-[var(--color-sage-600)] " +
                          "hover:text-[var(--color-sage-700)] transition-colors " +
                          "focus-visible:outline-none focus-visible:ring-2 " +
                          "focus-visible:ring-[var(--color-sage-500)] rounded"
                        }
                      >
                        {v.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{v.address}</p>
                      <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{hoursText}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Site footer: links back to map, about, privacy, suggest */}
      <SiteFooter />
    </main>
  );
}
