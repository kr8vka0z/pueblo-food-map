"use client";

/**
 * ReportForm — client component for the venue issue report form.
 *
 * Features:
 *   - Issue type select (required)
 *   - Description textarea (required, ≥10 chars)
 *   - Optional contact email
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
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

// Expose limits to the module scope for use in JSX maxlength attrs.
const { REPORT_DESCRIPTION, EMAIL } = FIELD_LIMITS;

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
  issueType?: string;
  description?: string;
  contactEmail?: string;
}

function validate(
  issueType: string,
  description: string,
  contactEmail: string,
  locale: Locale,
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!issueType) {
    errors.issueType = t("report.validation.issueTypeRequired", locale);
  }
  if (description.trim().length < 10) {
    errors.description = t("report.validation.descriptionRequired", locale);
  }
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    errors.contactEmail = t("report.validation.emailInvalid", locale);
  }
  return errors;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportFormProps {
  venueId: string;
  venueName: string;
  venueAddress: string;
  locale?: Locale;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportForm({
  venueId,
  // venueName and venueAddress are passed by the page (it reads them from the
  // static venue list) but the form no longer sends them to the server.
  // The server now re-looks them up from venueId (#160 1.3).
  locale = "en",
}: ReportFormProps) {
  const [issueType, setIssueType] = useState<string>("");
  const [description, setDescription] = useState<string>("");
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
  }, []);

  // ── Submission ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate(issueType, description, contactEmail, locale);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Move focus to first error for screen-reader users
      const firstErrorId = validationErrors.issueType
        ? "report-issue-type-error"
        : validationErrors.description
        ? "report-description-error"
        : "report-email-error";
      document.getElementById(firstErrorId)?.focus();
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/report/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          // venueName and venueAddress intentionally omitted: the server looks
          // them up from venueId to prevent client-side subject-line injection.
          issueType,
          description: description.trim(),
          contactEmail: contactEmail.trim() || undefined,
          website: honeypot, // honeypot field
          turnstileToken: turnstileToken ?? "",
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        setStatus("success");
      } else if (data.error === "rate_limit") {
        setErrors({ description: t("report.error.rateLimit", locale) });
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
          {t("report.success.title", locale)}
        </h2>
        <p className="text-sm text-[var(--color-ink-600)] mb-6 leading-relaxed">
          {t("report.success.body", locale)}
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
          {t("report.backToMap", locale)}
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
          <p className="text-sm font-medium text-red-700">{t("report.error.title", locale)}</p>
          <p className="text-sm text-red-600 mt-0.5">{t("report.error.body", locale)}</p>
        </div>
      )}

      {/* Issue type */}
      <div>
        <label htmlFor="report-issue-type" className={labelClass}>
          {t("report.issueType.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <select
          id="report-issue-type"
          value={issueType}
          onChange={(e) => setIssueType(e.target.value)}
          aria-required="true"
          aria-describedby={errors.issueType ? "report-issue-type-error" : undefined}
          aria-invalid={errors.issueType ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.issueType)}`}
        >
          <option value="">{t("report.issueType.placeholder", locale)}</option>
          {(Object.keys(ISSUE_TYPES) as IssueTypeKey[]).map((key) => (
            <option key={key} value={key}>
              {t(`report.issueType.${key}`, locale)}
            </option>
          ))}
        </select>
        {errors.issueType && (
          <p
            id="report-issue-type-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.issueType}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="report-description" className={labelClass}>
          {t("report.description.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <textarea
          id="report-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("report.description.placeholder", locale)}
          maxLength={REPORT_DESCRIPTION}
          aria-required="true"
          aria-describedby={errors.description ? "report-description-error" : undefined}
          aria-invalid={errors.description ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.description)} resize-y min-h-[96px]`}
        />
        {errors.description && (
          <p
            id="report-description-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.description}
          </p>
        )}
      </div>

      {/* Optional contact email */}
      <div>
        <label htmlFor="report-email" className={labelClass}>
          {t("report.email.label", locale)}
        </label>
        <input
          type="email"
          id="report-email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={t("report.email.placeholder", locale)}
          autoComplete="email"
          maxLength={EMAIL}
          aria-describedby={
            errors.contactEmail
              ? "report-email-error"
              : "report-email-hint"
          }
          aria-invalid={errors.contactEmail ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.contactEmail)}`}
        />
        {errors.contactEmail ? (
          <p
            id="report-email-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.contactEmail}
          </p>
        ) : (
          <p id="report-email-hint" className="mt-1 text-xs text-[var(--color-ink-400)]">
            {t("report.email.hint", locale)}
          </p>
        )}
        {/* Privacy disclosure (#160 1.7): brief reassurance for a vulnerable population */}
        <p className="mt-1 text-xs text-[var(--color-ink-400)]">
          {t("privacy.emailDisclosure", locale)}{" "}
          <Link
            href="/privacy"
            className="underline hover:text-[var(--color-sage-600)] transition-colors"
          >
            {t("privacy.linkLabel", locale)}
          </Link>
        </p>
      </div>

      {/* Honeypot — visually hidden from real users */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="report-website">Website</label>
        <input
          id="report-website"
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
            {t("form.turnstile.error", locale)}
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
          ? t("report.submitting", locale)
          : !turnstileToken
          ? t("form.turnstile.verifying", locale)
          : t("report.submit", locale)}
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
          {t("report.error.retry", locale)}
        </button>
      )}
    </form>
    </>
  );
}
