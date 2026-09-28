/**
 * /privacy — short privacy disclosure page.
 *
 * Linked from all three submission forms (report, suggest, feedback) near
 * the email field to inform users from a vulnerable population what their
 * contact information is used for. Issue #160 item 1.7.
 *
 * Updated in #155: SiteFooter added so the About link is reachable from all
 * utility pages (required for footer AC).
 *
 * Server component with a static English `metadata` export (crawler
 * metadata stays English-only, ARCHITECTURE.md "Known bilingual limitation",
 * #287). The visible body is PrivacyContent — a client component reading
 * the visitor's locale via useLocale() (#289) — so this route never reads
 * cookies() itself and keeps its 100% static caching.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import PrivacyContent from "@/components/PrivacyContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy",
  description:
    "Privacy policy for Pueblo Food Map — what information is collected and how it is used.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <PrivacyContent />;
}
