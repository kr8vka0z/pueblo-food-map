"use client";

/**
 * SuggestForm — client component for the suggest-a-venue form.
 *
 * Features:
 *   - Venue name (required)
 *   - Address (required)
 *   - Category select (required, VenueCategory enum)
 *   - Hours textarea (optional)
 *   - Contact info input (optional — phone / email / URL)
 *   - SNAP / WIC checkboxes (optional)
 *   - Notes textarea (optional)
 *   - Submitter email (required — #232)
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
import { VENUE_CATEGORIES, type VenueCategoryKey } from "@/lib/suggestTypes";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

const {
  SUGGEST_VENUE_NAME,
  SUGGEST_ADDRESS,
  SUGGEST_HOURS,
  SUGGEST_CONTACT,
  SUGGEST_NOTES,
  EMAIL,
} = FIELD_LIMITS;

// ─── Validation ───────────────────────────────────────────────────────────────
// Turnstile Window type lives in src/types/turnstile.d.ts (deduplicated in #166 8.6).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidationErrors {
  venueName?: string;
  address?: string;
  category?: string;
  submitterEmail?: string;
}

function validate(
  venueName: string,
  address: string,
  category: string,
  submitterEmail: string,
  locale: Locale,
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!venueName.trim()) {
    errors.venueName = t("suggest.validation.nameRequired", locale);
  }
  if (!address.trim()) {
    errors.address = t("suggest.validation.addressRequired", locale);
  }
  if (!category) {
    errors.category = t("suggest.validation.categoryRequired", locale);
  }
  if (!submitterEmail.trim()) {
    errors.submitterEmail = t("suggest.validation.emailRequired", locale);
  } else if (!EMAIL_RE.test(submitterEmail)) {
    errors.submitterEmail = t("suggest.validation.emailInvalid", locale);
  }
  return errors;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SuggestFormProps {
  locale?: Locale;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuggestForm({ locale = "en" }: SuggestFormProps) {
  const [venueName, setVenueName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [acceptsSnap, setAcceptsSnap] = useState<boolean>(false);
  const [acceptsWic, setAcceptsWic] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [submitterEmail, setSubmitterEmail] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<boolean>(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  // ── Turnstile widget render ────────────────────────────────────────────────

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

    const validationErrors = validate(venueName, address, category, submitterEmail, locale);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Move focus to first error for screen-reader users
      const firstErrorId = validationErrors.venueName
        ? "suggest-name-error"
        : validationErrors.address
        ? "suggest-address-error"
        : validationErrors.category
        ? "suggest-category-error"
        : "suggest-email-error";
      document.getElementById(firstErrorId)?.focus();
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const res = await fetch("/suggest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueName: venueName.trim(),
          address: address.trim(),
          category,
          hours: hours.trim() || undefined,
          contact: contact.trim() || undefined,
          acceptsSnap,
          acceptsWic,
          notes: notes.trim() || undefined,
          submitterEmail: submitterEmail.trim(),
          website: honeypot, // honeypot field
          turnstileToken: turnstileToken ?? "",
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        setStatus("success");
      } else if (data.error === "rate_limit") {
        setErrors({ venueName: t("suggest.error.rateLimit", locale) });
        setStatus("idle");
      } else if (data.error === "turnstile_failed") {
        setTurnstileError(true);
        setTurnstileToken(null);
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
          {t("suggest.success.title", locale)}
        </h2>
        <p className="text-sm text-[var(--color-ink-600)] mb-6 leading-relaxed">
          {t("suggest.success.body", locale)}
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
          {t("suggest.backToMap", locale)}
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
          <p className="text-sm font-medium text-red-700">{t("suggest.error.title", locale)}</p>
          <p className="text-sm text-red-600 mt-0.5">{t("suggest.error.body", locale)}</p>
        </div>
      )}

      {/* Venue name (required) */}
      <div>
        <label htmlFor="suggest-name" className={labelClass}>
          {t("suggest.venueName.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="suggest-name"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder={t("suggest.venueName.placeholder", locale)}
          maxLength={SUGGEST_VENUE_NAME}
          aria-required="true"
          aria-describedby={errors.venueName ? "suggest-name-error" : undefined}
          aria-invalid={errors.venueName ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.venueName)}`}
        />
        {errors.venueName && (
          <p
            id="suggest-name-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.venueName}
          </p>
        )}
      </div>

      {/* Address (required) */}
      <div>
        <label htmlFor="suggest-address" className={labelClass}>
          {t("suggest.address.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="suggest-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("suggest.address.placeholder", locale)}
          maxLength={SUGGEST_ADDRESS}
          aria-required="true"
          aria-describedby={errors.address ? "suggest-address-error" : undefined}
          aria-invalid={errors.address ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.address)}`}
        />
        {errors.address && (
          <p
            id="suggest-address-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.address}
          </p>
        )}
      </div>

      {/* Category (required) */}
      <div>
        <label htmlFor="suggest-category" className={labelClass}>
          {t("suggest.category.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <select
          id="suggest-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-required="true"
          aria-describedby={errors.category ? "suggest-category-error" : undefined}
          aria-invalid={errors.category ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.category)}`}
        >
          <option value="">{t("suggest.category.placeholder", locale)}</option>
          {(Object.keys(VENUE_CATEGORIES) as VenueCategoryKey[]).map((key) => (
            <option key={key} value={key}>
              {t(`suggest.category.${key}`, locale)}
            </option>
          ))}
        </select>
        {errors.category && (
          <p
            id="suggest-category-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.category}
          </p>
        )}
      </div>

      {/* Hours (optional) */}
      <div>
        <label htmlFor="suggest-hours" className={labelClass}>
          {t("suggest.hours.label", locale)}
        </label>
        <input
          type="text"
          id="suggest-hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder={t("suggest.hours.placeholder", locale)}
          maxLength={SUGGEST_HOURS}
          className={`${inputBase} border-[var(--color-bone-300)]`}
        />
      </div>

      {/* Contact info (optional) */}
      <div>
        <label htmlFor="suggest-contact" className={labelClass}>
          {t("suggest.contact.label", locale)}
        </label>
        <input
          type="text"
          id="suggest-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t("suggest.contact.placeholder", locale)}
          maxLength={SUGGEST_CONTACT}
          className={`${inputBase} border-[var(--color-bone-300)]`}
        />
      </div>

      {/* SNAP / WIC checkboxes */}
      {/* legend is required for WCAG 1.3.1 (fieldset must have accessible name) */}
      <fieldset className="space-y-2">
        <legend className={labelClass.replace("mb-1", "mb-2")}>
          {t("suggest.benefits.legend", locale)}
        </legend>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] cursor-pointer">
          <input
            type="checkbox"
            id="suggest-snap"
            checked={acceptsSnap}
            onChange={(e) => setAcceptsSnap(e.target.checked)}
            className={
              "w-4 h-4 rounded border-[var(--color-bone-300)] " +
              "text-[var(--color-sage-500)] " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)]"
            }
          />
          {t("suggest.snap.label", locale)}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] cursor-pointer">
          <input
            type="checkbox"
            id="suggest-wic"
            checked={acceptsWic}
            onChange={(e) => setAcceptsWic(e.target.checked)}
            className={
              "w-4 h-4 rounded border-[var(--color-bone-300)] " +
              "text-[var(--color-sage-500)] " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)]"
            }
          />
          {t("suggest.wic.label", locale)}
        </label>
      </fieldset>

      {/* Notes (optional) */}
      <div>
        <label htmlFor="suggest-notes" className={labelClass}>
          {t("suggest.notes.label", locale)}
        </label>
        <textarea
          id="suggest-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("suggest.notes.placeholder", locale)}
          maxLength={SUGGEST_NOTES}
          className={`${inputBase} border-[var(--color-bone-300)] resize-y min-h-[72px]`}
        />
      </div>

      {/* Submitter email (required — #232) */}
      <div>
        <label htmlFor="suggest-email" className={labelClass}>
          {t("suggest.submitterEmail.label", locale)}{" "}
          <span aria-hidden className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="suggest-email"
          value={submitterEmail}
          onChange={(e) => setSubmitterEmail(e.target.value)}
          placeholder={t("suggest.submitterEmail.placeholder", locale)}
          autoComplete="email"
          required
          maxLength={EMAIL}
          aria-required="true"
          aria-describedby={
            errors.submitterEmail
              ? "suggest-email-error"
              : "suggest-email-hint"
          }
          aria-invalid={errors.submitterEmail ? "true" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.submitterEmail)}`}
        />
        {errors.submitterEmail ? (
          <p
            id="suggest-email-error"
            role="alert"
            tabIndex={-1}
            className={errorClass}
          >
            {errors.submitterEmail}
          </p>
        ) : (
          <p id="suggest-email-hint" className="mt-1 text-xs text-[var(--color-ink-400)]">
            {t("suggest.submitterEmail.hint", locale)}
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
        <label htmlFor="suggest-website">Website</label>
        <input
          id="suggest-website"
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
          ? t("suggest.submitting", locale)
          : !turnstileToken
          ? t("form.turnstile.verifying", locale)
          : t("suggest.submit", locale)}
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
          {t("suggest.error.retry", locale)}
        </button>
      )}
    </form>
    </>
  );
}
