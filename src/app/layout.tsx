import type { Metadata } from "next";
// Fonts are self-hosted via @font-face in globals.css — no next/font/google import.
import "./globals.css";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/lib/LocaleContext";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Pueblo Food Access Map",
  description:
    "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores — with walking and bus directions via Pueblo Transit.",
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
