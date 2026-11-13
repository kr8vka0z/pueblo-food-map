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
 * Address check (#883 spec change, 2026-11-05, GET /events/share/geocode):
 * a fresh "several matches" at Send stops that send so the sender can pick;
 * no match never blocks. Typing in the address drops the pin, so a pin can
 * never belong to a different address than the one sent.
 *
 * WHY the link travels as `link_url`: `website` is PublicForm's honeypot key.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { EMAIL_RE } from "@/lib/email";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { PUBLIC_EVENT_LINK_LABELS } from "@/lib/adminEventValidation";
import type { GeocodeMatch } from "@/lib/censusGeocode";
import { safeUrl } from "@/lib/safeUrl";
import { NO_CAPTURE_CLASS } from "@/lib/analytics";
import { shrinkFlyerToJpeg, UnsupportedImageError } from "@/lib/imageResize";
import PublicForm, { Field, PrivacyNote, type FieldErrors } from "@/components/PublicForm";
import ShareEventPreview from "@/components/ShareEventPreview";

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

// "stale": the address changed while the lookup ran; its answer was thrown away.
type AddressCheck = "found" | "multiple" | "none" | "error" | "stale";

const SECTION = "pt-4 border-t border-[var(--color-bone-200)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]";

export default function ShareEventForm() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [values, setValues] = useState<ShareEventValues>(EMPTY);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [flyer, setFlyer] = useState<ShareEventFlyer | null>(null);
  const [flyerState, setFlyerState] = useState<"idle" | "uploading" | "errorType" | "errorUpload" | "errorReused">("idle");
  // Refs alongside the state: beforeSubmit and body() run inside one send, before a re-render could update them.
  const flyerRef = useRef<ShareEventFlyer | null>(null);
  const uploadingRef = useRef(false);
  const [sent, setSent] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const set = <K extends keyof ShareEventValues>(key: K, value: string) => setValues((p) => ({ ...p, [key]: value }));
  const [geo, setGeo] = useState<{ state: AddressCheck | "idle" | "loading"; options: GeocodeMatch[]; found?: string }>({
    state: "idle",
    options: [],
  });
  // The chosen match (address + pin). A ref because PublicForm calls body() right after beforeSubmit, before a re-render.
  const pinRef = useRef<GeocodeMatch | null>(null);
  // The address last looked up and its answer, so a blur then Send share one lookup.
  const checkRef = useRef<{ q: string; result: Promise<AddressCheck> } | null>(null);
  // Bumped by every edit and every new lookup: an answer for an older number is stale and touches nothing.
  const lookupRef = useRef(0);

  function chooseMatch(m: GeocodeMatch) {
    lookupRef.current++;
    pinRef.current = m;
    checkRef.current = { q: m.matchedAddress, result: Promise.resolve("found") };
    set("address", m.matchedAddress);
    setGeo({ state: "found", options: [], found: m.matchedAddress });
  }

  function editAddress(value: string) {
    lookupRef.current++;
    checkRef.current = null;
    pinRef.current = null;
    set("address", value);
    if (geo.state !== "idle") setGeo({ state: "idle", options: [] });
  }

  function checkAddress(): Promise<AddressCheck> | null {
    const q = values.address.trim();
    if (!q) return null;
    if (checkRef.current?.q === q) return checkRef.current.result;
    setGeo({ state: "loading", options: [] });
    const mine = ++lookupRef.current;
    const result = (async (): Promise<AddressCheck> => {
      try {
        const res = await fetch(`/events/share/geocode?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { ok: boolean; matches?: GeocodeMatch[] };
        if (mine !== lookupRef.current) return "stale";
        if (!data.ok || !data.matches) {
          setGeo({ state: "error", options: [] });
          return "error";
        }
        if (data.matches.length === 1) {
          chooseMatch(data.matches[0]);
          return "found";
        }
        if (data.matches.length > 1) {
          setGeo({ state: "multiple", options: data.matches });
          return "multiple";
        }
        setGeo({ state: "none", options: [] });
        return "none";
      } catch {
        if (mine !== lookupRef.current) return "stale";
        setGeo({ state: "error", options: [] });
        return "error";
      }
    })();
    checkRef.current = { q, result };
    return result;
  }

  /**
   * Before Send: never while a flyer is still uploading (it would be sent
   * without it); an unchecked address is checked first, and a freshly found
   * "several" or an address edited mid-check stops the send.
   */
  async function beforeSubmit(): Promise<boolean> {
    if (uploadingRef.current) return false;
    if (pinRef.current) return true;
    // "Already" = the choices are on screen now. checkRef is set when a lookup
    // STARTS, so testing it alone let a Send during a running lookup (a phone
    // tap blurs the field, starting one) skip the pick (#894).
    const already = geo.state === "multiple" && checkRef.current?.q === values.address.trim();
    const result = await checkAddress();
    if (uploadingRef.current || result === "stale") return false;
    return !(result === "multiple" && !already);
  }

  function setFlyerBoth(next: ShareEventFlyer | null) {
    flyerRef.current = next;
    setFlyer(next);
  }

  // Free the local preview URL when it is replaced or the page goes away.
  useEffect(() => () => {
    if (flyer) URL.revokeObjectURL(flyer.src);
  }, [flyer]);

  async function pickFlyer(file: File | undefined) {
    if (!file) return;
    uploadingRef.current = true;
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
      setFlyerBoth({ key: data.key, src: URL.createObjectURL(blob), width: data.width, height: data.height });
      setFlyerState("idle");
    } catch (err) {
      setFlyerState(err instanceof UnsupportedImageError ? "errorType" : "errorUpload");
    } finally {
      uploadingRef.current = false;
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
    if (v.linkUrl.trim() && !safeUrl(v.linkUrl.trim())) e.linkUrl = t("shareEvent.validation.linkInvalid", locale);
    if (!submitterName.trim()) e.submitterName = t("shareEvent.validation.submitterNameRequired", locale);
    if (!submitterEmail.trim()) e.submitterEmail = t("shareEvent.validation.emailRequired", locale);
    else if (!EMAIL_RE.test(submitterEmail)) e.submitterEmail = t("shareEvent.validation.emailInvalid", locale);
    return e;
  }

  // A named function, not an arrow: react/display-name flags an anonymous JSX-returning closure.
  const text = (key: keyof ShareEventValues, max: number, extra: Record<string, unknown> = {}) =>
    function Control(control: Parameters<Parameters<typeof Field>[0]["children"]>[0]) {
      return <input {...control} type="text" value={values[key]} onChange={(e) => set(key, e.target.value)} maxLength={max} {...extra} />;
    };

  const card = <ShareEventPreview values={values} flyer={flyer} locale={locale} />;

  // Phone only: Preview beside Send, pinned to the screen's bottom edge while the form is on screen.
  const submitRow = (submit: ReactNode) => (
    <div className="sticky bottom-[calc(var(--bottom-nav-clearance)+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 bg-[var(--color-bone-50)] px-4 py-3 md:static md:mx-0 md:p-0">
      <button
        type="button"
        // Blur first: vaul hides the page from screen readers when the sheet opens, and Chrome refuses
        // (console warning) while this button still holds focus behind it.
        onClick={(e) => {
          e.currentTarget.blur();
          setSheetOpen(true);
        }}
        className={
          "md:hidden inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] " +
          "border-2 border-[var(--color-sage-600)] bg-white text-base font-semibold text-[var(--color-sage-700)] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
        }
      >
        <Eye size={18} aria-hidden />
        {t("shareEvent.preview.open", locale)}
      </button>
      {/* A disabled fieldset disables the Send button inside it while a flyer uploads. */}
      <fieldset disabled={flyerState === "uploading"} className="min-w-0 flex-1">
        {submit}
      </fieldset>
    </div>
  );

  const form = (
    <PublicForm
      form="shareEvent"
      url="/events/share/submit"
      fieldIds={FIELD_IDS}
      rateLimitField="name"
      validate={validate}
      onSuccess={() => setSent(true)}
      submitRow={submitRow}
      beforeSubmit={beforeSubmit}
      onFailure={(error) => {
        // The server refused a flyer already sent with another submission: the sender adds it again.
        if (error === "flyer_reused") {
          setFlyerBoth(null);
          setFlyerState("errorReused");
        }
      }}
      body={() => ({
        name: values.name.trim(),
        host: values.host.trim(),
        date: values.date,
        start_time: values.start,
        end_time: values.end,
        description: values.description.trim(),
        what_to_bring: values.whatToBring.trim() || undefined,
        venue_name: values.venueName.trim() || undefined,
        address: pinRef.current?.matchedAddress ?? values.address.trim(),
        lat: pinRef.current?.lat,
        lng: pinRef.current?.lng,
        link_url: values.linkUrl.trim() || undefined,
        link_label: values.linkLabel,
        flyer_key: flyerRef.current?.key,
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
            {(control) => (
              <input
                {...control}
                type="text"
                value={values.address}
                onChange={(e) => editAddress(e.target.value)}
                onBlur={() => void checkAddress()}
                placeholder={t("shareEvent.address.placeholder", locale)}
                autoComplete="street-address"
                maxLength={SUGGEST_ADDRESS}
              />
            )}
          </Field>
          {/* Always mounted so its changes are announced; tones per DESIGN.md: sage = found, clay = check it (never red: it never blocks). */}
          <div data-testid="share-address-check" className={`${NO_CAPTURE_CLASS} -mt-3 empty:-mt-5`} aria-live="polite">
            {geo.state === "loading" && <p className="text-sm text-[var(--color-ink-500)]">{t("shareEvent.address.checking", locale)}</p>}
            {geo.state === "found" && geo.found && (
              <p className="text-sm text-[var(--color-sage-600)]">{t("shareEvent.address.found", locale, { address: geo.found })}</p>
            )}
            {(geo.state === "none" || geo.state === "error") && (
              <p className="text-sm text-[var(--color-clay-700)]">{t("shareEvent.address.notFound", locale)}</p>
            )}
            {geo.state === "multiple" && (
              <div className="space-y-1.5">
                <p id="share-address-choices" className="text-xs font-medium text-[var(--color-ink-500)]">
                  {t("shareEvent.address.choose", locale)}
                </p>
                <ul aria-labelledby="share-address-choices" className="space-y-1.5">
                  {geo.options.map((m, i) => (
                    <li key={`${m.lat}-${m.lng}-${i}`}>
                      <button
                        type="button"
                        onClick={() => chooseMatch(m)}
                        className={
                          "w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white " +
                          "px-3 py-2 text-left text-sm text-[var(--color-ink-700)] " +
                          "transition-colors duration-150 hover:bg-[var(--color-sage-100)] hover:border-[var(--color-sage-500)] " +
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                        }
                      >
                        {m.matchedAddress}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

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
            {(flyerState === "errorType" || flyerState === "errorUpload" || flyerState === "errorReused") && (
              <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                {t(`shareEvent.flyer.${flyerState}`, locale)}
              </p>
            )}
            {flyer && (
              <button
                type="button"
                onClick={() => setFlyerBoth(null)}
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

  // WHY one tree for both states: PublicForm must keep its place (same parent
  // elements) when `sent` flips, or React remounts it and its thank-you
  // state is lost, showing the filled form again.
  return (
    <div className={sent ? "max-w-lg text-center" : "md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-8"}>
      <div>
        {form}
        {sent && (
          // A full page load on purpose: it gives the next event a fresh Turnstile token and an empty form.
          <a
            href={pathname}
            className="inline-flex min-h-12 items-center text-sm font-semibold text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)]"
          >
            {t("shareEvent.another", locale)}
          </a>
        )}
      </div>
      {!sent && (
        <aside aria-label={t("shareEvent.preview.heading", locale)} className="hidden md:block md:sticky md:top-6">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
            <span>{t("shareEvent.preview.heading", locale)}</span>
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[var(--color-sage-700)]">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-sage-600)]" />
              {t("shareEvent.preview.live", locale)}
            </span>
          </div>
          {card}
          <p className="mt-3 text-xs text-[var(--color-ink-500)]">{t("shareEvent.preview.note", locale)}</p>
        </aside>
      )}
      <Drawer.Root open={sheetOpen && !sent} onOpenChange={setSheetOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[1100] bg-[rgba(26,24,23,0.45)]" />
          <Drawer.Content
            aria-describedby={undefined}
            data-testid="share-preview-sheet"
            className={`${NO_CAPTURE_CLASS} fixed inset-x-0 bottom-0 z-[1101] flex max-h-[90dvh] flex-col rounded-t-[20px] bg-[var(--color-bone-50)] outline-none md:hidden`}
          >
            <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[var(--color-bone-300)]" />
            <Drawer.Title className="mx-auto mt-2 shrink-0 rounded-full bg-[var(--color-event-outline)] px-3 py-1 text-xs font-bold text-[var(--color-bone-50)]">
              {t("shareEvent.preview.sheetTag", locale)}
            </Drawer.Title>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{card}</div>
            <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
              <Drawer.Close
                className={
                  "flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
                  "bg-white text-base font-semibold text-[var(--color-ink-700)] focus-visible:outline-none focus-visible:ring-2 " +
                  "focus-visible:ring-[var(--color-sage-500)]"
                }
              >
                {t("shareEvent.preview.back", locale)}
              </Drawer.Close>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
