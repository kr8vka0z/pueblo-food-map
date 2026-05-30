"use client";

/**
 * FeedbackForm — client component for the general feedback form.
 *
 * Features:
 *   - Feedback type select (required, 4 types from FEEDBACK_TYPES)
 *   - Message textarea (required)
 *   - Your email input (required — so we can follow up)
 *   - Honeypot field (hidden from real users, caught server-side)
 *   - Cloudflare Turnstile widget (bot protection)
 *   - Client-side validation with accessible error announcements
 *   - Success state with "Back to map" link
 *   - Error state with "Try again" preserving form data
 *   - Mobile-friendly: no horizontal scroll at 375px
 *   - Keyboard accessible: all controls labeled, errors linked via aria-describedby
 */

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { FEEDBACK_TYPES, type FeedbackTypeKey } from "@/lib/feedbackTypes";

// ─── Turnstile global type ────────────────────────────────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidationErrors {
  feedbackType?: string;
  message?: string;
  contactEmail?: string;
}

function validate(
  feedbackType: string,
  message: string,
  contactEmail: string,
  locale: Locale,
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!feedbackType) {
    errors.feedbackType = t("feedback.validation.typeRequired", locale);
  }
  if (!message.trim()) {
    errors.message = t("feedback.validation.messageRequired", locale);
  }
  if (!contactEmail.trim()) {
    errors.contactEmail = t("feedback.validation.emailRequired", locale);
  } else if (!EMAIL_RE.test(contactEmail)) {
    errors.contactEmail = t("feedback.validation.emailInvalid", locale);
  }
  return errors;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FeedbackFormProps {
  locale?: Locale;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedbackForm({ locale = "en" }: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<boolean>(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  // ── Turnstile widget render ────────────────────────────────────────────────
  // Called once the CF Turnstile script has loaded. Re-runs if the container
  // mounts after script load (e.g. error state reset).

  function mountTurnstile() {
    if (!turnstileContainerRef.current || !window.turnstile) return;
    if (turnstileWidgetId.current) return; // already mounted

    const sitekey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

    turnstileWidgetId.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey,
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
          setTurnstileError(false);
        },
      },
    );
  }

  // When the form returns from success/error states the widget container
  // re-mounts. Try to render if the script already loaded.
  useEffect(() => {
    if (window.turnstile) {
      mountTurnstile();
    }
    return () => {
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submission ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate(feedbackType, message, contactEmail, locale);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Move focus to first error for screen-reader users
      const firstErrorId = validationErrors.feedbackType
        ? "feedback-type-error"
        : validationErrors.message
        ? "feedback-message-error"
        : "feedback-email-error";
      document.getElementById(firstErrorId)?.focus();
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType,
          message: message.trim(),
          contactEmail: contactEmail.trim(),
          website: honeypot, // honeypot field
          turnstileToken: turnstileToken ?? "",
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        setStatus("success");
      } else if (data.error === "rate_limit") {
        setErrors({ message: t("feedback.error.rateLimit", locale) });
        setStatus("idle");
      } else if (data.error === "turnstile_failed") {
        setTurnstileError(true);
        setTurnstileToken(null);
        // Reset widget so user can retry
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
        }
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (status === "success") {
    return (
      <div role="status" aria-live="polite" className="text-center py-8">
        <h2
          className="text-xl font-semibold text-[var(--color-ink-900)] mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("feedback.success.title", locale)}
        </h2>
        <p className="text-sm text-[var(--color-ink-600)] mb-6 leading-relaxed">
          {t("feedback.success.body", locale)}
        </p>
        <Link
          href="/"
          className={
            "inline-flex items-center justify-center px-5 h-10 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
            "text-sm font-semibold transition-colors duration-150 " +
            "hover:bg-[var(--color-sage-600)] focus-visible:outline-none " +
            "focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          {t("feedback.backToMap", locale)}
        </Link>
      </div>
    );
  }

  // ── Form (idle | submitting | error) ─────────────────────────────────────

  const inputBase =
    "w-full rounded-[var(--radius-md)] border px-3 py-2 text-sm text-[var(--color-ink-900)] " +
    "bg-white placeholder:text-[var(--color-ink-300)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
    "focus-visible:border-[var(--color-sage-500)]";

  const inputBorder = (hasError: boolean) =>
    hasError ? "border-red-500" : "border-[var(--color-bone-300)]";

  const errorClass = "mt-1 text-xs text-red-600";
  const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";

  return (
    <>
      {/* Cloudflare Turnstile JS — loads after page is interactive */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={mountTurnstile}
      />
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Global error state banner */}
      {status === "error" && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-medium text-red-700">{t("feedback.error.title", locale)}</p>
          <p className="text-sm text-red-600 mt-0.5">{t("feedback.error.body", locale)}</p>
        </div>
      )}

      {/* Feedback type (required) */}
      <div>
        <label htmlFor="feedback-type" className={labelClass}>
          {t("feedback.type.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <select
          id="feedback-type"
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
          aria-required="true"
          aria-describedby={errors.feedbackType ? "feedback-type-error" : undefined}
          aria-invalid={errors.feedbackType ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.feedbackType)}`}
        >
          <option value="">{t("feedback.type.placeholder", locale)}</option>
          {(Object.keys(FEEDBACK_TYPES) as FeedbackTypeKey[]).map((key) => (
            <option key={key} value={key}>
              {t(`feedback.type.${key}`, locale)}
            </option>
          ))}
        </select>
        {errors.feedbackType && (
          <p
            id="feedback-type-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.feedbackType}
          </p>
        )}
      </div>

      {/* Message (required) */}
      <div>
        <label htmlFor="feedback-message" className={labelClass}>
          {t("feedback.message.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <textarea
          id="feedback-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("feedback.message.placeholder", locale)}
          aria-required="true"
          aria-describedby={errors.message ? "feedback-message-error" : undefined}
          aria-invalid={errors.message ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.message)} resize-y min-h-[96px]`}
        />
        {errors.message && (
          <p
            id="feedback-message-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.message}
          </p>
        )}
      </div>

      {/* Contact email (required) */}
      <div>
        <label htmlFor="feedback-email" className={labelClass}>
          {t("feedback.email.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="feedback-email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={t("feedback.email.placeholder", locale)}
          autoComplete="email"
          required
          aria-required="true"
          aria-describedby={
            errors.contactEmail
              ? "feedback-email-error"
              : "feedback-email-hint"
          }
          aria-invalid={errors.contactEmail ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.contactEmail)}`}
        />
        {errors.contactEmail ? (
          <p
            id="feedback-email-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.contactEmail}
          </p>
        ) : (
          <p id="feedback-email-hint" className="mt-1 text-xs text-[var(--color-ink-400)]">
            {t("feedback.email.hint", locale)}
          </p>
        )}
      </div>

      {/* Honeypot — visually hidden from real users */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="feedback-website">Website</label>
        <input
          id="feedback-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Cloudflare Turnstile widget */}
      <div>
        <div
          ref={turnstileContainerRef}
          data-testid="turnstile-widget"
        />
        {turnstileError && (
          <p
            role="alert"
            className="mt-1 text-xs text-red-600"
          >
            {"Couldn't verify you're human — please retry."}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "submitting" || !turnstileToken}
        className={
          "w-full h-11 rounded-[var(--radius-md)] " +
          "bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
          "text-base font-semibold transition-colors duration-150 " +
          "hover:bg-[var(--color-sage-600)] " +
          "focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
          "disabled:opacity-60 disabled:cursor-not-allowed"
        }
        aria-disabled={status === "submitting" || !turnstileToken}
      >
        {status === "submitting"
          ? t("feedback.submitting", locale)
          : !turnstileToken
          ? "Verifying…"
          : t("feedback.submit", locale)}
      </button>

      {/* Retry button in error state */}
      {status === "error" && (
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className={
            "w-full h-11 rounded-[var(--radius-md)] " +
            "border border-[var(--color-ink-300)] text-[var(--color-ink-700)] " +
            "text-base font-medium transition-colors duration-150 " +
            "hover:bg-[var(--color-bone-100)] " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          {t("feedback.error.retry", locale)}
        </button>
      )}
    </form>
    </>
  );
}
