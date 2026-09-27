/**
 * /admin/box-adopters — retired (#677, "fold Photo review and Sponsor
 * requests into the Blessing Boxes tab"). The sponsor-request moderation
 * queue this page used to render (BoxAdoptersReviewView.tsx, now deleted)
 * is folded into the Blessing Boxes tab: every pending request shows on its
 * box's own row (the "To review" column, AllBoxesTable.tsx) and resolves
 * from that box's own edit page (BoxReviewBox.tsx).
 *
 * Kept as a redirect rather than deleted outright — same reasoning
 * /admin/box-photos/page.tsx's own header gives (which mirrors
 * /admin/flags/page.tsx): bookmarks/muscle-memory, and a plain Server
 * Component `redirect()` at a non-root path is safe. No auth gate of its
 * own — this route does no D1 read; the redirect target enforces its own.
 */

import { redirect } from "next/navigation";

export default function BoxAdoptersPage(): never {
  redirect("/admin/boxes?show=review");
}
