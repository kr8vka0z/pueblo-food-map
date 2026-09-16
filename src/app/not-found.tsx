/**
 * not-found.tsx — branded 404 page (#288).
 *
 * Stays a Server Component with a static English `metadata` export (crawler
 * metadata is deliberately English-only, AGENTS.md "Known bilingual
 * limitation", #287). The visible body is NotFoundContent — a client
 * component reading the visitor's locale via useLocale() (#289) — because
 * this file must not read cookies() itself: that would force dynamic
 * rendering, which a branded error page shouldn't need.
 */
import type { Metadata } from "next";
import NotFoundContent from "@/components/NotFoundContent";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return <NotFoundContent />;
}
