/**
 * /suggest — suggest a new venue page.
 *
 * Server component: reads locale from cookie and renders SuggestForm
 * client component.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import SuggestForm from "@/components/SuggestForm";
import { buildPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Suggest a Venue",
  description:
    "Know a food pantry, community garden, or other food resource missing from the map? Suggest it for Pueblo Food Map.",
  path: "/suggest",
});

export default async function SuggestPage() {
  // Read locale cookie server-side — same pattern as report/[venueId]/page.tsx
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const locale: Locale = rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

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
          ← {t("suggest.backToMap", locale)}
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8">
        <h1
          className="text-2xl font-normal text-[var(--color-ink-900)] mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("suggest.title", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mb-6">
          {t("suggest.subtitle", locale)}
        </p>

        {/* Client form component */}
        <SuggestForm locale={locale} />

        {/* Fallback email link */}
        <p className="mt-6 text-xs text-center text-[var(--color-ink-400)]">
          {t("suggest.fallback", locale)}
        </p>
      </div>
    </main>
  );
}
