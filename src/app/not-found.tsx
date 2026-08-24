import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default async function NotFound() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const locale: Locale = rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)] items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-8 shadow-sm">
        <h1
          className="text-3xl font-normal text-[var(--color-ink-900)] mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("notfound.title", locale)}
        </h1>
        <p className="text-base text-[var(--color-ink-500)] mb-6 leading-relaxed">
          {t("notfound.body", locale)}
        </p>
        <Link
          href="/"
          className={
            "inline-flex items-center justify-center px-5 py-2.5 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-600)] text-white text-sm font-medium " +
            "hover:bg-[var(--color-sage-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          ← {t("notfound.backToMap", locale)}
        </Link>
      </div>
    </main>
  );
}