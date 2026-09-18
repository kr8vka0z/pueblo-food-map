/**
 * /box/[id]/history — a single blessing box's full history (map-first
 * rework, scope addition 2026-09-18: Kyle wanted the in-map card to show
 * only the current snapshot, with a "History" link to "a separate page
 * where we could show all the historical information, check-ins, and all
 * that fun stuff").
 *
 * Same server-shell shape as the old /box/[id]/page.tsx this replaces as a
 * real destination: `force-dynamic` (boxes are live, not published — see
 * that file's own header, unchanged reasoning), `loadBox` reads D1 directly
 * for `generateMetadata`, best-effort degrade to `notFound()` on a D1
 * failure or an unknown id. The actual history LIST is
 * BoxHistoryContent.tsx (client), which reuses useBoxActivity/
 * BoxActivityList — the same activity read path slice 3 built, filtered to
 * this one box, not a second query.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildPageMetadata } from "@/lib/site";
import { loadLiveBoxById } from "@/lib/blessingBoxes";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import BoxHistoryContent from "@/components/BoxHistoryContent";

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
    title: `${box.name} — History`,
    description: `Full check-in and activity history for ${box.name}, a community blessing box in Pueblo, CO.`,
    path: `/box/${box.id}/history`,
  });
}

export default async function BoxHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const box = await loadBox(id);
  if (!box) notFound();

  return <BoxHistoryContent boxId={box.id} boxName={box.name} />;
}
