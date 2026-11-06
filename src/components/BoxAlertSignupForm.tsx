"use client";

/**
 * BoxAlertSignupForm — the "Email me when it needs filling" inline-expand
 * form on a blessing box's card (Blessing Boxes slice 6, Build Plan card
 * UX item 4). Posts to POST /api/public/blessing-boxes/[id]/alerts (that
 * route's own header has the full guard order and rate-limit scopes) —
 * one field, email only. Shares AdoptBoxForm.tsx's Turnstile pieces
 * (useQueuedTurnstileSubmit in src/lib/useTurnstile.ts, CardFormTurnstile);
 * kept as a separate component rather than a shared base because the two
 * payload shapes and success copy differ enough that a shared wrapper
 * would need as many branches as it saved lines.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import { useQueuedTurnstileSubmit, useTurnstile } from "@/lib/useTurnstile";
import CardFormTurnstile from "@/components/CardFormTurnstile";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/components/BoxCheckinPanel";

type SubmitState = "idle" | "submitting" | "success" | "error" | "rateLimited";

interface BoxAlertSignupFormProps {
  boxId: string;
}

const RATE_LIMIT_ERRORS = new Set(["rate_limit_visitor", "rate_limit_email", "rate_limit_global"]);

export default function BoxAlertSignupForm({ boxId }: BoxAlertSignupFormProps) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  // The container ref stays LOCAL to this component (not returned by the
  // hook) — see useTurnstile.ts's own header for why (the React
  // Compiler ESLint rule flags a ref bundled into a hook's returned state
  // object).
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileContainerRef, { box: true });

  async function submit(emailValue: string) {
    setState("submitting");
    try {
      const res = await fetch(`/api/public/blessing-boxes/${boxId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          // The page's own current locale — the route stores it and every
          // alert email this subscription sends renders in ONLY this
          // language (see the alerts route's own header).
          lang: locale,
          website: honeypot,
          turnstileToken: turnstile.token ?? "",
          turnstileKey: turnstile.mode,
          clientToken: getCheckinClientToken() ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data?.ok) {
        setState("success");
      } else if (data?.error && RATE_LIMIT_ERRORS.has(data.error)) {
        setState("rateLimited");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
    // AFTER the state is set, never before — see AdoptBoxForm.tsx's submit().
    turnstile.reset();
  }

  const { queued, queue } = useQueuedTurnstileSubmit<string>(
    turnstile.token,
    (value) => void submit(value),
    () => setState("error"),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting" || queued) return;
    const value = email.trim();
    if (turnstile.token) {
      void submit(value);
    } else {
      setState("submitting");
      queue(value);
      // Ask for a fresh token now — see AdoptBoxForm.tsx's handleSubmit.
      turnstile.reset();
    }
  }

  const busy = state === "submitting" || queued;

  // Rendered in every branch, off-screen while closed or after success — see
  // CardFormTurnstile's header (#669).
  const turnstileNodes = (
    <CardFormTurnstile
      containerRef={turnstileContainerRef}
      onReady={turnstile.mount}
      visible={open && state !== "success"}
      testId="box-alert-turnstile-widget"
    />
  );

  if (!open) {
    return (
      <>
        <button
          type="button"
          // The guided tour points at this (#159); it never presses it.
          data-tour="box-alerts"
          onClick={() => setOpen(true)}
          className="relative before:absolute before:inset-x-0 before:-inset-y-0.5 inline-flex min-h-[44px] w-fit items-center text-left text-sm font-medium text-[var(--color-sage-600)] underline hover:text-[var(--color-sage-700)]"
        >
          {t("box.alerts.linkLabel", locale)}
        </button>
        {turnstileNodes}
      </>
    );
  }

  if (state === "success") {
    return (
      <>
        <p role="status" className="text-sm font-medium text-[var(--color-success)]">
          {t("box.alerts.success", locale)}
        </p>
        {turnstileNodes}
      </>
    );
  }

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] p-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)]">
        {t("box.alerts.linkLabel", locale)}
      </h3>

      <div>
        <label htmlFor="box-alert-email" className="block text-xs font-medium text-[var(--color-ink-700)]">
          {t("box.alerts.emailLabel", locale)}
        </label>
        <input
          id="box-alert-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={FIELD_LIMITS.EMAIL}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        />
        <p className="mt-1 text-xs text-[var(--color-ink-400)]">
          {t("box.alerts.emailDisclosure", locale)}{" "}
          <Link href="/privacy" className="underline hover:text-[var(--color-sage-600)] transition-colors">
            {t("privacy.linkLabel", locale)}
          </Link>
        </p>
      </div>

      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.form.error.generic", locale)}
        </p>
      )}
      {state === "rateLimited" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.form.error.rateLimit", locale)}
        </p>
      )}
      {turnstile.error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("form.turnstile.error", locale)}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          aria-disabled={busy}
          className={PRIMARY_BTN}
        >
          {busy ? t("box.alerts.submitting", locale) : t("box.alerts.submit", locale)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={SECONDARY_BTN}
        >
          {t("box.alerts.cancel", locale)}
        </button>
      </div>

      {/* Honeypot — visually hidden from real users, same convention as ReportForm.tsx */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="box-alert-website">Website</label>
        <input
          id="box-alert-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
    </form>
    {/* Outside the form, same tree position as the other two branches —
        CardFormTurnstile's header. */}
    {turnstileNodes}
    </>
  );
}
