/**
 * app/(site)/not-found.tsx — branded 404 page (#288).
 *
 * Stays a Server Component with a static English `metadata` export (crawler
 * metadata is deliberately English-only, ARCHITECTURE.md "Known bilingual
 * limitation", #287). The visible body is NotFoundContent — a client
 * component reading the visitor's locale via useLocale() (#289) — because
 * this file must not read cookies() itself: that would force dynamic
 * rendering, which a branded error page shouldn't need.
 *
 * This handles notFound() thrown from within the (site) route tree
 * (venue/[id], box/[id], event/[id], report/[venueId]) — it composes with
 * (site)/layout.tsx as before. A truly unmatched URL, with no route in the
 * tree at all, is handled by app/global-not-found.tsx instead (#689 PR 1;
 * required once (site)/ became a route group with no top-level
 * app/layout.tsx — see that file's header).
 */
import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return <NotFoundContent />;
}
