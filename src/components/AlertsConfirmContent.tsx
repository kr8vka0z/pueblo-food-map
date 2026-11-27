"use client";

/**
 * AlertsConfirmContent — the visible body of /alerts/confirm (Blessing
 * Boxes slice 6). A GET on this page must never mutate — mail scanners
 * prefetch links in transit — so this renders a plain Confirm button that
 * POSTs to /api/public/alerts/confirm on click; see that route's own
 * header for the full reasoning and the shared adopter+subscription token
 * lookup it does server-side.
 *
 * Reads the token from the `t` query param via useSearchParams() (the page
 * wraps this in <Suspense>, same convention BoxesActivityContent already
 * established for the same Next.js requirement). No token in the URL at
 * all skips straight to the invalid state — there's nothing to POST.
 */

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { pageDocumentTitle } from "@/lib/site";
import PageNav, { PAGE_NAV_CLEARANCE } from "@/components/PageNav";
import SiteFooter from "@/components/SiteFooter";
import SuccessTick from "@/components/SuccessTick";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

type ConfirmState = "idle" | "confirming" | "success" | "invalid" | "error";

export default function AlertsConfirmContent() {
  const { locale } = useLocale();
  // <title> follows locale client-side (#589) — alerts.confirm.heading's EN
  // value ("Confirm your email") matches page.tsx's metadata title exactly.
  useDocumentTitle(pageDocumentTitle(t("alerts.confirm.heading", locale)));
  const searchParams = useSearchParams();
  const token = searchParams.get("t")?.trim() ?? "";
  const [state, setState] = useState<ConfirmState>(token ? "idle" : "invalid");

  async function handleConfirm() {
    setState("confirming");
    try {
      const res = await fetch("/api/public/alerts/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      // Only the route's explicit invalid_token means a bad link (#894); a
      // 502 db_unavailable or an unreadable answer is temporary: "try again".
      setState(res.ok && data?.ok ? "success" : data?.error === "invalid_token" ? "invalid" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} />

      <div className="flex-1 w-full max-w-md mx-auto px-4 py-10 text-center">
        <h1
          className="text-2xl font-normal text-balance text-[var(--color-ink-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("alerts.confirm.heading", locale)}
        </h1>

        {state === "success" && (
          <div role="status" className="mt-4">
            <SuccessTick size={48} className="mx-auto mb-3" />
            <p className="text-sm text-[var(--color-ink-700)]">{t("alerts.confirm.success", locale)}</p>
          </div>
        )}
        {state === "invalid" && (
          <p role="alert" className="mt-4 inline-flex items-start justify-center gap-1.5 text-sm text-[var(--color-danger)]">
            <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span>{t("alerts.confirm.invalid", locale)}</span>
          </p>
        )}
        {state === "error" && (
          <p role="alert" className="mt-4 inline-flex items-start justify-center gap-1.5 text-sm text-[var(--color-danger)]">
            <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
            <span>{t("alerts.confirm.error", locale)}</span>
          </p>
        )}

        {(state === "idle" || state === "confirming" || state === "error") && (
          <>
            {state !== "error" && (
              <p className="mt-4 text-sm text-[var(--color-ink-700)]">{t("alerts.confirm.body", locale)}</p>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={state === "confirming"}
              className={
                "mt-6 min-h-12 px-6 rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
                "text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
                "hover:bg-[var(--color-sage-700)] " +
                PRESS_FEEDBACK + " " +
                "focus-visible:outline-none focus-visible:ring-2 " +
                "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
                "disabled:opacity-50 disabled:cursor-not-allowed"
              }
            >
              {state === "confirming"
                ? t("alerts.confirm.confirming", locale)
                : state === "error"
                  ? t("alerts.confirm.retry", locale)
                  : t("alerts.confirm.button", locale)}
            </button>
          </>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
