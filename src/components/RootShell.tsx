/**
 * RootShell — the <html>/<body> shell shared by every root layout.
 *
 * Extracted from src/app/layout.tsx (#689 PR 1) so a future
 * src/app/es/layout.tsx (PR 2) can render the same shell with lang="es"
 * without duplicating font preload, sitewide JSON-LD, analytics, or the
 * service-worker register. Next.js requires *multiple* root layouts for a
 * second `<html lang>` to land in the server HTML (route groups doc,
 * node_modules/next/dist/docs/.../route-groups.md, "Defining multiple root
 * layouts") — a single layout can't set `lang` per-locale.
 *
 * `metadata`/`viewport` stay in each layout.tsx (and in
 * app/global-not-found.tsx) — only page/layout/global-not-found files can
 * export them, a plain component can't.
 *
 * #689 PR 2: `lang` also drives the LocaleProvider's `initialLocale` and the
 * WebSite JSON-LD's locale. Passing `initialLocale="es"` LOCKS the provider
 * to Spanish — LocaleContext's cookie-sync effect only runs `if
 * (!initialLocale)` (src/lib/LocaleContext.tsx), so a stale `pfm-locale=en`
 * cookie can never flip an /es page back to English after hydration. The EN
 * tree (lang="en") passes no initialLocale, same as before this change, so
 * its cookie-sync behavior is untouched.
 */
import { preload } from "react-dom";
import { LocaleProvider } from "@/lib/LocaleContext";
import { buildWebSiteJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import type { Locale } from "@/lib/i18n";
import Analytics from "@/components/Analytics";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export default function RootShell({
  lang,
  children,
}: Readonly<{
  lang: Locale;
  children: React.ReactNode;
}>) {
  // WHY preload() here instead of a <head> element: React 19's preload() API
  // is idiomatic for App Router — it coexists with the Metadata API without
  // producing duplicate or misplaced <head> tags or hydration mismatches.
  // crossOrigin is required because font fetches are always CORS-mode; without
  // it the browser treats the preload as a different cache entry and double-fetches.
  // WHY only Public Sans: Fraunces is a display serif used sparingly — preloading
  // it competes for critical-path bandwidth and can regress mobile LCP. It loads
  // via @font-face in globals.css with font-display:swap instead.
  preload("/fonts/PublicSans-Variable.woff2", {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });

  return (
    <html lang={lang} className="h-full antialiased">
      <body className="h-full flex flex-col">
        {/* WebSite JSON-LD — sitewide structured data for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(buildWebSiteJsonLd(lang)),
          }}
        />
        <LocaleProvider initialLocale={lang === "es" ? "es" : undefined}>
          {children}
        </LocaleProvider>
        {/* #485 — deferred PostHog init; renders nothing, no-ops with no key */}
        <Analytics />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
