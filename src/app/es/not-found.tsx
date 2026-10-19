/**
 * app/es/not-found.tsx — the Spanish 404 for an explicit notFound() thrown
 * inside the /es tree (#762: /es/event/[id] for a draft, archived, unknown or
 * unreadable event).
 *
 * Without this file that 404 renders Next's own English "404: This page could
 * not be found." Unmatched /es/* URLs are unaffected: they render the English
 * app/global-not-found.tsx (see es/layout.tsx for why that is accepted).
 *
 * The body is the shared NotFoundContent; the /es root layout locks its
 * LocaleProvider to Spanish, so the text is Spanish.
 */
import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("notfound.documentTitle", "es"),
};

export default function EsNotFound() {
  return <NotFoundContent />;
}
