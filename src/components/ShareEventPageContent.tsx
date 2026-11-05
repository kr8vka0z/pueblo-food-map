"use client";

/**
 * ShareEventPageContent — visible body of /events/share and /es/events/share
 * (#883). Same split as SuggestPageContent: the page files stay static Server
 * Components with their metadata; this reads the visitor's locale.
 */

import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import ShareEventForm from "@/components/ShareEventForm";
import SiteFooter from "@/components/SiteFooter";
import PageNav, { PAGE_NAV_CLEARANCE } from "./PageNav";

export default function ShareEventPageContent() {
  const { locale } = useLocale();
  useDocumentTitle(pageDocumentTitle(t("shareEvent.documentTitle", locale)));

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-normal text-[var(--color-ink-900)] mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {t("shareEvent.title", locale)}
        </h1>
        <p className="text-sm text-[var(--color-ink-500)] mb-6 max-w-lg">{t("shareEvent.subtitle", locale)}</p>
        <ShareEventForm />
      </div>
      <SiteFooter />
    </main>
  );
}
