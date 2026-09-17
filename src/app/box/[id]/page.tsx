/**
 * /box/[id] — a single blessing box's public page (Blessing Boxes slice 1).
 *
 * WHY this is NOT in the pre-built venue set (unlike /venue/[id]'s
 * generateStaticParams + dynamicParams=false): boxes are live, not
 * published (Build Plan architecture call #1) — a box's row lives only in
 * D1, never in the build-time published-venues.ts snapshot, so there is no
 * fixed list of ids to prerender against and no rebuild required when a box
 * is added, edited, or removed. `force-dynamic` renders this page fresh on
 * every request, reading straight off D1 the same way the public
 * GET /api/public/blessing-boxes route does (src/lib/blessingBoxes.ts's
 * loadLiveBoxById) — best-effort: a D1 failure here 404s rather than
 * throwing a 500, same resilience posture as that route's own fallback.
 *
 * A box with no check-ins yet (slice 2 territory) always shows the
 * BOX_STATUS_PLACEHOLDER ("Unknown") — this page never computes a real
 * status.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildPageMetadata } from "@/lib/site";
import { loadLiveBoxById } from "@/lib/blessingBoxes";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import BoxContent from "@/components/BoxContent";

export const dynamic = "force-dynamic";

async function loadBox(id: string) {
  try {
    const { env } = getCloudflareContext();
    return await loadLiveBoxById(env.ADMIN_DB, id);
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const box = await loadBox(id);
  if (!box) return {};
  return buildPageMetadata({
    title: box.name,
    description: `${box.name} — a community blessing box in Pueblo, CO. ${box.address}.`,
    path: `/box/${box.id}`,
  });
}

export default async function BoxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const box = await loadBox(id);
  if (!box) notFound();

  return <BoxContent box={box} />;
}
