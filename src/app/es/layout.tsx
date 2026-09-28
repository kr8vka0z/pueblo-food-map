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
