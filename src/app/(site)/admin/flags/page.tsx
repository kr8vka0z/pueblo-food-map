/**
 * /admin/flags — retired (#674, "fold the Data refresh tab into Places").
 * The change-proposal review queue this page used to render
 * (ProposalsReviewView.tsx, deleted) is now part of the Places tab itself:
 * every pending proposal shows on its target venue's own row (or a
 * "Suggested new place" row for a brand-new `add`), with a "To review"
 * summary box, quick-filter chips, and the source/lane filters this page's
 * queue used to own — see src/components/VenueListView.tsx and
 * src/app/(site)/admin/places/page.tsx.
 *
 * Kept as a redirect rather than deleted outright: the nightly refresh
 * pipeline's alert email (src/lib/refreshAlerts.ts) and any admin's
 * existing bookmark/muscle-memory both still point here. A plain Server
 * Component `redirect()` — not a `next.config.ts` `redirects()` rule or
 * `proxy.ts` — is safe at a non-root path; AGENTS.md's "no server-side
 * redirect" footgun is specifically about `/` (Next 16 `proxy.ts` fails the
 * build entirely, and a `next.config` `redirects()` `has`-query rule on `/`
 * 500'd the live homepage in production) and doesn't apply here. No auth
 * gate of its own — this route does no D1 read at all, so there's nothing
 * to guard; the redirect target (/admin/places) enforces its own.
 *
 * `?show=review` on the redirect target pre-selects the "To review"
 * quick-filter chip, so a bookmark that used to land on a queue of pending
 * items still lands somewhere that shows exactly that.
 */

import { redirect } from "next/navigation";

export default function FlagsPage(): never {
  redirect("/admin/places?show=review");
}
