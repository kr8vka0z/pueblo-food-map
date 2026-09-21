"use client";

/**
 * ReportPhotoButton — "Report this photo" (Blessing Boxes slice 5). Shared
 * by BoxCardBody (the map card's single most-recent-photo slot) and
 * BoxHistoryContent (the history page's photo grid) — one small component
 * so the confirm-then-POST flow exists in exactly one place, same "reuse,
 * don't copy" convention this repo's box Turnstile logic already follows
 * (src/lib/boxTurnstile.ts).
 *
 * Confirm-first via a native `window.confirm()` — same no-new-dependency
 * convention ArchiveVenueButton/PublishPanel already use for a single
 * confirmation. No Turnstile (see the flag route's own header for why: a
 * report has no free-text field for a bot to abuse) — the per-visitor rate
 * limit on the server is the real anti-abuse control here.
 */

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { getCheckinClientToken } from "@/lib/checkinClientToken";

type ReportState = "idle" | "submitting" | "done" | "error";

export default function ReportPhotoButton({ photoId, locale }: { photoId: number; locale: Locale }) {
  const [state, setState] = useState<ReportState>("idle");

  async function handleClick() {
    if (!window.confirm(t("box.photo.reportConfirm", locale))) return;
    setState("submitting");
    try {
      const res = await fetch(`/api/public/box-photos/${photoId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientToken: getCheckinClientToken() ?? undefined }),
      });
      const data = (await res.json()) as { ok: boolean };
      setState(data.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="text-xs text-[var(--color-ink-500)]">{t("box.photo.reportThanks", locale)}</p>;
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "submitting"}
        className="inline-flex min-h-[44px] items-center text-xs font-medium text-[var(--color-sage-700)] underline underline-offset-2 disabled:opacity-60"
      >
        {state === "submitting" ? t("box.photo.reporting", locale) : t("box.photo.report", locale)}
      </button>
      {state === "error" && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("box.photo.reportError", locale)}
        </p>
      )}
    </div>
  );
}
