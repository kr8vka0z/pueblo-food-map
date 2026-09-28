/**
 * src/app/es/not-found.tsx — branded 404 for the /es tree (#689 PR 2).
 *
 * REQUIRED, not optional: an in-tree notFound() call resolves against the
 * NEAREST not-found.tsx in ITS OWN root layout's tree (es/layout.tsx), not
 * against app/(site)/not-found.tsx or app/global-not-found.tsx — those
 * belong to a different root layout entirely. Without this file, any /es
 * page that reaches notFound() (the es/[...rest] catch-all below, chiefly)
 * would fall through to Next's own bare, unbranded default 404 instead of
 * a Spanish page.
 *
 * NotFoundContent is already locale-aware via useLocale() (#289) — under
 * this tree's LOCKED provider (RootShell passes initialLocale="es" for
 * lang="es") it renders Spanish body copy with no changes needed here. This
 * file's own job is just to put it in-tree for notFound() to find, and to
 * set a Spanish <title> (page metadata isn't inherited across root
 * layouts, so it can't come from app/(site)/not-found.tsx).
 *
 * A truly UNMATCHED /es/<anything-not-a-real-route> URL (no route in the
 * tree at all — e.g. /es/nonsense), AND an es/venue/<id> whose id isn't in
 * generateStaticParams (dynamicParams = false means that case never
 * actually reaches this page's own `if (!v) notFound()` call — Next
 * 404s it at the routing level, before any page component runs, treating
 * it as "no route matched"), both now DO reach this file too — via
 * src/app/es/[...rest]/page.tsx (#689 PR 2 follow-up, staging finding),
 * a catch-all that calls notFound() so those cases resolve in-tree
 * instead of falling through to the English app/global-not-found.tsx.
 * See that file's own header for the mechanism and a known streaming
 * caveat for non-JS clients.
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
