// Fonts are self-hosted via @font-face in globals.css — no next/font/google import.
// One level up: globals.css stays at src/app/ root (not moved into this route
// group) because app/global-not-found.tsx needs the same import and bypasses
// this layout entirely — see that file's header comment.
import "../globals.css";
import RootShell from "@/components/RootShell";
import { ROOT_METADATA, ROOT_VIEWPORT } from "@/lib/site";

// Both objects live in src/lib/site.ts, not here: app/global-not-found.tsx
// (#689 PR 1) has no parent layout to inherit from, so it reuses these
// verbatim (title overridden) rather than silently losing OG/twitter tags.
export const metadata = ROOT_METADATA;

// themeColor (#530, Kyle's reference: YouTube on a phone) tints Safari's own
// toolbar the same cream as the page, so the two read as one piece instead
// of a visible seam — see ROOT_VIEWPORT in src/lib/site.ts for the literal
// and src/__tests__/bottomNavClearance.test.ts, which keeps it in sync with
// globals.css's --color-bone-50.
export const viewport = ROOT_VIEWPORT;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootShell lang="en">{children}</RootShell>;
}
