/**
 * /boxes — the public directory of every blessing box (Blessing Boxes
 * slice 4, Discovery stories B2/B3/B5/B6).
 *
 * Static server shell + English `metadata` export, same split as
 * /venues/page.tsx and /boxes/activity/page.tsx: crawler metadata stays
 * static/English (AGENTS.md "Known bilingual limitation", #287); the live,
 * localized, sortable content is a client component (BoxesDirectoryContent)
 * that fetches GET /api/public/blessing-boxes itself — this route never
 * reads D1 or cookies() directly, so it stays trivially static.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import BoxesDirectoryContent from "@/components/BoxesDirectoryContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Blessing Boxes",
  description:
    "Find every blessing box in Pueblo's network, sorted by which ones need filling most, or by which is closest to you.",
  path: "/boxes",
});

export default function BoxesPage() {
  return <BoxesDirectoryContent />;
}
