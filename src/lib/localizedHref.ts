/**
 * localizedHref — the one place an internal link decides which tree
 * (EN or /es) it should point into (#689 PR 2 design decision 9).
 *
 * WHY it takes `tree`, NOT the switchable `locale` from useLocale(): on the
 * EN homepage with a stale `es` cookie, `locale` becomes "es" (the visible
 * body switches to Spanish) but the page is still served from the EN root
 * layout — its links must stay in the EN tree, or a visitor half-migrates:
 * clicking "All places" would take them to /es/venues, an entirely
 * different page than the one they were just looking at. `tree` (from
 * LocaleContext's `tree` field) is fixed by the ROUTE the page was served
 * from — it can never change client-side, unlike `locale`.
 *
 * Only MIRRORED paths (#689 scope table: /, /venues, /venue/<id>,
 * /resources, /about, plus the #709 hubs /food-pantries, /snap-wic-stores,
 * /community-gardens) get rewritten. A path with no /es counterpart
 * (/suggest, /privacy, /feedback, /boxes/activity, ...) is returned
 * unchanged even when `tree` is "es" — those pages deliberately stay
 * single-URL (issue #689 "Out" scope), so a link to them from an /es page
 * is correct exactly as EN.
 */
import type { Locale } from "@/lib/i18n";

// SEO Phase 3 hubs (#709) are mirrored too: each has an /es twin.
const MIRRORED_STATIC = new Set([
  "/",
  "/venues",
  "/resources",
  "/about",
  "/food-pantries",
  "/snap-wic-stores",
  "/community-gardens",
]);

function isMirrored(basePath: string): boolean {
  return MIRRORED_STATIC.has(basePath) || basePath.startsWith("/venue/");
}

/**
 * @param path A plain EN-tree-form path, e.g. "/venues", "/venue/<id>",
 *   "/about", "/#venue=<id>", or "/?near=1" (query and/or hash preserved,
 *   whichever comes first splits the base path from the suffix). Never
 *   pass an /es path in.
 * @param tree The CURRENT page's route tree ("en" | "es") — LocaleContext's
 *   `tree` field, not `locale`.
 */
export function localizedHref(path: string, tree: Locale): string {
  if (tree !== "es") return path;

  // WHY search for the FIRST of ? or #, not just #: PageNav's off-map nav
  // targets (Near me -> "/?near=1", Boxes -> "/?boxes=1", a saved place ->
  // "/?venue=<id>") are query strings on the root path, with no hash at
  // all — splitting on "#" alone left them unrewritten (a real bug: those
  // links dropped an /es visitor straight into the EN tree).
  const splitIndex = path.search(/[?#]/);
  const basePath = splitIndex === -1 ? path : path.slice(0, splitIndex);
  const suffix = splitIndex === -1 ? "" : path.slice(splitIndex);

  if (!isMirrored(basePath)) return path;

  const esBase = basePath === "/" ? "/es" : `/es${basePath}`;
  return `${esBase}${suffix}`;
}

/**
 * The OTHER tree's URL for a given pathname — used by LanguageToggle to
 * become a real cross-tree link on a mirrored page (#689 design decision
 * 8). Returns null when `pathname` has no counterpart at all (a
 * non-mirrored page, e.g. /suggest), so the caller knows to fall back to
 * its old same-tree toggle behavior instead of linking somewhere wrong.
 *
 * Bidirectional, unlike localizedHref (which only ever converts EN-form
 * input): `pathname` here is whatever tree the visitor is CURRENTLY on —
 * `currentTree` says which one, so this can go either /es/venues -> /venues
 * or /venues -> /es/venues from the same function.
 *
 * `pathname` only (no hash/query) — Next's usePathname() never includes
 * them, and any # / ?query on the CURRENT page is appended by the caller
 * post-mount (they're client-only; SSR can't see them).
 */
export function mirroredCounterpartHref(
  pathname: string,
  currentTree: Locale,
): string | null {
  const isEsPath = pathname === "/es" || pathname.startsWith("/es/");
  const enBase = isEsPath ? (pathname === "/es" ? "/" : pathname.slice("/es".length)) : pathname;

  if (!isMirrored(enBase)) return null;

  return currentTree === "es" ? enBase : enBase === "/" ? "/es" : `/es${enBase}`;
}
