/**
 * /blessing-boxes — read-only list of every live blessing box, each linking to its map card (SEO/AEO plan Phase 3, #709 PR B).
 *
 * WHY force-dynamic: boxes live only in D1 (never the build-time venue
 * snapshot) and admin edits must show immediately, so this renders per
 * request, like /box/[id]. Route-segment config: it affects only this route.
 * List and link only — no check-in, photo, adopt or alert controls (REVIEW.md
 * /blessing-boxes exception). Reads via src/lib/blessingBoxesHubData.ts.
 */

import type { Metadata } from "next";
import { BlessingBoxesHub } from "@/components/HubPages";
import { boxesHubMetadata, loadBoxesHubData } from "@/lib/blessingBoxesHubData";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return boxesHubMetadata("en");
}

export default async function BlessingBoxesPage() {
  const { boxes, degraded } = await loadBoxesHubData();
  return <BlessingBoxesHub locale="en" boxes={boxes} degraded={degraded} />;
}
