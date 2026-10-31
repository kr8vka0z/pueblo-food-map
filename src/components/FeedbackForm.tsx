"use client";

/**
 * FeedbackForm — client component for the general feedback form.
 *
 * Fields: feedback type (required, FEEDBACK_TYPES), message (required) and
 * the visitor's email (required — so we can follow up). Turnstile, the
 * honeypot, validation focus, submit/success/error states and the shared
 * field markup live in PublicForm.tsx.
 *
 * Reads locale from useLocale() (#289) instead of a prop passed down from
 * /feedback's page.tsx — matches the rest of the codebase's client-side
 * locale pattern (SiteFooter, ListView, HamburgerMenu).
 */

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { EMAIL_RE } from "@/lib/email";
import { FEEDBACK_TYPES, type FeedbackTypeKey } from "@/lib/feedbackTypes";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import PublicForm, { Field, PrivacyNote, type FieldErrors } from "@/components/PublicForm";

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
      {(errors, locale) => (
        <>
          <Field id="feedback-type" label={t("feedback.type.label", locale)} required error={errors.feedbackType}>
            {(control) => (
              <select {...control} value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
                <option value="">{t("feedback.type.placeholder", locale)}</option>
                {(Object.keys(FEEDBACK_TYPES) as FeedbackTypeKey[]).map((key) => (
                  <option key={key} value={key}>
                    {t(`feedback.type.${key}`, locale)}
                  </option>
                ))}
              </select>
            )}
          </Field>

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
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
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
            hint={t("feedback.email.hint", locale)}
            after={<PrivacyNote locale={locale} />}
          >
            {(control) => (
              <input
                {...control}
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t("feedback.email.placeholder", locale)}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
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
