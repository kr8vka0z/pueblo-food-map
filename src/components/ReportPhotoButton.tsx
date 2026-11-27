"use client";

/**
 * ReportPhotoButton — "Report this photo" (Blessing Boxes slice 5). Shared
 * by BoxCardBody (the map card's single most-recent-photo slot) and
 * BoxHistoryContent (the history page's photo grid).
 *
 * Inline confirmation (#959): replaces native `window.confirm()` with an
 * on-page two-button confirmation matching DESIGN.md's "Confirming a risky
 * action" pattern (Cancel first, focused on open; red destructive action second).
 */

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useAdminConfirm } from "@/components/AdminConfirm";

type ReportState = "idle" | "submitting" | "done" | "error";

export default function ReportPhotoButton({ photoId, locale }: { photoId: number; locale: Locale }) {
  const [state, setState] = useState<ReportState>("idle");
  const { asking, ask, cancel, triggerRef } = useAdminConfirm();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) {
      cancelRef.current?.focus();
    }
  }, [asking]);

  async function handleConfirm() {
    setState("submitting");
    try {
      const res = await fetch(`/api/public/box-photos/${photoId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientToken: getCheckinClientToken() ?? undefined }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        cancel();
        setState("done");
      } else {
        cancel();
        setState("error");
      }
    } catch {
      cancel();
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="text-xs text-[var(--color-ink-500)]">{t("box.photo.reportThanks", locale)}</p>;
  }

  const busy = state === "submitting";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        ref={triggerRef}
        type="button"
        hidden={asking}
        onClick={() => {
          setState("idle");
          ask();
        }}
        className="relative before:absolute before:inset-x-0 before:-inset-y-0.5 inline-flex min-h-[44px] items-center text-xs font-medium text-[var(--color-sage-700)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
      >
        {t("box.photo.report", locale)}
      </button>
      {asking && (
        <div
          role="group"
          aria-label={t("box.photo.reportConfirm", locale)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
          className="w-full space-y-2 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-[var(--color-bone-100)] p-3"
        >
          <p className="text-xs font-medium text-[var(--color-ink-900)]">{t("box.photo.reportConfirm", locale)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              ref={cancelRef}
              type="button"
              disabled={busy}
              onClick={cancel}
              className={
                "min-h-12 px-4 rounded-[var(--radius-md)] border border-[var(--color-ink-400)] bg-white " +
                "text-sm font-medium text-[var(--color-ink-700)] transition-colors duration-150 " +
                "hover:bg-[var(--color-sage-100)] " +
                PRESS_FEEDBACK + " " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
                "disabled:opacity-60 disabled:cursor-not-allowed"
              }
            >
              {t("box.checkin.cancel", locale)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm()}
              className={
                "min-h-12 px-4 rounded-[var(--radius-md)] bg-[var(--color-danger)] text-[var(--color-bone-50)] " +
                "text-sm font-semibold transition-colors duration-150 " +
                PRESS_FEEDBACK + " " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
                "disabled:opacity-60 disabled:cursor-not-allowed"
              }
            >
              {busy ? t("box.photo.reporting", locale) : t("box.photo.reportConfirmAction", locale)}
            </button>
          </div>
        </div>
      )}
      {!asking && state === "error" && (
        <p role="alert" className="flex items-start gap-1 text-xs text-[var(--color-danger)]">
          <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>{t("box.photo.reportError", locale)}</span>
        </p>
      )}
    </div>
  );
}
