/**
 * /alerts/stop — visiting this page (a GET) stops the emails immediately.
 * Blessing Boxes slice 6, and a deliberate asymmetry with /alerts/confirm's
 * button-click POST: stopSubscriptionByToken's own header comment
 * (src/lib/boxAlerts.ts) states the rule plainly — "a mail scanner
 * prefetching the link only causes an unwanted unsubscribe, the safe
 * direction" — so this Server Component calls it directly at request time,
 * same secret/D1-access convention every other public write on this box
 * surface uses (process.env.CHECKIN_RATE_LIMIT_SECRET,
 * getCloudflareContext().env.ADMIN_DB). The "turn it back on" undo is the
 * one action that DOES require a real click — AlertsStopContent's button
 * POSTs to /api/public/alerts/resubscribe.
 *
 * `robots: noindex` + next.config.ts's `Referrer-Policy: no-referrer`
 * override on this path — see /alerts/confirm/page.tsx's own header for
 * why (the token lives in the URL).
 */

import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildPageMetadata } from "@/lib/site";
import { stopSubscriptionByToken } from "@/lib/boxAlerts";
import { logBlessingBoxesReadFailure } from "@/lib/logger";
import AlertsStopContent, { type AlertsStopResult } from "@/components/AlertsStopContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Emails stopped",
    description: "Stop Blessing Box email alerts.",
    path: "/alerts/stop",
  }),
  robots: { index: false, follow: false },
};

async function stopByToken(token: string): Promise<AlertsStopResult> {
  const rateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!rateLimitSecret) {
    logBlessingBoxesReadFailure("CHECKIN_RATE_LIMIT_SECRET not configured");
    return "unavailable";
  }
  try {
    const { env } = getCloudflareContext();
    const result = await stopSubscriptionByToken(env.ADMIN_DB, token, rateLimitSecret);
    if (result === "stopped") return "stopped";
    if (result === "rate_limited") return "rateLimited";
    return "invalid";
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return "unavailable";
  }
}

export default async function AlertsStopPage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string }>;
}) {
  const { t: rawToken } = searchParams ? await searchParams : {};
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const result: AlertsStopResult = token ? await stopByToken(token) : "invalid";

  return <AlertsStopContent result={result} token={token} />;
}
