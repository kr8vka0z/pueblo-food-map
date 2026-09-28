/**
 * /admin/submissions — retired (#675, "fold the Review queue into Places").
 * The review queue this page used to render (SubmissionsReviewView.tsx, now
 * deleted) is folded into the Places tab: every pending public submission
 * shows on its reported place's own row (a closure/problem report) or as
 * its own "Suggested new place" row (a new_venue suggestion), both tagged
 * "Public" — and resolves from that place's own edit page
 * (SuggestionsBox.tsx's SubmissionCard) or, for a new place, the prefilled
 * /admin/venues/new?submission=<id> form (unchanged).
 *
 * Kept as a redirect rather than deleted outright — same reasoning
 * /admin/flags/page.tsx's and /admin/box-photos/page.tsx's own headers
 * give: an admin's existing bookmark/muscle-memory still points here, and a
 * plain Server Component `redirect()` at a non-root path is safe
 * (AGENTS.md's "no server-side redirect" footgun is specifically about
 * `/`). No auth gate of its own — this route does no D1 read, so there's
 * nothing to guard; the redirect target (/admin/places) enforces its own.
 *
 * `?show=review&from=public` on the redirect target pre-selects the
 * Places tab's own "To review" quick filter AND "The public" source filter
 * (VenueListView's `initialShowReview`/`initialSourceFilter` props, set
 * server-side from these two params — src/app/(site)/admin/places/page.tsx), so a
 * bookmark that used to land on a queue of pending submissions still lands
 * somewhere that shows exactly that.
 */

import { redirect } from "next/navigation";

export default function SubmissionsPage(): never {
  redirect("/admin/places?show=review&from=public");
}
