/**
 * /boxes/activity — the public blessing-box activity log (Blessing Boxes
 * slice 3, Discovery stories D1/D2).
 *
 * Static server shell + English `metadata` export, same split as /venues'
 * page.tsx: crawler metadata stays static/English (AGENTS.md "Known
 * bilingual limitation", #287), the actual live/localized content is a
 * client component (BoxesActivityContent) that fetches
 * GET /api/public/blessing-boxes/activity itself — this route never reads
 * D1 or cookies() directly, so it stays trivially static.
 *
 * Suspense boundary: BoxesActivityContent reads the initial `?box=<id>`
 * query param via useSearchParams() (so BoxContent's "See full activity"
 * link, D3, lands pre-filtered) — Next requires any useSearchParams() call
 * to sit under a <Suspense> boundary so the rest of this otherwise-static
 * route can still prerender.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import BoxesActivityContent from "@/components/BoxesActivityContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Blessing Box Activity",
  description:
    "See every recent fill, low report, empty report, and box change across Pueblo's blessing box network.",
  path: "/boxes/activity",
});

export default function BoxesActivityPage() {
  return (
    <Suspense fallback={null}>
      <BoxesActivityContent />
    </Suspense>
  );
}
