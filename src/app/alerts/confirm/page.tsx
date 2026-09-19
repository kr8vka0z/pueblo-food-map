/**
 * /alerts/confirm — double opt-in landing page for box host/adopter/giver
 * email alerts (Blessing Boxes slice 6). Static server shell (same
 * static-shell + Suspense split as /boxes/activity's page.tsx) — the real
 * work is AlertsConfirmContent's client-side POST to
 * /api/public/alerts/confirm; this route never reads D1 or cookies()
 * itself.
 *
 * `robots: noindex` (task spec, "Blessing Boxes" slice 6): the token lives
 * in the URL's `t` query param, so this page must never appear in search
 * results or get its URL logged by a crawler. See next.config.ts's
 * `headers()` for the matching `Referrer-Policy: no-referrer` override on
 * this same path — same "token in the URL" reasoning applied to outbound
 * link clicks, not just search indexing.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import AlertsConfirmContent from "@/components/AlertsConfirmContent";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Confirm your email",
    description: "Confirm your email to receive Blessing Box alerts.",
    path: "/alerts/confirm",
  }),
  robots: { index: false, follow: false },
};

export default function AlertsConfirmPage() {
  return (
    <Suspense fallback={null}>
      <AlertsConfirmContent />
    </Suspense>
  );
}
