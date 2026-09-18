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
 * Widget visibility (2026-09-18, Kyle: "Do we need to show the Cloudflare
 * check?"): rendered with `appearance: "interaction-only"` — the widget
 * stays invisible and check-in buttons are tappable right away; Cloudflare
 * only shows its chrome in the rare case it needs a real interactive
 * challenge. That means a tap CAN land before a token exists yet. Rather
 * than block the whole panel on it (the old "Verifying…" line + disabled
 * buttons) or silently drop the tap, the tapped kind is queued
 * (`pendingSubmit`) and an effect fires it the moment `turnstileToken`
 * resolves — the tapped button shows the same "Sending…" label a real
 * in-flight submit uses, everything else disables for the moment so a
 * second tap can't race it. Token expiry is already handled the same way:
 * Turnstile's own `expired-callback` clears `turnstileToken`, and the next
 * tap (or an already-queued one) waits for the callback's next token exactly
 * like the first one did.
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

  // A tap that lands before Turnstile's invisible check resolves queues here
  // instead of being dropped or blocking the panel — see this file's own
  // header. Cleared the instant the queued submit actually fires.
  const [pendingSubmit, setPendingSubmit] = useState<{ kind: CheckinKind; note: string } | null>(null);

  function mountTurnstile() {
    if (!turnstileContainerRef.current || !window.turnstile) return;
    if (turnstileWidgetId.current) return; // already mounted

    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
      // Invisible unless Cloudflare decides it actually needs a person to
      // interact (Kyle, 2026-09-18) — see this file's own header.
      appearance: "interaction-only",
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

  // Fires a queued tap the moment a token becomes available (first mount,
  // or after `expired-callback` clears a stale one and Turnstile hands back
  // a fresh one). setPendingSubmit is deferred to a microtask — same
  // react-hooks/set-state-in-effect workaround DesktopVenueWindow's own
  // position effect uses (see its own header) — calling it synchronously in
  // the effect body is a lint error (cascading-render risk), even though
  // it's cleared before the async submitCheckin call starts, not after.
  useEffect(() => {
    if (!turnstileToken || !pendingSubmit) return;
    const { kind, note: noteValue } = pendingSubmit;
    queueMicrotask(() => setPendingSubmit(null));
    void submitCheckin(kind, noteValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submitCheckin closes over this render's turnstileToken/honeypot/boxId already; re-running per pendingSubmit/turnstileToken change (not per render) is what this effect wants.
  }, [turnstileToken, pendingSubmit]);

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
    if (submitState === "submitting" || pendingSubmit) return;
    if (KINDS_WITH_NOTE.has(kind)) {
      setOpenKind(kind);
      setNote("");
      setSubmitState("idle");
      return;
    }
    if (turnstileToken) {
      void submitCheckin(kind, "");
    } else {
      // No token yet (interaction-only Turnstile hasn't resolved) — queue
      // instead of submitting with an empty token or dropping the tap. The
      // effect above fires it the moment turnstileToken arrives.
      setPendingSubmit({ kind, note: "" });
    }
  }

  function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openKind) return;
    const kind = openKind;
    const noteValue = note.trim();
    setOpenKind(null);
    setNote("");
    if (turnstileToken) {
      void submitCheckin(kind, noteValue);
    } else {
      setPendingSubmit({ kind, note: noteValue });
    }
  }

  const buttonBase =
    "min-h-[44px] px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium text-center " +
    "transition-colors duration-150 border border-[var(--color-bone-300)] text-[var(--color-ink-700)] bg-white " +
    "hover:bg-[var(--color-bone-100)] focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-[var(--color-sage-500)] disabled:opacity-60 disabled:cursor-not-allowed";

  // One action at a time: busy while an actual submit is in flight OR one is
  // queued waiting on a token (see handleTap/handleNoteSubmit above) — never
  // gated on turnstileToken alone, since that would be the old "disabled
  // until Verifying… resolves" behavior this rework removes.
  const busy = submitState === "submitting" || pendingSubmit !== null;
  // Which single button (if any) shows the "Sending…" label — either the
  // tap actually in flight, or the one queued waiting on a token.
  const busyKind = pendingSubmit?.kind ?? (submitState === "submitting" ? lastKind : null);

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
            disabled={busy}
            aria-disabled={busy}
            onClick={() => handleTap(kind)}
          >
            {kind === busyKind ? t("box.checkin.submitting", locale) : t(`box.checkin.${kind}`, locale)}
          </button>
        ))}
      </div>

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
              disabled={busy}
              aria-disabled={busy}
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
