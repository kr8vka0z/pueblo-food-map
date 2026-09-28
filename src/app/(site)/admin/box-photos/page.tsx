/**
 * /admin/box-photos — retired (#677, "fold Photo review and Sponsor
 * requests into the Blessing Boxes tab"). The photo moderation queue this
 * page used to render (BoxPhotosReviewView.tsx, now deleted) is folded into
 * the Blessing Boxes tab: every pending/flagged photo shows on its box's
 * own row (the "To review" column, AllBoxesTable.tsx) and resolves from
 * that box's own edit page (BoxReviewBox.tsx).
 *
 * Kept as a redirect rather than deleted outright — same reasoning
 * /admin/flags/page.tsx's own header gives: an admin's existing
 * bookmark/muscle-memory still points here, and a plain Server Component
 * `redirect()` at a non-root path is safe (AGENTS.md's "no server-side
 * redirect" footgun is specifically about `/`). No auth gate of its own —
 * this route does no D1 read, so there's nothing to guard; the redirect
 * target (/admin/boxes) enforces its own.
 *
 * `?show=review` on the redirect target pre-selects the tab's own "To
 * review" chip (AllBoxesTable's initialShowReview), so a bookmark that used
 * to land on a queue of pending photos still lands somewhere that shows
 * exactly that.
 */

import { redirect } from "next/navigation";

export default function BoxPhotosPage(): never {
  redirect("/admin/boxes?show=review");
}
