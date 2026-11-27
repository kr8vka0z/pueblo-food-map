"use client";

/**
 * FeedbackForm — client component for the general feedback form.
 *
 * Fields: feedback type (required, FEEDBACK_TYPES), message (required) and
 * the visitor's email (required — so we can follow up). Turnstile, the
 * honeypot, validation focus, submit/success/error states and the shared
 * field markup live in PublicForm.tsx.
 *
 * Locale comes from PublicForm (its render prop and validate(locale)); this
 * file holds only the three fields and their rules.
 */

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { EMAIL_RE } from "@/lib/email";
import { FEEDBACK_TYPES, type FeedbackTypeKey } from "@/lib/feedbackTypes";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import PublicForm, { ERROR_CLASS, Field, LABEL_CLASS, PrivacyNote, type FieldErrors } from "@/components/PublicForm";

const { FEEDBACK_MESSAGE, EMAIL } = FIELD_LIMITS;

type FeedbackField = "feedbackType" | "message" | "contactEmail";

const FIELD_IDS: Record<FeedbackField, string> = {
  feedbackType: "feedback-type",
  message: "feedback-message",
  contactEmail: "feedback-email",
};

export default function FeedbackForm() {
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");

  function validate(locale: Locale): FieldErrors<FeedbackField> {
    const errors: FieldErrors<FeedbackField> = {};
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

  return (
    <PublicForm
      form="feedback"
      url="/feedback/submit"
      fieldIds={FIELD_IDS}
      rateLimitField="message"
      validate={validate}
      body={() => ({ feedbackType, message: message.trim(), contactEmail: contactEmail.trim() })}
    >
      {(errors, locale, onBlurField) => (
        <>
          {/* 4 short options shown directly as radios rather than hidden in a select (#959). */}
          <fieldset
            aria-describedby={errors.feedbackType ? "feedback-type-error" : undefined}
            aria-invalid={errors.feedbackType ? "true" : undefined}
          >
            <legend className={LABEL_CLASS.replace("mb-1", "mb-2")}>
              {t("feedback.type.label", locale)}{" "}
              <span aria-hidden className="text-[var(--color-danger)]">*</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(FEEDBACK_TYPES) as FeedbackTypeKey[]).map((key, index) => {
                const selected = feedbackType === key;
                return (
                  <label
                    key={key}
                    className={
                      "flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm cursor-pointer transition-colors duration-150 " +
                      (selected
                        ? "border-[var(--color-sage-600)] bg-[var(--color-sage-50)] font-semibold text-[var(--color-sage-700)]"
                        : "border-[var(--color-ink-400)] bg-white font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-sage-100)]")
                    }
                  >
                    <input
                      id={index === 0 ? "feedback-type" : undefined}
                      type="radio"
                      name="feedbackType"
                      value={key}
                      checked={selected}
                      onChange={() => {
                        setFeedbackType(key);
                        onBlurField("feedbackType", { clear: true });
                      }}
                      // size-[20px], not h-5/w-5: globals.css remaps --spacing-5 to 24px.
                      className="size-[20px] shrink-0 accent-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                    />
                    <span>{t(`feedback.type.${key}`, locale)}</span>
                  </label>
                );
              })}
            </div>
            {errors.feedbackType && (
              <p id="feedback-type-error" role="alert" tabIndex={-1} className={ERROR_CLASS}>
                <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
                <span>{errors.feedbackType}</span>
              </p>
            )}
          </fieldset>

          <Field
            id="feedback-message"
            label={t("feedback.message.label", locale)}
            required
            error={errors.message}
            controlClass="resize-y min-h-[96px]"
          >
            {(control) => (
              <textarea
                {...control}
                name="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onBlur={() => onBlurField("message")}
                placeholder={t("feedback.message.placeholder", locale)}
                maxLength={FEEDBACK_MESSAGE}
              />
            )}
          </Field>

          <Field
            id="feedback-email"
            label={t("feedback.email.label", locale)}
            required
            error={errors.contactEmail}
            after={<PrivacyNote locale={locale} />}
          >
            {(control) => (
              <input
                {...control}
                name="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                onBlur={() => onBlurField("contactEmail")}
                placeholder={t("feedback.email.placeholder", locale)}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                // Last field before submit — Enter implicitly submits, so "send".
                enterKeyHint="send"
                required
                maxLength={EMAIL}
              />
            )}
          </Field>
        </>
      )}
    </PublicForm>
  );
}
