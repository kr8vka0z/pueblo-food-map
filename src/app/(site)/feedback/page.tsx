/**
 * /feedback — general feedback form page.
 *
 * Server component with a static English `metadata` export (crawler
 * metadata stays English-only, ARCHITECTURE.md "Known bilingual limitation",
 * #287). The visible body is FeedbackPageContent — a client component
 * reading the visitor's locale via useLocale() (#289) — so this route never
 * reads cookies() itself and keeps its 100% static caching.
 *
 * Updated in #155: SiteFooter added.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import FeedbackPageContent from "@/components/FeedbackPageContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Send Feedback",
  description:
    "Share feedback, report a problem, or suggest an improvement to Pueblo Food Map.",
  path: "/feedback",
});

export default function FeedbackPage() {
  return <FeedbackPageContent />;
}
