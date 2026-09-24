"use client";

/**
 * AlertsStopContent — the visible body of /alerts/stop (Blessing Boxes
 * slice 6).
 *
 * 2026-09-18 security review (item 6): the mutation used to happen
 * server-side in the page's own GET handler (a mail scanner's prefetch
 * would silently unsubscribe someone — see page.tsx's own header for the
 * full reasoning). Now this Client Component owns the mutation instead:
 * one auto-POST to /api/public/alerts/stop, fired from a mount effect —
 * real JS in a real browser runs it immediately (so a human still gets a
 * true one-click stop with no button to press), while a scanner that only
 * fetches the page's static HTML never executes it. `startedRef` guards
 * against firing twice under React StrictMode's dev-mode double-invoke of
 * effects — a local ref, not bundled into any returned/shared state object
 * (same rule this repo's react-hooks/refs lint rule enforces on
 * useBoxTurnstileWidget.ts's container ref).
 *
 * <noscript> fallback: a visitor with JS disabled gets none of the above —
 * the effect never runs, so the page would otherwise show "Stopping…"
 * forever with no way out. The fallback is a plain HTML form whose
 * `action` already carries the token in the query string (the exact shape
 * POST /api/public/alerts/stop already accepts for RFC 8058 one-click
 * unsubscribes — see that route's own header), so submitting it needs no
 * JS at all. A passive HTML-fetching scanner can't submit a form; only a
 * real click does.
 */

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import PageNav, { PAGE_NAV_CLEARANCE } from "@/components/PageNav";
import SiteFooter from "@/components/SiteFooter";

export type AlertsStopResult = "checking" | "stopped" | "invalid" | "unavailable";

type UndoState = "idle" | "undoing" | "undone" | "error";

/** Posts the stop request and maps every outcome to a render-able result — never throws. */
async function stopByToken(token: string): Promise<AlertsStopResult> {
  try {
    const res = await fetch("/api/public/alerts/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return "unavailable";
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return data?.ok ? "stopped" : "invalid";
  } catch {
    return "unavailable";
  }
}

export default function AlertsStopContent({ token }: { token: string }) {
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — alerts.stop.heading's EN
  // value ("Emails stopped") matches page.tsx's metadata title exactly.
  useDocumentTitle(pageDocumentTitle(t("alerts.stop.heading", locale)));
  const [result, setResult] = useState<AlertsStopResult>(token ? "checking" : "invalid");
  const [undoState, setUndoState] = useState<UndoState>("idle");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;
    void stopByToken(token).then(setResult);
  }, [token]);

  async function handleUndo() {
    setUndoState("undoing");
    try {
      const res = await fetch("/api/public/alerts/resubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      setUndoState(res.ok && data?.ok ? "undone" : "error");
    } catch {
      setUndoState("error");
    }
  }

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

      <div className="flex-1 w-full max-w-md mx-auto px-4 py-10 text-center">
        <h1
          className="text-2xl font-normal text-[var(--color-ink-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("alerts.stop.heading", locale)}
        </h1>

        {result === "checking" && (
          <p role="status" className="mt-4 text-sm text-[var(--color-ink-700)]">
            {t("alerts.stop.stopping", locale)}
          </p>
        )}

        {result === "stopped" && (
          <>
            <p role="status" className="mt-4 text-sm text-[var(--color-ink-700)]">
              {t("alerts.stop.body", locale)}
            </p>

            {undoState === "undone" ? (
              <p role="status" className="mt-6 text-sm text-[var(--color-ink-700)]">
                {t("alerts.stop.undone", locale)}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoState === "undoing"}
                  className={
                    "mt-6 min-h-[44px] px-4 text-sm font-medium text-[var(--color-sage-600)] underline " +
                    "underline-offset-2 hover:text-[var(--color-sage-700)] " +
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  }
                >
                  {undoState === "undoing" ? t("alerts.stop.undoing", locale) : t("alerts.stop.undoButton", locale)}
                </button>
                {undoState === "error" && (
                  <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
                    {t("alerts.stop.undoError", locale)}
                  </p>
                )}
              </>
            )}
          </>
        )}

        {result === "invalid" && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {t("alerts.stop.invalid", locale)}
          </p>
        )}
        {result === "unavailable" && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {t("alerts.confirm.error", locale)}
          </p>
        )}

        {token && (
          <noscript>
            <form action={`/api/public/alerts/stop?t=${encodeURIComponent(token)}`} method="post" className="mt-6">
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] text-sm font-semibold"
              >
                {t("alerts.stop.noscriptButton", locale)}
              </button>
            </form>
          </noscript>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
