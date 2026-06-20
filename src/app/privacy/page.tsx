/**
 * /privacy — short privacy disclosure page.
 *
 * Linked from all three submission forms (report, suggest, feedback) near
 * the email field to inform users from a vulnerable population what their
 * contact information is used for. Issue #160 item 1.7.
 *
 * Server component: reads locale from cookie, same pattern as other form pages.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Privacy policy for the Pueblo Food Map — what information is collected and how it is used.",
};

export default async function PrivacyPage() {
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
          ← {t("report.backToMap", locale)}
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8">
        <h1
          className="text-2xl font-normal text-[var(--color-ink-900)] mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("privacy.heading", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
          {t("privacy.body", locale)}
        </p>
      </div>
    </main>
  );
}
