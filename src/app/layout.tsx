import type { Metadata } from "next";
// Fonts are self-hosted via @font-face in globals.css — no next/font/google import.
import "./globals.css";

export const metadata: Metadata = {
  title: "Pueblo Food Access Map",
  description:
    "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores — with walking and bus directions via Pueblo Transit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
