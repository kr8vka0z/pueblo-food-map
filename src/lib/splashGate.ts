/**
 * splashGate — the single source of truth for the "has this visitor
 * already seen the splash" localStorage flag.
 *
 * Extracted from src/app/(site)/HomePageClient.tsx (#689 PR 2 follow-up
 * review fix) into its own module, NOT re-exported from HomePageClient
 * itself: SplashScreen.tsx needs markSplashSeen() for its cross-tree CTA
 * case (picking English on the /es splash navigates to "/?near=1" instead
 * of calling HomePageClient's own dismissSplash), and HomePageClient.tsx
 * mounts SplashScreen via next/dynamic — importing HomePageClient FROM
 * SplashScreen would be a circular import between the two. A tiny shared
 * module both sides import from avoids that.
 */

const GATE_KEY = "pfm.splash.seen.v2";

export function readSplashGate(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GATE_KEY) === "1";
}

export function markSplashSeen(): void {
  localStorage.setItem(GATE_KEY, "1");
}
