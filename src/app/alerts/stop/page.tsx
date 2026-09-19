/**
 * /alerts/stop — Blessing Boxes slice 6.
 *
 * 2026-09-18 security review (item 6): this page used to mutate on its own
 * GET (calling stopSubscriptionByToken directly at request time) — the
 * previous "deliberate asymmetry" with /alerts/confirm's button-click POST,
 * reasoned as: "the safe failure direction for a prefetched unsubscribe
 * link is an unwanted unsubscribe, not a wrongly-confirmed signup." That
 * reasoning still holds for what a HUMAN visiting the link wants (one click,
 * no button), but a bare server-side GET is also exactly what a mail
 * client's link-prefetch/security scanner does — fetching the page's HTML
 * to render a preview or check for malware, never intending to unsubscribe
 * anyone. A GET-mutates page can't tell the two apart.
 *
 * Fixed by moving the mutation out of the GET entirely: this Server
 * Component only renders (no D1 access, no stopSubscriptionByToken call).
 * AlertsStopContent (a Client Component) auto-POSTs to
 * POST /api/public/alerts/stop once on mount — a prefetch/HTML-only scanner
 * never executes that JS, so it triggers nothing; a real human's browser
 * runs it immediately, so the one-click experience is preserved. The
 * <noscript> fallback (AlertsStopContent's own header) covers a human with
 * JS disabled, who still needs SOME way to stop the emails without a
 * prefetch scanner also being able to trigger it — a real POST from a
 * user-submitted HTML form is not something a passive HTML-fetching scanner
 * generates.
 *
 * `robots: noindex` + next.config.ts's `Referrer-Policy: no-referrer`
 * override on this path — see /alerts/confirm/page.tsx's own header for
 * why (the token lives in the URL).
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import AlertsStopContent from "@/components/AlertsStopContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Emails stopped",
    description: "Stop Blessing Box email alerts.",
    path: "/alerts/stop",
  }),
  robots: { index: false, follow: false },
};

export default async function AlertsStopPage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string }>;
}) {
  const { t: rawToken } = searchParams ? await searchParams : {};
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  return <AlertsStopContent token={token} />;
}
