/**
 * src/app/es/layout.tsx — the second root layout, for the /es tree (#689 PR 2).
 *
 * WHY a second root layout rather than a single layout that sets `lang`
 * client-side: Bing (which feeds ChatGPT search and Copilot) leans on the
 * server-rendered `<html lang>` more than on hreflang — a client-side patch
 * never reaches the crawler. Next's route-groups doc (node_modules/next/
 * dist/docs/.../route-groups.md, "Defining multiple root layouts") is
 * explicit that MULTIPLE root layouts is the supported way to get a second
 * `<html lang>` into the server HTML; src/app/(site)/layout.tsx is the EN
 * one (#689 PR 1 extracted RootShell so neither layout duplicates markup).
 *
 * lang="es" also locks RootShell's LocaleProvider to Spanish (see
 * RootShell's own header) and gives the WebSite JSON-LD `inLanguage: "es"`.
 *
 * Moving between this layout and (site)'s is a full page load (#689 design
 * decision 2, accepted tradeoff) — Next.js docs confirm crossing root
 * layouts always is, since they don't share a DOM subtree to soft-navigate
 * within.
 *
 * Unmatched /es/* URLs render the ENGLISH app/global-not-found.tsx, not a
 * Spanish 404 — accepted tradeoff (#689 PR 2 follow-up, round 2). A
 * dedicated es/not-found.tsx (in-tree, for an explicit notFound() call)
 * existed briefly along with an es/[...rest] catch-all route meant to
 * route unmatched /es/* URLs into it, but the catch-all's own 404 response
 * measured WORSE on low-end phones than the prerendered English fallback
 * it replaced: `notFound()` thrown from a genuinely dynamic, per-request
 * route ships Next's own blank `__next_error__` shell (no CSS, no-store,
 * fetched fresh every time) for the first paint, rather than the instant,
 * cacheable, fully-branded global-not-found.tsx. Both files were removed.
 * es/not-found.tsx was ALSO dead code on its own merits even without the
 * catch-all: dynamicParams=false on es/venue/[id] means an id outside
 * generateStaticParams 404s at Next's routing level, before that page's
 * own notFound() call ever runs — there was no remaining path that could
 * reach an in-tree /es not-found.tsx at all. If a real in-tree /es
 * notFound() call is ever added later (a route that can legitimately
 * throw it after matching), es/not-found.tsx should come back at that
 * point, not before.
 *
 * #762 is that point: /es/event/[id] is dynamic and throws notFound() for a
 * draft, archived or unknown event, so es/not-found.tsx is back (Spanish
 * body for that 404 only; unmatched /es/* URLs still fall through to the
 * English global-not-found, as above). The event 404 has the same blank
 * `__next_error__` first paint described above, exactly like /box/[id] does
 * in the EN tree; it is a real HTTP 404 with noindex either way.
 */
import "../globals.css";
import RootShell from "@/components/RootShell";
import { ES_ROOT_METADATA, ROOT_VIEWPORT } from "@/lib/site";

export const metadata = ES_ROOT_METADATA;
export const viewport = ROOT_VIEWPORT;

export default function EsRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootShell lang="es">{children}</RootShell>;
}
