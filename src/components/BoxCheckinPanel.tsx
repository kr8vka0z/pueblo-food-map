"use client";

/**
 * BoxCheckinPanel — the public check-in panel on /box/[id] (Blessing Boxes
 * slice 2, Discovery stories C1-C4: "I filled it" / "I took something" /
 * "Running low" / "It's empty" / "Report a problem").
 *
 * Five buttons, one tap each. 'took'/'low'/'empty' submit immediately —
 * "one tap ... no note, no extra screen" (Build Plan). 'filled'/'problem'
 * expand a small optional-note form first (this slice's own scope: "optional
 * short note on filled and problem").
 *
 * Turnstile mount/reset mirrors ReportForm.tsx's own widget lifecycle
 * (mount once the CF script loads; the sitekey/container pattern is
 * identical) with one addition: a Turnstile token is single-use, so this
 * panel resets the widget after EVERY submit attempt, not only a failed
 * one — a user can tap more than once in the same page view (e.g. "took"
 * now, "empty" later), and the second tap would otherwise silently fail
 * Turnstile verification with a stale, already-consumed token.
 *
 * onCheckinSuccess lifts the POST response's fresh status/lastFilledAt
 * straight into BoxContent's own state — no refetch, no dependency on the
 * list endpoint's 60s cache (see the route handler's own header for the
 * full freshness story).
 */

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import type { BoxStatus, CheckinKind } from "@/lib/blessingBoxes";

const { BOX_CHECKIN_NOTE } = FIELD_LIMITS;

/** Display order — 'took' first, since it's the single most common action (Discovery C2) and needs to be reachable with zero extra taps. */
const CHECKIN_KINDS: readonly CheckinKind[] = ["took", "filled", "low", "empty", "problem"];
const KINDS_WITH_NOTE: ReadonlySet<CheckinKind> = new Set(["filled", "problem"]);

interface BoxCheckinPanelProps {
  boxId: string;
  /**
   * `kind` was added for the map-first card rework (2026-09-18): the card
   * shows the single most recent check-in inline, and the POST response
   * body never echoes back which kind was just submitted — the caller
   * already knows it (it's what it just sent), so it's threaded through
   * here rather than re-fetched.
   */
  onCheckinSuccess: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
}

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error"
  // Split 2026-09-17 (review correction) from one shared "rate_limited" —
  // the route now returns two distinct error codes (rate_limit_visitor vs.
  // rate_limit_box) so the copy can say WHOSE cap tripped instead of one
  // message that misdirected blame either way.
  | "rate_limited_visitor"
  | "rate_limited_box";

export default function BoxCheckinPanel({ boxId, onCheckinSuccess }: BoxCheckinPanelProps) {
  const { locale } = useLocale();

  const [openKind, setOpenKind] = useState<CheckinKind | null>(null);
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [lastKind, setLastKind] = useState<CheckinKind | null>(null);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  function mountTurnstile() {
    if (!turnstileContainerRef.current || !window.turnstile) return;
    if (turnstileWidgetId.current) return; // already mounted

    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError(false);
      },
      "error-callback": () => {
        setTurnstileToken(null);
        setTurnstileError(true);
      },
      "expired-callback": () => {
        setTurnstileToken(null);
      },
    });
  }

  useEffect(() => {
    if (window.turnstile) mountTurnstile();
    return () => {
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, []);

  async function submitCheckin(kind: CheckinKind, noteValue: string) {
    setSubmitState("submitting");
    setLastKind(kind);

    try {
      const res = await fetch(`/api/public/blessing-boxes/${boxId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          note: noteValue || undefined,
          website: honeypot, // honeypot field
          turnstileToken: turnstileToken ?? "",
          clientToken: getCheckinClientToken() ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        status?: BoxStatus;
        lastFilledAt?: string | null;
      };

      // Every Turnstile token is single-use — reset for the next possible
      // tap regardless of outcome (see this file's own header).
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current);
      }
      setTurnstileToken(null);

      if (data.ok) {
        setSubmitState("success");
        setOpenKind(null);
        setNote("");
        if (data.status) {
          onCheckinSuccess({ status: data.status, lastFilledAt: data.lastFilledAt ?? null, kind });
        }
      } else if (data.error === "rate_limit_visitor") {
        setSubmitState("rate_limited_visitor");
      } else if (data.error === "rate_limit_box") {
        setSubmitState("rate_limited_box");
      } else {
        setSubmitState("error");
      }
    } catch {
      setSubmitState("error");
    }
  }

  function handleTap(kind: CheckinKind) {
    if (submitState === "submitting") return;
    if (KINDS_WITH_NOTE.has(kind)) {
      setOpenKind(kind);
      setNote("");
      setSubmitState("idle");
      return;
    }
    void submitCheckin(kind, "");
  }

  function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openKind) return;
    void submitCheckin(openKind, note.trim());
  }

  const buttonBase =
    "min-h-[44px] px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium text-center " +
    "transition-colors duration-150 border border-[var(--color-bone-300)] text-[var(--color-ink-700)] bg-white " +
    "hover:bg-[var(--color-bone-100)] focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-[var(--color-sage-500)] disabled:opacity-60 disabled:cursor-not-allowed";

  const canSubmit = submitState !== "submitting" && !!turnstileToken;

  return (
    <section aria-labelledby="box-checkin-heading" className="space-y-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={mountTurnstile}
      />
      <h2
        id="box-checkin-heading"
        className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)]"
      >
        {t("box.checkin.heading", locale)}
      </h2>

      <div role="status" aria-live="polite">
        {submitState === "success" && lastKind && (
          <p className="text-sm font-medium text-[var(--color-success)]">
            {t(`box.checkin.success.${lastKind}`, locale)}
          </p>
        )}
      </div>
      {submitState === "error" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error", locale)}
        </p>
      )}
      {submitState === "rate_limited_visitor" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error.rateLimitVisitor", locale)}
        </p>
      )}
      {submitState === "rate_limited_box" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error.rateLimitBox", locale)}
        </p>
      )}
      {turnstileError && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("form.turnstile.error", locale)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CHECKIN_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={buttonBase}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            onClick={() => handleTap(kind)}
          >
            {t(`box.checkin.${kind}`, locale)}
          </button>
        ))}
      </div>

      {!turnstileToken && submitState !== "submitting" && (
        <p className="text-xs text-[var(--color-ink-400)]">{t("form.turnstile.verifying", locale)}</p>
      )}

      {openKind && (
        <form onSubmit={handleNoteSubmit} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] p-3">
          <label htmlFor="box-checkin-note" className="block text-xs font-medium text-[var(--color-ink-700)]">
            {t("box.checkin.noteLabel", locale)}
          </label>
          <textarea
            id="box-checkin-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={BOX_CHECKIN_NOTE}
            placeholder={t(`box.checkin.notePlaceholder.${openKind}`, locale)}
            className={
              "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 " +
              "text-base md:text-sm text-[var(--color-ink-900)] bg-white resize-y " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              className={
                "min-h-[44px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
                "text-sm font-semibold hover:bg-[var(--color-sage-600)] disabled:opacity-60 disabled:cursor-not-allowed " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
              }
            >
              {submitState === "submitting" ? t("box.checkin.submitting", locale) : t("box.checkin.submit", locale)}
            </button>
            <button
              type="button"
              onClick={() => setOpenKind(null)}
              className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]"
            >
              {t("box.checkin.cancel", locale)}
            </button>
          </div>
        </form>
      )}

      {/* Honeypot — visually hidden from real users, same convention as ReportForm.tsx */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="box-checkin-website">Website</label>
        <input
          id="box-checkin-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div ref={turnstileContainerRef} data-testid="turnstile-widget" />
    </section>
  );
}
