"use client";

/**
 * ReportForm — client component for the venue issue report form.
 *
 * Fields: issue type (required), description (required, ≥10 chars) and an
 * optional contact email. Turnstile, the honeypot, validation focus,
 * submit/success/error states and the shared field markup live in
 * PublicForm.tsx.
 *
 * Reads locale from useLocale() (#289) instead of a prop passed down from
 * /report/[venueId]'s page.tsx — matches the rest of the codebase's
 * client-side locale pattern (SiteFooter, ListView, HamburgerMenu).
 */

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { EMAIL_RE } from "@/lib/email";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import PublicForm, { Field, PrivacyNote, type FieldErrors } from "@/components/PublicForm";

const { REPORT_DESCRIPTION, EMAIL } = FIELD_LIMITS;

type ReportField = "issueType" | "description" | "contactEmail";

const FIELD_IDS: Record<ReportField, string> = {
  issueType: "report-issue-type",
  description: "report-description",
  contactEmail: "report-email",
};

interface ReportFormProps {
  venueId: string;
  venueName: string;
  venueAddress: string;
}

export default function ReportForm({
  venueId,
  // venueName and venueAddress are passed by the page (it reads them from the
  // static venue list) but the form no longer sends them to the server.
  // The server now re-looks them up from venueId (#160 1.3).
}: ReportFormProps) {
  const [issueType, setIssueType] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");

  function validate(locale: Locale): FieldErrors<ReportField> {
    const errors: FieldErrors<ReportField> = {};
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

  return (
    <PublicForm
      form="report"
      url="/report/submit"
      fieldIds={FIELD_IDS}
      rateLimitField="description"
      validate={validate}
      // venueName and venueAddress intentionally omitted: the server looks
      // them up from venueId to prevent client-side subject-line injection.
      body={() => ({
        venueId,
        issueType,
        description: description.trim(),
        contactEmail: contactEmail.trim() || undefined,
      })}
    >
      {(errors, locale) => (
        <>
          <Field id="report-issue-type" label={t("report.issueType.label", locale)} required error={errors.issueType}>
            {(control) => (
              <select {...control} value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                <option value="">{t("report.issueType.placeholder", locale)}</option>
                {(Object.keys(ISSUE_TYPES) as IssueTypeKey[]).map((key) => (
                  <option key={key} value={key}>
                    {t(`report.issueType.${key}`, locale)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="report-description"
            label={t("report.description.label", locale)}
            required
            error={errors.description}
            controlClass="resize-y min-h-[96px]"
          >
            {(control) => (
              <textarea
                {...control}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("report.description.placeholder", locale)}
                maxLength={REPORT_DESCRIPTION}
              />
            )}
          </Field>

          <Field
            id="report-email"
            label={t("report.email.label", locale)}
            error={errors.contactEmail}
            hint={t("report.email.hint", locale)}
            after={<PrivacyNote locale={locale} />}
          >
            {(control) => (
              <input
                {...control}
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t("report.email.placeholder", locale)}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                // Last field before submit — Enter implicitly submits, so "send".
                enterKeyHint="send"
                maxLength={EMAIL}
              />
            )}
          </Field>
        </>
      )}
    </PublicForm>
  );
}
