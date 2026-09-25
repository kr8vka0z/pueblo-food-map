/**
 * /suggest — suggest a new venue page.
 *
 * Server component with a static English `metadata` export (crawler
 * metadata stays English-only, ARCHITECTURE.md "Known bilingual limitation",
 * #287). The visible body is SuggestPageContent — a client component
 * reading the visitor's locale via useLocale() (#289) — so this route never
 * reads cookies() itself and keeps its 100% static caching.
 *
 * Updated in #155: SiteFooter added.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import SuggestPageContent from "@/components/SuggestPageContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Suggest a Place",
  description:
    "Know a food pantry, community garden, or other food resource missing from the map? Suggest it for Pueblo Food Map.",
  path: "/suggest",
});

export default function SuggestPage() {
  return <SuggestPageContent />;
}
