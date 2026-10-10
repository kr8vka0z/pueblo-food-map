/**
 * app/es/not-found.tsx — the Spanish 404 for an explicit notFound() thrown
 * inside the /es tree (#762: /es/event/[id] for a draft, archived, unknown or
 * unreadable event).
 *
 * WHY it is back: es/layout.tsx explains why the earlier version was removed
 * (nothing could reach it once es/venue/[id] became dynamicParams=false). The
 * event route is the "real in-tree /es notFound()" that comment said would
 * bring it back. Without this file that 404 renders Next's own English
 * "404: This page could not be found." Unmatched /es/* URLs are unaffected:
 * they still render the English app/global-not-found.tsx.
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
