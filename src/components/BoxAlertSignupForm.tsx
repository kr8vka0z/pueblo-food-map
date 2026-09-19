"use client";

/**
 * BoxAlertSignupForm — the "Email me when it needs filling" inline-expand
 * form on a blessing box's card (Blessing Boxes slice 6, Build Plan card
 * UX item 4). Posts to POST /api/public/blessing-boxes/[id]/alerts (that
 * route's own header has the full guard order and rate-limit scopes) —
 * one field, email only. Mirrors AdoptBoxForm.tsx's Turnstile/queued-submit
 * shape exactly (see that file's own header for the full reasoning); kept
 * as a separate component rather than a shared base because the two
 * payload shapes and success copy differ enough that a shared wrapper
 * would need as many branches as it saved lines.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import { useBoxTurnstileWidget } from "@/lib/useBoxTurnstileWidget";

const PENDING_SUBMIT_TIMEOUT_MS = 15_000;

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
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // The container ref stays LOCAL to this component (not returned by the
  // hook) — see useBoxTurnstileWidget.ts's own header for why (the React
  // Compiler ESLint rule flags a ref bundled into a hook's returned state
  // object).
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstile = useBoxTurnstileWidget(turnstileContainerRef);

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
      turnstile.reset();
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data?.ok) {
        setState("success");
      } else if (data?.error && RATE_LIMIT_ERRORS.has(data.error)) {
        setState("rateLimited");
      } else {
        setState("error");
      }
    } catch {
      turnstile.reset();
      setState("error");
    }
  }

  // Fires a queued submit the moment a token becomes available — see
  // AdoptBoxForm.tsx's own header for the full reasoning (identical here).
  useEffect(() => {
    if (!turnstile.token || !pendingEmail) return;
    const value = pendingEmail;
    // Both the state clear AND the submit() call (which itself calls
    // setState synchronously as its first line) are deferred to the same
    // microtask — see AdoptBoxForm.tsx's own header on this exact effect
    // for the full reasoning.
    queueMicrotask(() => {
      setPendingEmail(null);
      void submit(value);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit() closes over this render's turnstile.token/honeypot already; re-run per pendingEmail/token change, not per render.
  }, [turnstile.token, pendingEmail]);

  useEffect(() => {
    if (!pendingEmail) return;
    const timer = setTimeout(() => {
      setPendingEmail(null);
      setState("error");
    }, PENDING_SUBMIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pendingEmail]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting" || pendingEmail) return;
    const value = email.trim();
    if (turnstile.token) {
      void submit(value);
    } else {
      setState("submitting");
      setPendingEmail(value);
    }
  }

  const busy = state === "submitting" || pendingEmail !== null;

  // Unconditional Script + container — see AdoptBoxForm.tsx's own header
  // comment on this exact block for the full reasoning (the hook's
  // mount-on-first-render effect only ever runs once; the container must
  // already exist in the very first render, not only after `open` flips).
  const turnstileNodes = (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onReady={turnstile.mount}
      />
      <div ref={turnstileContainerRef} data-testid="box-alert-turnstile-widget" />
    </>
  );

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-[44px] text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline w-fit text-left"
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
          className="min-h-[44px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] text-sm font-semibold hover:bg-[var(--color-sage-600)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        >
          {busy ? t("box.alerts.submitting", locale) : t("box.alerts.submit", locale)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]"
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

      {turnstileNodes}
    </form>
  );
}
