/**
 * /es/blessing-boxes — Spanish twin of /blessing-boxes (SEO/AEO plan Phase 3, #709 PR B).
 *
 * Same force-dynamic D1 read as the EN page (see its header for why); the ES
 * tree's own root layout supplies <html lang="es">.
 */

import type { Metadata } from "next";
import { BlessingBoxesHub } from "@/components/HubPages";
import { boxesHubMetadata, loadBoxesHubData } from "@/lib/blessingBoxesHubData";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
  return boxesHubMetadata("es");
}

export default async function EsBlessingBoxesPage() {
  const { boxes, degraded } = await loadBoxesHubData();
  return <BlessingBoxesHub locale="es" boxes={boxes} degraded={degraded} />;
}
