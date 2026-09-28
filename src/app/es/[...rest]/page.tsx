/**
 * src/app/es/[...rest]/page.tsx — catch-all for unmatched /es/* URLs
 * (#689 PR 2 follow-up, staging finding).
 *
 * WHY this file exists: `dynamicParams = false` on es/venue/[id] means an
 * id NOT in generateStaticParams never reaches that page's own
 * `if (!v) notFound()` call — Next.js treats it as "no route matched this
 * URL at all" (node_modules/next/dist/docs/.../not-found.md: "global-
 * not-found.js ... is used when a requested URL doesn't match any route at
 * all"), so it falls all the way through to app/global-not-found.tsx,
 * which renders the EN root layout — confirmed on staging: an unknown
 * /es/venue/<id> served English "Page Not Found" instead of the Spanish
 * es/not-found.tsx page.
 *
 * A catch-all route SEGMENT is a real, matched route (just a very general
 * one) — so a request that would otherwise be "unmatched" under /es now
 * matches THIS file instead of falling through to global-not-found, and
 * `notFound()` called from inside it resolves against the /es tree's OWN
 * not-found.tsx (es/not-found.tsx), the same way any other in-tree
 * notFound() call does. Verified locally (`next build` + `next start`):
 * an unknown /es/venue/<id> now 404s with the Spanish title/description/OG
 * tags from the /es root layout, `noindex`, correct status code.
 *
 * Known caveat (documented, not fixed): the FIRST-BYTE HTML for this
 * specific case (`notFound()` thrown from a genuinely dynamic, per-request
 * route — unlike a statically prerendered `not-found.tsx` composition) can
 * ship as a minimal Next-internal shell (`<html id="__next_error__">`,
 * no `lang` attribute) with the real Spanish `<html lang="es">`/body
 * streamed in via the RSC payload for client-side hydration — confirmed by
 * grepping the raw response for the same `lang":"es"` value. A real
 * browser (any JS-executing client) hydrates to the correct `<html
 * lang="es">` immediately; only a client that fetches HTML without running
 * JS sees the unstyled shell for that one paint. The page is already
 * `noindex` (Next auto-injects it for a 404 status — not-found.md, "Good
 * to know"), so this doesn't affect indexing; it's a cosmetic gap for a
 * true no-JS client hitting an already-invalid URL, not a search-engine or
 * AI-answer-engine concern. If Next ships a fix for this streaming
 * timing on a future version, this note can be deleted.
 *
 * This also fixes a smaller, previously-documented gap for free: ANY
 * unmatched /es/<anything> (not just an unknown venue id) now gets the
 * Spanish 404 instead of falling through to global-not-found — the
 * original PR 2 traded this off deliberately (es/not-found.tsx's own
 * header used to say so); this file supersedes that tradeoff.
 */
import { notFound } from "next/navigation";

export default function EsCatchAll() {
  notFound();
}
