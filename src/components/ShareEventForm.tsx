"use client";

/**
 * ShareEventForm — the public "Share an event" form (#883), on PublicForm
 * (Turnstile, honeypot, submit states and the thank-you panel live there).
 *
 * Fields: event name, host, one date with a start and end time (Pueblo time:
 * sent as typed, the server converts, like the admin form), what it is, what
 * to bring, place name, street address, link, button wording (the six
 * built-ins from #882, no Custom), an optional flyer, and the sender's name
 * and email. The email is used only for follow-up and is never shown.
 *
 * Flyer: picking a file shrinks it in the browser (shrinkFlyerToJpeg) and
 * uploads it at once to POST /events/share/flyer, which keeps it private;
 * the returned key rides along with the submission. A local object URL shows
 * it in the preview.
 *
 * WHY the link travels as `link_url`: `website` is PublicForm's honeypot key.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { EMAIL_RE } from "@/lib/email";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { PUBLIC_EVENT_LINK_LABELS } from "@/lib/adminEventValidation";
import { shrinkFlyerToJpeg, UnsupportedImageError } from "@/lib/imageResize";
import PublicForm, { Field, PrivacyNote, type FieldErrors } from "@/components/PublicForm";

const { SUGGEST_VENUE_NAME, SUGGEST_ADDRESS, SUGGEST_CONTACT, SUGGEST_NOTES, EVENT_SHORT_TEXT, EMAIL } = FIELD_LIMITS;

export interface ShareEventValues {
  name: string;
  host: string;
  date: string;
  start: string;
  end: string;
  description: string;
  whatToBring: string;
  venueName: string;
  address: string;
  linkUrl: string;
  linkLabel: string;
}

/** A flyer already stored as pending: its key for the submit, a local URL and real size for the preview. */
export interface ShareEventFlyer {
  key: string;
  src: string;
  width: number;
  height: number;
}

type ShareField =
  | "name" | "host" | "date" | "start" | "end" | "description" | "address" | "linkUrl" | "submitterName" | "submitterEmail";

const FIELD_IDS: Record<ShareField, string> = {
  name: "share-name",
  host: "share-host",
  date: "share-date",
  start: "share-start",
  end: "share-end",
  description: "share-description",
  address: "share-address",
  linkUrl: "share-link",
  submitterName: "share-submitter-name",
  submitterEmail: "share-submitter-email",
};

const EMPTY: ShareEventValues = {
  name: "", host: "", date: "", start: "", end: "", description: "", whatToBring: "",
  venueName: "", address: "", linkUrl: "", linkLabel: "website",
};

const SECTION = "pt-4 border-t border-[var(--color-bone-200)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]";

function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ShareEventForm() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [values, setValues] = useState<ShareEventValues>(EMPTY);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [flyer, setFlyer] = useState<ShareEventFlyer | null>(null);
  const [flyerState, setFlyerState] = useState<"idle" | "uploading" | "errorType" | "errorUpload">("idle");
  const set = <K extends keyof ShareEventValues>(key: K, value: string) => setValues((p) => ({ ...p, [key]: value }));

  // Free the local preview URL when it is replaced or the page goes away.
  useEffect(() => () => {
    if (flyer) URL.revokeObjectURL(flyer.src);
  }, [flyer]);

  async function pickFlyer(file: File | undefined) {
    if (!file) return;
    setFlyerState("uploading");
    try {
      const blob = await shrinkFlyerToJpeg(file);
      const form = new FormData();
      form.set("flyer", blob, "flyer.jpg");
      const res = await fetch("/events/share/flyer", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; key?: string; width?: number; height?: number; error?: string };
      if (!data.ok || !data.key || !data.width || !data.height) {
        setFlyerState(data.error === "unsupported_image" ? "errorType" : "errorUpload");
        return;
      }
      setFlyer({ key: data.key, src: URL.createObjectURL(blob), width: data.width, height: data.height });
      setFlyerState("idle");
    } catch (err) {
      setFlyerState(err instanceof UnsupportedImageError ? "errorType" : "errorUpload");
    }
  }

  function validate(locale: Locale): FieldErrors<ShareField> {
    const e: FieldErrors<ShareField> = {};
    const v = values;
    if (!v.name.trim()) e.name = t("shareEvent.validation.nameRequired", locale);
    if (!v.host.trim()) e.host = t("shareEvent.validation.hostRequired", locale);
    if (!v.date) e.date = t("shareEvent.validation.dateRequired", locale);
    if (!v.start) e.start = t("shareEvent.validation.startRequired", locale);
    if (!v.end) e.end = t("shareEvent.validation.endRequired", locale);
    else if (v.start && v.end <= v.start) e.end = t("shareEvent.validation.endBeforeStart", locale);
    if (!v.description.trim()) e.description = t("shareEvent.validation.descriptionRequired", locale);
    if (!v.address.trim()) e.address = t("shareEvent.validation.addressRequired", locale);
    if (v.linkUrl.trim() && !isHttpUrl(v.linkUrl.trim())) e.linkUrl = t("shareEvent.validation.linkInvalid", locale);
    if (!submitterName.trim()) e.submitterName = t("shareEvent.validation.submitterNameRequired", locale);
    if (!submitterEmail.trim()) e.submitterEmail = t("shareEvent.validation.emailRequired", locale);
    else if (!EMAIL_RE.test(submitterEmail)) e.submitterEmail = t("shareEvent.validation.emailInvalid", locale);
    return e;
  }

  const text = (key: keyof ShareEventValues, max: number, extra: Record<string, unknown> = {}) =>
    function Control(control: Parameters<Parameters<typeof Field>[0]["children"]>[0]) {
      return <input {...control} type="text" value={values[key]} onChange={(e) => set(key, e.target.value)} maxLength={max} {...extra} />;
    };

  return (
    <PublicForm
      form="shareEvent"
      url="/events/share/submit"
      fieldIds={FIELD_IDS}
      rateLimitField="name"
      validate={validate}
      successActions={
        // A full page load on purpose: it gives the next event a fresh Turnstile token and an empty form.
        <a
          href={pathname}
          className="mt-3 block text-sm font-semibold text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)]"
        >
          {t("shareEvent.another", locale)}
        </a>
      }
      body={() => ({
        name: values.name.trim(),
        host: values.host.trim(),
        date: values.date,
        start_time: values.start,
        end_time: values.end,
        description: values.description.trim(),
        what_to_bring: values.whatToBring.trim() || undefined,
        venue_name: values.venueName.trim() || undefined,
        address: values.address.trim(),
        link_url: values.linkUrl.trim() || undefined,
        link_label: values.linkLabel,
        flyer_key: flyer?.key,
        submitter_name: submitterName.trim(),
        submitter_email: submitterEmail.trim(),
      })}
    >
      {(errors, locale) => (
        <>
          <p className={SECTION + " pt-0 border-t-0"}>{t("shareEvent.section.event", locale)}</p>
          <Field id={FIELD_IDS.name} label={t("shareEvent.name.label", locale)} required error={errors.name}>
            {text("name", SUGGEST_VENUE_NAME, { placeholder: t("shareEvent.name.placeholder", locale) })}
          </Field>
          <Field id={FIELD_IDS.host} label={t("shareEvent.host.label", locale)} required error={errors.host}>
            {text("host", SUGGEST_VENUE_NAME, { placeholder: t("shareEvent.host.placeholder", locale) })}
          </Field>
          <Field id={FIELD_IDS.date} label={t("shareEvent.date.label", locale)} required error={errors.date}>
            {(control) => <input {...control} type="date" value={values.date} onChange={(e) => set("date", e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={FIELD_IDS.start} label={t("shareEvent.start.label", locale)} required error={errors.start}>
              {(control) => <input {...control} type="time" value={values.start} onChange={(e) => set("start", e.target.value)} />}
            </Field>
            <Field id={FIELD_IDS.end} label={t("shareEvent.end.label", locale)} required error={errors.end}>
              {(control) => <input {...control} type="time" value={values.end} onChange={(e) => set("end", e.target.value)} />}
            </Field>
          </div>
          <p className="-mt-3 text-xs text-[var(--color-ink-400)]">{t("shareEvent.timeHint", locale)}</p>
          <Field
            id={FIELD_IDS.description}
            label={t("shareEvent.description.label", locale)}
            required
            error={errors.description}
            controlClass="resize-y min-h-[88px]"
          >
            {(control) => (
              <textarea
                {...control}
                rows={3}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder={t("shareEvent.description.placeholder", locale)}
                maxLength={SUGGEST_NOTES}
              />
            )}
          </Field>
          <Field id="share-bring" label={t("shareEvent.bring.label", locale)}>
            {text("whatToBring", EVENT_SHORT_TEXT, { placeholder: t("shareEvent.bring.placeholder", locale) })}
          </Field>

          <p className={SECTION}>{t("shareEvent.section.where", locale)}</p>
          <Field id="share-venue-name" label={t("shareEvent.venueName.label", locale)}>
            {text("venueName", SUGGEST_VENUE_NAME, { placeholder: t("shareEvent.venueName.placeholder", locale) })}
          </Field>
          <Field id={FIELD_IDS.address} label={t("shareEvent.address.label", locale)} required error={errors.address}>
            {text("address", SUGGEST_ADDRESS, { placeholder: t("shareEvent.address.placeholder", locale), autoComplete: "street-address" })}
          </Field>

          <p className={SECTION}>{t("shareEvent.section.link", locale)}</p>
          <Field
            id={FIELD_IDS.linkUrl}
            label={t("shareEvent.link.label", locale)}
            error={errors.linkUrl}
            hint={t("shareEvent.link.hint", locale)}
          >
            {(control) => (
              <input
                {...control}
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                value={values.linkUrl}
                onChange={(e) => set("linkUrl", e.target.value)}
                placeholder={t("shareEvent.link.placeholder", locale)}
                maxLength={SUGGEST_CONTACT}
              />
            )}
          </Field>
          <Field id="share-link-label" label={t("shareEvent.linkLabel.label", locale)}>
            {(control) => (
              <select {...control} value={values.linkLabel} onChange={(e) => set("linkLabel", e.target.value)}>
                {PUBLIC_EVENT_LINK_LABELS.map((key) => (
                  <option key={key} value={key}>
                    {t(`events.card.action.${key}`, locale)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div>
            <label htmlFor="share-flyer" className="block text-sm font-medium text-[var(--color-ink-700)] mb-1">
              {t("shareEvent.flyer.label", locale)}
            </label>
            <input
              id="share-flyer"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="share-flyer-hint"
              disabled={flyerState === "uploading"}
              onChange={(e) => {
                void pickFlyer(e.target.files?.[0]);
                e.target.value = ""; // picking the same file again still fires onChange
              }}
              className="block w-full text-sm text-[var(--color-ink-700)] file:mr-3 file:min-h-12 file:rounded-[var(--radius-md)] file:border file:border-[var(--color-sage-500)] file:bg-transparent file:px-4 file:text-sm file:font-medium file:text-[var(--color-sage-600)]"
            />
            <p id="share-flyer-hint" className="mt-1 text-xs text-[var(--color-ink-400)]" role="status">
              {flyerState === "uploading"
                ? t("shareEvent.flyer.uploading", locale)
                : flyerState === "idle"
                  ? t("shareEvent.flyer.hint", locale)
                  : ""}
            </p>
            {(flyerState === "errorType" || flyerState === "errorUpload") && (
              <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                {t(`shareEvent.flyer.${flyerState}`, locale)}
              </p>
            )}
            {flyer && (
              <button
                type="button"
                onClick={() => setFlyer(null)}
                className="mt-2 inline-flex min-h-12 items-center text-sm font-medium text-[var(--color-danger)] underline underline-offset-2"
              >
                {t("shareEvent.flyer.remove", locale)}
              </button>
            )}
          </div>

          <p className={SECTION}>{t("shareEvent.section.you", locale)}</p>
          <Field id={FIELD_IDS.submitterName} label={t("shareEvent.submitterName.label", locale)} required error={errors.submitterName}>
            {(control) => (
              <input
                {...control}
                type="text"
                autoComplete="name"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                maxLength={SUGGEST_VENUE_NAME}
              />
            )}
          </Field>
          <Field
            id={FIELD_IDS.submitterEmail}
            label={t("shareEvent.submitterEmail.label", locale)}
            required
            error={errors.submitterEmail}
            hint={t("shareEvent.submitterEmail.hint", locale)}
            after={<PrivacyNote locale={locale} />}
          >
            {(control) => (
              <input
                {...control}
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder={t("shareEvent.submitterEmail.placeholder", locale)}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
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
