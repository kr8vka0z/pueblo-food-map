"use client";

/**
 * SuggestForm — client component for the suggest-a-venue form.
 *
 * Fields: venue name, address and category (required); hours, contact
 * info, SNAP/WIC checkboxes and notes (optional); submitter email
 * (required — #232). Turnstile, the honeypot, validation focus,
 * submit/success/error states and the shared field markup live in
 * PublicForm.tsx.
 *
 * Reads locale from useLocale() (#289) instead of a prop passed down from
 * /suggest's page.tsx — matches the rest of the codebase's client-side
 * locale pattern (SiteFooter, ListView, HamburgerMenu).
 */

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { EMAIL_RE } from "@/lib/email";
import { categoryLabels } from "@/lib/categories";
import type { VenueCategory } from "@/types/venue";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import PublicForm, { Field, LABEL_CLASS, PrivacyNote, type FieldErrors } from "@/components/PublicForm";

const { SUGGEST_VENUE_NAME, SUGGEST_ADDRESS, SUGGEST_HOURS, SUGGEST_CONTACT, SUGGEST_NOTES, EMAIL } = FIELD_LIMITS;

type SuggestField = "venueName" | "address" | "category" | "submitterEmail";

const FIELD_IDS: Record<SuggestField, string> = {
  venueName: "suggest-name",
  address: "suggest-address",
  category: "suggest-category",
  submitterEmail: "suggest-email",
};

const CHECKBOX_CLASS =
  "w-4 h-4 rounded border-[var(--color-bone-300)] " +
  "text-[var(--color-sage-500)] " +
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)]";

export default function SuggestForm() {
  const [venueName, setVenueName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [acceptsSnap, setAcceptsSnap] = useState<boolean>(false);
  const [acceptsWic, setAcceptsWic] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [submitterEmail, setSubmitterEmail] = useState<string>("");

  function validate(locale: Locale): FieldErrors<SuggestField> {
    const errors: FieldErrors<SuggestField> = {};
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

  return (
    <PublicForm
      form="suggest"
      url="/suggest/submit"
      fieldIds={FIELD_IDS}
      rateLimitField="venueName"
      validate={validate}
      body={() => ({
        venueName: venueName.trim(),
        address: address.trim(),
        category,
        hours: hours.trim() || undefined,
        contact: contact.trim() || undefined,
        acceptsSnap,
        acceptsWic,
        notes: notes.trim() || undefined,
        submitterEmail: submitterEmail.trim(),
      })}
    >
      {(errors, locale) => (
        <>
          <Field id="suggest-name" label={t("suggest.venueName.label", locale)} required error={errors.venueName}>
            {(control) => (
              <input
                {...control}
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder={t("suggest.venueName.placeholder", locale)}
                maxLength={SUGGEST_VENUE_NAME}
              />
            )}
          </Field>

          <Field id="suggest-address" label={t("suggest.address.label", locale)} required error={errors.address}>
            {(control) => (
              <input
                {...control}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("suggest.address.placeholder", locale)}
                maxLength={SUGGEST_ADDRESS}
              />
            )}
          </Field>

          <Field id="suggest-category" label={t("suggest.category.label", locale)} required error={errors.category}>
            {(control) => (
              <select {...control} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{t("suggest.category.placeholder", locale)}</option>
                {(Object.keys(categoryLabels) as VenueCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {t(`suggest.category.${key}`, locale)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field id="suggest-hours" label={t("suggest.hours.label", locale)}>
            {(control) => (
              <input
                {...control}
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder={t("suggest.hours.placeholder", locale)}
                maxLength={SUGGEST_HOURS}
              />
            )}
          </Field>

          <Field id="suggest-contact" label={t("suggest.contact.label", locale)}>
            {(control) => (
              <input
                {...control}
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={t("suggest.contact.placeholder", locale)}
                maxLength={SUGGEST_CONTACT}
              />
            )}
          </Field>

          {/* SNAP / WIC checkboxes */}
          {/* legend is required for WCAG 1.3.1 (fieldset must have accessible name) */}
          <fieldset className="space-y-2">
            <legend className={LABEL_CLASS.replace("mb-1", "mb-2")}>{t("suggest.benefits.legend", locale)}</legend>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] cursor-pointer">
              <input
                type="checkbox"
                id="suggest-snap"
                checked={acceptsSnap}
                onChange={(e) => setAcceptsSnap(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              {t("suggest.snap.label", locale)}
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] cursor-pointer">
              <input
                type="checkbox"
                id="suggest-wic"
                checked={acceptsWic}
                onChange={(e) => setAcceptsWic(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              {t("suggest.wic.label", locale)}
            </label>
          </fieldset>

          <Field id="suggest-notes" label={t("suggest.notes.label", locale)} controlClass="resize-y min-h-[72px]">
            {(control) => (
              <textarea
                {...control}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("suggest.notes.placeholder", locale)}
                maxLength={SUGGEST_NOTES}
              />
            )}
          </Field>

          <Field
            id="suggest-email"
            label={t("suggest.submitterEmail.label", locale)}
            required
            error={errors.submitterEmail}
            hint={t("suggest.submitterEmail.hint", locale)}
            after={<PrivacyNote locale={locale} />}
          >
            {(control) => (
              <input
                {...control}
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder={t("suggest.submitterEmail.placeholder", locale)}
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
