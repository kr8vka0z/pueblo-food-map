import type { Metadata } from "next";
// Fonts are self-hosted via @font-face in globals.css — no next/font/google import.
import "./globals.css";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/LocaleContext";
import type { Locale } from "@/lib/i18n";
import { SITE_URL, SITE_NAME, OG_IMAGE } from "@/lib/site";

const DESCRIPTION =
  "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores — with walking and bus directions via Pueblo Transit.";

export const metadata: Metadata = {
  // WHY: metadataBase is required so relative paths like OG_IMAGE.url resolve
  // to absolute URLs for crawlers and social platforms.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pueblo Food Access Map",
    // Template lets child pages set short titles; root appends the brand name.
    template: "%s · Pueblo Food Access Map",
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Pueblo Food Access Map",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pueblo Food Access Map",
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
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
        <LocaleProvider initialLocale={initialLocale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
