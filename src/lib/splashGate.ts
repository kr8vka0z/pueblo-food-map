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
 *
 * Also owns the "skip the splash?" decision, in two forms that must agree:
 * shouldSkipSplash() (React, after hydration) and SPLASH_GATE_SCRIPT (inline,
 * before the server-rendered splash is first painted, on full page loads only;
 * client-side navigations resolve in HomePageClient's layout effect).
 * splashSsr.test.tsx asserts they match.
 */

const GATE_KEY = "pfm.splash.seen.v2";

/** Attribute the inline gate script sets on <html> when the splash should not show. */
export const SPLASH_SEEN_ATTR = "data-splash-seen";

export function readSplashGate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GATE_KEY) === "1";
  } catch {
    // WHY: storage can throw when disabled; treat as unseen so a deep link
    // (which never needs the gate) still resolves instead of erroring out.
    return false;
  }
}

export function markSplashSeen(): void {
  try {
    localStorage.setItem(GATE_KEY, "1");
  } catch {
    // WHY: with storage blocked, throwing here would abort dismissSplash before
    // it hides the splash, trapping the visitor on it. They just see it again next visit.
  }
}

/**
 * The venue a shared link points at: `?venue=<id>` wins over `#venue=<id>`
 * (`??`, so an empty `?venue=` still wins and is falsy). Legacy `#venue=` form
 * comes from /venue/[id]'s "View on the map" CTA.
 */
export function resolveVenueId(search: string, hash: string): string | null {
  const venueParam = new URLSearchParams(search).get("venue");
  const hashParam = hash.startsWith("#venue=") ? hash.slice("#venue=".length) : null;
  return venueParam ?? hashParam;
}

/**
 * True when the splash must not show: a shared venue link, a shared event
 * link (`?event=<id>`, #759 — an empty `?event=` is no link and does not skip),
 * an in-app
 * ?near=1 / ?boxes=1 hop (PageNav — the splash was already seen), or a
 * visitor who already dismissed it.
 */
export function shouldSkipSplash({
  search,
  hash,
  gateSeen,
}: {
  search: string;
  hash: string;
  gateSeen: boolean;
}): boolean {
  const params = new URLSearchParams(search);
  return (
    Boolean(resolveVenueId(search, hash)) ||
    Boolean(params.get("event")) ||
    params.get("near") === "1" ||
    params.get("boxes") === "1" ||
    gateSeen
  );
}

/**
 * Inline script for the homepage, rendered just before the client body so it
 * runs before the server-rendered splash is parsed. Mirrors shouldSkipSplash()
 * in ES5 (no startsWith / ??) and only sets SPLASH_SEEN_ATTR; globals.css hides
 * the pending splash off that attribute. WHY try/catch: any failure (old
 * browser without URLSearchParams, storage disabled) just leaves the splash
 * visible until React resolves, which is the safe default. URL checks come
 * before the storage read so a deep link never depends on storage.
 */
export const SPLASH_GATE_SCRIPT =
  "(function(){try{" +
  "var p=new URLSearchParams(location.search),v=p.get('venue'),h=location.hash," +
  "r=v!==null?v:(h.indexOf('#venue=')===0?h.slice(7):null);" +
  "if(r||p.get('event')||p.get('near')==='1'||p.get('boxes')==='1'||" +
  `localStorage.getItem(${JSON.stringify(GATE_KEY)})==='1')` +
  `document.documentElement.setAttribute(${JSON.stringify(SPLASH_SEEN_ATTR)},'')` +
  "}catch(e){}})();";
