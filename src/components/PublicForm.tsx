"use client";

/**
 * PublicForm + Field — the shared shell of the public page forms
 * (FeedbackForm, ReportForm, SuggestForm, ShareEventForm). Each form owns only
 * its own field state, its validate(), and the JSON it sends; everything they
 * had copied lives here once:
 *
 * - the Turnstile widget (useTurnstile, managed key) and its <Script>
 * - the honeypot `website` field (hidden from people, caught server-side)
 * - the submit state machine: client validation (focus the first error for
 *   screen-reader users) → POST → success / `rate_limit` (inline, on the
 *   form's chosen field) / `turnstile_failed` (inline, widget reset) /
 *   anything else (error banner + "Try again", form data kept)
 * - the success panel with its "Back to map" link
 *
 * Copy comes from i18n keys under the form's own prefix (`feedback.*`,
 * `report.*`, `suggest.*`, `shareEvent.*`), so each keeps its own wording.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Script from "next/script";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { localizedHref } from "@/lib/localizedHref";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useQueuedTurnstileSubmit, useTurnstile } from "@/lib/useTurnstile";
import SuccessTick from "@/components/SuccessTick";

type FormName = "feedback" | "report" | "suggest" | "shareEvent";
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
// min-h-12 + border ink-400 (5.9:1 on white) align public forms with admin (#959).
const INPUT_BASE =
  "w-full min-h-12 rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
  "bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";
export const ERROR_CLASS = "mt-1 flex items-start gap-1.5 text-xs text-[var(--color-danger)]";
export const LABEL_CLASS = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";

interface FieldControlProps {
  id: string;
  "aria-required"?: "true";
  "aria-describedby"?: string;
  "aria-invalid"?: "true";
  className: string;
}

/**
 * One labelled control: label (with a red * when required), the control,
 * then its error (role="alert", focusable) or else its hint. The control
 * itself is a render prop that receives the id, aria wiring and classes, so
 * each form still writes its own <input>/<select>/<textarea> attributes.
 */
export function Field({
  id,
  label,
  required = false,
  error,
  hint,
  controlClass = "",
  children,
  after,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Extra classes after the input base + border, e.g. textarea sizing. */
  controlClass?: string;
  children: (control: FieldControlProps) => ReactNode;
  /** Rendered after the error/hint line (the privacy note under email fields). */
  after?: ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const border = error ? "border-[var(--color-danger)]" : "border-[var(--color-ink-400)]";
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {required && (
          <>
            {" "}
            <span aria-hidden className="text-[var(--color-danger)]">*</span>
          </>
        )}
      </label>
      {children({
        id,
        "aria-required": required ? "true" : undefined,
        "aria-describedby": error ? errorId : hint ? hintId : undefined,
        "aria-invalid": error ? "true" : undefined,
        className: `${INPUT_BASE} ${border}${controlClass ? ` ${controlClass}` : ""}`,
      })}
      {error ? (
        <p id={errorId} role="alert" tabIndex={-1} className={ERROR_CLASS}>
          <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1 text-xs text-[var(--color-ink-400)]">
            {hint}
          </p>
        )
      )}
      {after}
    </div>
  );
}

/** The privacy reassurance under every email field (#160 1.7: a vulnerable population). */
export function PrivacyNote({ locale }: { locale: Locale }) {
  return (
    <p className="mt-1 text-xs text-[var(--color-ink-400)]">
      {t("privacy.emailDisclosure", locale)}{" "}
      <Link href="/privacy" className="underline hover:text-[var(--color-sage-600)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded">
        {t("privacy.linkLabel", locale)}
      </Link>
    </p>
  );
}

export default function PublicForm<K extends string>({
  form,
  url,
  fieldIds,
  rateLimitField,
  validate,
  body,
  children,
  onSuccess,
  submitRow = (submit) => submit,
  beforeSubmit,
  onFailure,
}: {
  form: FormName;
  /** POST target, e.g. "/feedback/submit". */
  url: string;
  /** Field key → control id, in focus order (the first with an error gets focus). */
  fieldIds: Record<K, string>;
  /** Where the server's `rate_limit` message shows. */
  rateLimitField: NoInfer<K>;
  validate: (locale: Locale) => FieldErrors<NoInfer<K>>;
  /** The form's own JSON fields; `website` and `turnstileToken` are appended. */
  body: () => Record<string, unknown>;
  children: (errors: FieldErrors<NoInfer<K>>, locale: Locale, onBlurField: (field: NoInfer<K>) => void) => ReactNode;
  onSuccess?: () => void;
  /** Wraps the submit button (default: the button alone). */
  submitRow?: (submit: ReactNode) => ReactNode;
  /** Runs after client validation passes, before the POST; false = don't send. body() runs after it, so it can read a ref the hook set. */
  beforeSubmit?: () => Promise<boolean>;
  /** Told the server's error code before the generic error banner shows. */
  onFailure?: (error: string | undefined) => void;
}) {
  const { locale, tree } = useLocale();
  const [honeypot, setHoneypot] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileContainerRef, { rebuildDeadWidget: false });
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  // Synchronous guard against rapid double-submit clicks before React re-renders (#959).
  const submittingRef = useRef(false);

  function onBlurField(field: K) {
    const next = validate(locale);
    setErrors((prev) => {
      if (prev[field] === next[field]) return prev;
      return { ...prev, [field]: next[field] };
    });
  }

  async function runSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStatus("submitting");

    try {
      if (beforeSubmit && !(await beforeSubmit())) {
        setStatus("idle");
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body(),
          website: honeypot, // honeypot field
          turnstileToken: turnstile.token ?? "",
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (data.ok) {
        setStatus("success");
        onSuccess?.();
      } else if (data.error === "rate_limit") {
        setErrors({ [rateLimitField]: t(`${form}.error.rateLimit`, locale) } as FieldErrors<K>);
        setStatus("idle");
      } else if (data.error === "turnstile_failed") {
        turnstile.fail(); // shows the inline message, resets the widget so the visitor can retry
        setStatus("idle");
      } else {
        onFailure?.(data.error);
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  }

  const { queued, queue } = useQueuedTurnstileSubmit<boolean>(
    turnstile.token,
    () => void runSubmit(),
    () => {
      submittingRef.current = false;
      turnstile.fail();
      setStatus("idle");
    },
  );

  // If Turnstile reports an error while a submit is queued, unblock the form.
  useEffect(() => {
    if (!turnstile.error || !queued) return;
    queueMicrotask(() => {
      submittingRef.current = false;
      setStatus("idle");
    });
  }, [turnstile.error, queued]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || status === "submitting" || queued) return;

    const validationErrors = validate(locale);
    const firstError = (Object.keys(fieldIds) as K[]).find((k) => validationErrors[k]);
    if (firstError) {
      setErrors(validationErrors);
      // Move focus to first error for screen-reader users
      document.getElementById(`${fieldIds[firstError]}-error`)?.focus();
      return;
    }

    setErrors({});
    if (turnstile.token) {
      void runSubmit();
    } else {
      setStatus("submitting");
      queue(true);
      turnstile.reset();
    }
  }

  if (status === "success") {
    return (
      <div role="status" aria-live="polite" className="text-center py-8">
        <SuccessTick size={48} className="mx-auto mb-3" />
        <h2
          className="text-xl font-semibold text-[var(--color-ink-900)] mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t(`${form}.success.title`, locale)}
        </h2>
        {/* #534: --color-ink-600 undefined in globals.css @theme — mapped to
            ink-700, DESIGN.md's documented body-text token. */}
        <p className="text-sm text-[var(--color-ink-700)] mb-6 leading-relaxed">{t(`${form}.success.body`, locale)}</p>
        {/* The tree, not the locale: /es pages go back to /es (#894); an EN page read in Spanish stays on "/". */}
        <Link
          href={localizedHref("/", tree)}
          className={
            "inline-flex items-center justify-center px-5 h-12 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-600)] text-[var(--color-bone-50)] " +
            "text-sm font-semibold transition-colors duration-150 " +
            "hover:bg-[var(--color-sage-700)] " +
            PRESS_FEEDBACK + " " +
            "focus-visible:outline-none " +
            "focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          {t(`${form}.backToMap`, locale)}
        </Link>
      </div>
    );
  }

  const waiting = status === "submitting" || queued;

  return (
    <>
      {/* Cloudflare Turnstile JS — loads after page is interactive */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={turnstile.mount}
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {status === "error" && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-white px-4 py-3">
            <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-danger)]">{t(`${form}.error.title`, locale)}</p>
              <p className="text-sm text-[var(--color-danger)] mt-0.5">{t(`${form}.error.body`, locale)}</p>
            </div>
          </div>
        )}

        {children(errors, locale, onBlurField)}

        {/* Honeypot — visually hidden from real users */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor={`${form}-website`}>Website</label>
          <input
            id={`${form}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div>
          <div ref={turnstileContainerRef} data-testid="turnstile-widget" />
          {turnstile.error && (
            <p role="alert" className={ERROR_CLASS}>
              <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>{t("form.turnstile.error", locale)}</span>
            </p>
          )}
        </div>

        {submitRow(
        <button
          type="submit"
          disabled={waiting}
          className={
            "w-full h-12 rounded-[var(--radius-md)] " +
            "bg-[var(--color-sage-600)] text-[var(--color-bone-50)] " +
            "text-base font-semibold transition-colors duration-150 " +
            "hover:bg-[var(--color-sage-700)] " +
            PRESS_FEEDBACK + " " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
            "disabled:opacity-60 disabled:cursor-not-allowed"
          }
          aria-disabled={waiting}
        >
          {waiting ? t(`${form}.submitting`, locale) : t(`${form}.submit`, locale)}
        </button>,
        )}

        {status === "error" && (
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className={
              "w-full h-12 rounded-[var(--radius-md)] " +
              // #534: --color-ink-300 undefined — bone-300 is the app's
              // documented resting-border token (DESIGN.md: "bone-300 —
              // search bar border at rest").
              "border border-[var(--color-bone-300)] text-[var(--color-ink-700)] " +
              "text-base font-medium transition-colors duration-150 " +
              "hover:bg-[var(--color-sage-100)] " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
            }
          >
            {t(`${form}.error.retry`, locale)}
          </button>
        )}
      </form>
    </>
  );
}
