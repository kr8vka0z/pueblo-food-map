/**
 * src/app/es/not-found.tsx — branded 404 for the /es tree (#689 PR 2).
 *
 * REQUIRED, not optional: a notFound() call inside src/app/es/venue/[id]
 * resolves against the NEAREST not-found.tsx in ITS OWN root layout's tree
 * (es/layout.tsx), not against app/(site)/not-found.tsx or
 * app/global-not-found.tsx — those belong to a different root layout
 * entirely. Without this file, an unknown /es/venue/<id> would fall through
 * to Next's own bare, unbranded default 404 instead of a Spanish page.
 *
 * NotFoundContent is already locale-aware via useLocale() (#289) — under
 * this tree's LOCKED provider (RootShell passes initialLocale="es" for
 * lang="es") it renders Spanish body copy with no changes needed here. This
 * file's own job is just to put it in-tree for notFound() to find, and to
 * set a Spanish <title> (page metadata isn't inherited across root
 * layouts, so it can't come from app/(site)/not-found.tsx).
 *
 * A truly UNMATCHED /es/<anything-not-a-real-route> URL (no route in the
 * tree at all — e.g. /es/nonsense) does NOT reach this file; Next falls
 * through to app/global-not-found.tsx instead, which renders in English
 * (RootShell lang="en"). That's the same tradeoff app/global-not-found.tsx
 * already documents for the EN tree's stray unmatched URLs — acceptable
 * per #689's scope (only the five listed routes are mirrored).
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
