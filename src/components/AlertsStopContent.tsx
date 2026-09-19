"use client";

/**
 * AlertsStopContent — the visible body of /alerts/stop (Blessing Boxes
 * slice 6). The stop itself already happened server-side, in the page's
 * own GET handler (src/app/alerts/stop/page.tsx) — this component only
 * renders the outcome and, when it succeeded, the "that was a mistake"
 * undo button, which POSTs to /api/public/alerts/resubscribe (the one
 * action on this page that requires a real click, unlike the stop itself).
 */

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import PageNav, { PAGE_NAV_CLEARANCE } from "@/components/PageNav";
import SiteFooter from "@/components/SiteFooter";

export type AlertsStopResult = "stopped" | "invalid" | "rateLimited" | "unavailable";

type UndoState = "idle" | "undoing" | "undone" | "error";

export default function AlertsStopContent({ result, token }: { result: AlertsStopResult; token: string }) {
  const { locale } = useLocale();
  const [undoState, setUndoState] = useState<UndoState>("idle");

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
        {result === "rateLimited" && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {t("alerts.stop.rateLimited", locale)}
          </p>
        )}
        {result === "unavailable" && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {t("alerts.confirm.error", locale)}
          </p>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
