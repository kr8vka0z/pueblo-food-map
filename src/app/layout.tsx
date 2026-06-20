import type { Metadata } from "next";
// Fonts are self-hosted via @font-face in globals.css — no next/font/google import.
import "./globals.css";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/LocaleContext";
import type { Locale } from "@/lib/i18n";
import { SITE_URL, SITE_NAME, OG_IMAGE } from "@/lib/site";
import { buildWebSiteJsonLd } from "@/lib/venueSchema";

const DESCRIPTION =
  "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores — with walking and bus directions via Pueblo Transit.";

export const metadata: Metadata = {
  // WHY: metadataBase is required so relative paths resolve to absolute URLs
  // for crawlers and social platforms. OG_IMAGE.url is now absolute, but
  // metadataBase is still needed for any other relative path Next.js resolves.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pueblo Food Map — Food Resources in Pueblo County, CO",
    // Template lets child pages set short titles; root appends the brand name.
    template: "%s · Pueblo Food Map",
  },
  description: DESCRIPTION,
  // WHY: No canonical set here. A root-level canonical propagates to every
  // child route via Next.js metadata inheritance, causing /suggest, /feedback,
  // and /privacy to all report "/" as their canonical — a de-indexing risk.
  // Each page that needs a canonical sets its own (see per-page metadata).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Pueblo Food Map — Food Resources in Pueblo County, CO",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["es_US"],
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pueblo Food Map — Food Resources in Pueblo County, CO",
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read pfm-locale cookie server-side so the initial render uses the user's
  // stored preference — no EN flash for ES users.
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const initialLocale: Locale =
    rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

  return (
    <html
      lang={initialLocale}
      className="h-full antialiased"
    >
      <body className="h-full flex flex-col">
        {/* WebSite JSON-LD — sitewide structured data for search engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildWebSiteJsonLd()),
          }}
        />
        <LocaleProvider initialLocale={initialLocale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
