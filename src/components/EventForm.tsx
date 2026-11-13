"use client";

/**
 * EventForm — client component for the admin "Add event" / "Edit event" form
 * (#757). Same split as AddVenueForm: this owns field state, fast client
 * checks and the fetch; the Server Component page owns the auth gate and the
 * reads; the route handlers (POST /api/admin/events, PATCH/archive under
 * ../[id]) are the authoritative validation and write.
 *
 * ONE component, two modes (`eventId` absent = create, present = edit).
 *
 * Times: the two datetime-local inputs hold Pueblo wall-clock time. They are
 * sent AS TYPED (`starts_at_local`) and the SERVER converts to UTC — the
 * browser's own timezone never touches the stored instant (see
 * src/lib/eventTime.ts). Client-side the only comparison is a plain string
 * compare of two same-zone values, enough for fast "end before start" feedback.
 *
 * Place: either picked from an existing venue (its address and lat/lng are
 * COPIED into the event, venue_id kept as provenance) or typed and geocoded
 * with the same GET /api/admin/geocode the venue form uses. Editing the typed
 * address drops the old coordinates, so stale coordinates can never ride along
 * with a new address. "Venue name" (#882) is the event's own text; picking a
 * place (or opening an event linked to one) fills it with the place's name
 * only when the box is empty.
 *
 * Action button (#882): the link plus what the card's button says, one of the
 * built-in wordings (Spanish built in) or Custom with English and Spanish
 * boxes. Suggest Spanish includes the custom words only when Custom is chosen.
 *
 * Status actions (#926 layout): the save row is Cancel (a link back to the
 * list, saves nothing, off while a save runs) beside Save draft / Publish on create and on a draft,
 * or beside Save changes otherwise. Cancel event (published only; a step,
 * useAdminStep: it opens the required cancel note with Keep event first and
 * the red Confirm cancel event second) and Archive event (asks on the page first,
 * AdminConfirm) sit apart in a Danger zone at the foot. The `updated_at` precondition (`expectedUpdatedAt`)
 * is refreshed from each successful save, so consecutive saves don't 409
 * against the admin's own previous save; a real 409 shows the server message
 * and a Reload button, leaving the admin's unsaved edits on screen.
 *
 * From a public submission (#883, `submissionId`): the "Add event" form
 * opened prefilled from a "Share an event" submission whose address couldn't
 * be located automatically. It sends `submission_id`, offers Save draft only
 * (the route refuses Publish then), and saving marks the submission converted.
 *
 * Suggest Spanish: one button asks POST /api/admin/events/translate for a
 * machine draft of the Spanish boxes. It fills ONLY boxes that are empty (also
 * re-checked when the answer lands, in case the admin typed meanwhile), so
 * Spanish someone wrote is never overwritten. Nothing is saved by it.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { focusFirstProblem } from "@/lib/focusFirstProblem";
import {
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  busyButtonProps,
  cancelLinkProps,
  errorClass,
  fieldGroupClass,
  hintClass,
  inputBase,
  inputBorder,
  labelClass,
  requiredMarkClass,
  saveRowClass,
} from "@/components/formClasses";
import {
  cardSlimClass,
  dangerButtonClass,
  failureBoxClass,
  failureLineClass,
  pickerOptionClass,
  secondaryButtonClass,
  sectionTitleClass,
  tapLinkClass,
} from "@/lib/adminCardStyles";
import AdminConfirm, { useAdminConfirm, useAdminStep } from "@/components/AdminConfirm";
import AdminSegmented from "@/components/AdminSegmented";
import EventFlyerField from "@/components/EventFlyerField";
import type { PublicFlyer } from "@/lib/events";
import type { VenueChoice } from "@/lib/adminEventReads";
import type { EventLinkLabel, EventStatus } from "@/lib/adminEventValidation";
import type { GeocodeMatch } from "@/lib/censusGeocode";

export interface EventFormValues {
  name: string;
  nameEs: string;
  host: string;
  hostEs: string;
  description: string;
  descriptionEs: string;
  whatToBring: string;
  whatToBringEs: string;
  cancelNote: string;
  cancelNoteEs: string;
  /** Pueblo wall clock, "YYYY-MM-DDTHH:mm". */
  startsLocal: string;
  endsLocal: string;
  venueId: string;
  address: string;
  lat: string;
  lng: string;
  /** Shown in bold above the address on the card (#882). */
  venueName: string;
  linkUrl: string;
  /** One of EVENT_LINK_LABELS: what the card's action button says. */
  linkLabel: string;
  linkLabelCustom: string;
  linkLabelCustomEs: string;
}

export interface EventFormProps {
  venues: VenueChoice[];
  eventId?: string;
  initialValues?: Partial<EventFormValues>;
  /** Edit mode: the row's current status. */
  status?: EventStatus;
  /** Edit mode: the row's `updated_at` as the page read it (optimistic-concurrency precondition). */
  expectedUpdatedAt?: string;
  /** Show the "Saved" banner on first render (set after a create redirects to the edit page). */
  justSaved?: boolean;
  /** Edit mode: the event's current flyer, if any (#760). */
  initialFlyer?: PublicFlyer | null;
  /** Create mode only: the public submission this draft comes from (#883). */
  submissionId?: string;
  /** A short instruction shown in a box at the top of the form (the ?from= submission flow). */
  notice?: string;
}

// Keys match the server's error map (adminEventValidation.ts): snake_case field names, `place`, `starts_at`, `ends_at`, `_form`.
type FieldErrors = Record<string, string | undefined>;

const EMPTY: EventFormValues = {
  name: "", nameEs: "", host: "", hostEs: "", description: "", descriptionEs: "",
  whatToBring: "", whatToBringEs: "", cancelNote: "", cancelNoteEs: "",
  startsLocal: "", endsLocal: "", venueId: "", address: "", lat: "", lng: "", venueName: "", linkUrl: "",
  linkLabel: "website", linkLabelCustom: "", linkLabelCustomEs: "",
};

// The card button's wordings (#882), in the order the admin sees them. Keys are EVENT_LINK_LABELS.
const LINK_LABEL_OPTIONS: [EventLinkLabel, string][] = [
  ["website", "Visit website"],
  ["signup", "Sign up"],
  ["tickets", "Get tickets"],
  ["rsvp", "RSVP"],
  ["volunteer", "Volunteer"],
  ["donate", "Donate"],
  ["custom", "Custom (type your own)"],
];


interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  lang?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  /** Lets a step put focus in this box when it opens (the cancellation note). */
  fieldRef?: React.Ref<HTMLTextAreaElement>;
}

function TextField({ id, label, value, onChange, max, error, required, multiline, lang, hint, type = "text", placeholder, fieldRef }: TextFieldProps) {
  const common = {
    id,
    value,
    lang,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    maxLength: max || undefined,
    "aria-required": required ? ("true" as const) : undefined,
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: `${inputBase} ${inputBorder(!!error)}${multiline ? " resize-y min-h-[72px]" : ""}`,
  };
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && (
          <span aria-hidden className={requiredMarkClass}>
            {" "}*
          </span>
        )}
        {hint && <span className={hintClass}> {hint}</span>}
      </label>
      {multiline ? <textarea ref={fieldRef} rows={3} {...common} /> : <input type={type} {...common} />}
      {error && (
        <p id={`${id}-error`} role="alert" className={errorClass}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Client-side mirror of the server rules, for instant feedback only (the route re-checks everything). */
function validateClient(v: EventFormValues, cancelling: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (!v.name.trim()) e.name = "Name is required.";
  if (!v.startsLocal) e.starts_at = "Enter a start date and time.";
  if (!v.endsLocal) e.ends_at = "Enter an end date and time.";
  else if (v.startsLocal && v.endsLocal <= v.startsLocal) e.ends_at = "The end must be after the start.";
  if (!v.address.trim()) e.place = "Choose a place or enter an address.";
  else if (v.lat === "" || v.lng === "") e.place = "Find the location for this address, or choose a place from the list.";
  if (cancelling && !v.cancelNote.trim()) e.cancel_note = "Add a note explaining the cancellation.";
  if (v.linkLabel === "custom" && !v.linkLabelCustom.trim()) e.link_label_custom = "Type what the button should say.";
  return e;
}

export default function EventForm({ venues, eventId, initialValues, status: initialStatus, expectedUpdatedAt, justSaved, initialFlyer, submissionId, notice }: EventFormProps) {
  const router = useRouter();
  const isEdit = eventId !== undefined;
  const [values, setValues] = useState<EventFormValues>(() => {
    const start = { ...EMPTY, ...initialValues };
    // An event linked to a mapped place but saved before #882 has no venue name: offer the place's.
    if (!start.venueName.trim() && start.venueId) start.venueName = venues.find((x) => x.id === start.venueId)?.name ?? "";
    return start;
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; code: string | null } | null>(null);
  const [saved, setSaved] = useState<{ id: string } | null>(justSaved && eventId ? { id: eventId } : null);
  const [status, setStatus] = useState<EventStatus>(initialStatus ?? "draft");
  const [version, setVersion] = useState(expectedUpdatedAt);
  // Cancel event is a step (#926): "Cancel event" stays mounted and hidden
  // while it is open, focus goes to the English note box, and Keep event
  // hands focus back to "Cancel event". Escape does what Keep event does,
  // and nothing while a request runs.
  const {
    open: cancelling,
    openStep: openCancelStep,
    closeStep: closeCancelStep,
    triggerRef: cancelEventRef,
    fieldRef: cancelNoteRef,
  } = useAdminStep({ busy, onCancel: keepEvent });
  // #926: after a Save with problems, focus (and so the scroll) goes to the
  // first box marked wrong. Bumped on every refusal, so a second one moves focus again.
  const formRef = useRef<HTMLFormElement>(null);
  const [errorFocusTick, setErrorFocusTick] = useState(0);
  useEffect(() => {
    if (errorFocusTick > 0) focusFirstProblem(formRef.current);
  }, [errorFocusTick]);
  // Shown inside the archive confirm, so a failure is seen where the admin pressed (a conflict goes to the top box, with Reload, instead).
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const { asking: askingArchive, ask: askArchive, cancel: cancelArchive, triggerRef: archiveRef } = useAdminConfirm();
  const [suggest, setSuggest] = useState<"idle" | "busy" | "done" | "none" | "full" | "error">("idle");
  const [placeMode, setPlaceMode] = useState<"venue" | "address">(initialValues?.venueId ? "venue" : "address");
  const [venueQuery, setVenueQuery] = useState("");
  const [geo, setGeo] = useState<{ state: "idle" | "loading" | "found" | "none" | "error" | "multiple"; message: string; options: GeocodeMatch[] }>({
    state: "idle",
    message: "",
    options: [],
  });

  // When a press removes the pressed control (a picked place, Change), focus
  // goes to what replaced it once that has rendered, not to the page body (#926).
  const changePlaceRef = useRef<HTMLButtonElement>(null);
  const venueSearchRef = useRef<HTMLInputElement>(null);
  const findLocationRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"change" | "search" | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    const target = focusNext.current === "change" ? changePlaceRef.current : venueSearchRef.current;
    focusNext.current = null;
    target?.focus();
  }, [values.venueId]);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => setValues((p) => ({ ...p, [key]: value }));
  const showCancelNote = cancelling || status === "cancelled";
  const pickedVenue = venues.find((x) => x.id === values.venueId);

  function pickVenue(venue: VenueChoice) {
    setValues((p) => ({
      ...p,
      venueId: venue.id,
      address: venue.address,
      lat: String(venue.lat),
      lng: String(venue.lng),
      // Only fills an empty box: a name the admin typed is never overwritten.
      venueName: p.venueName.trim() ? p.venueName : venue.name,
    }));
    setErrors((p) => ({ ...p, place: undefined }));
    setVenueQuery("");
  }

  function clearPlace() {
    setValues((p) => ({ ...p, venueId: "", address: "", lat: "", lng: "" }));
    setGeo({ state: "idle", message: "", options: [] });
  }

  function applyMatch(m: GeocodeMatch) {
    setValues((p) => ({ ...p, lat: String(m.lat), lng: String(m.lng) }));
    setErrors((p) => ({ ...p, place: undefined }));
    setGeo({ state: "found", message: `Found: ${m.matchedAddress}`, options: [] });
  }

  async function findLocation() {
    const q = values.address.trim();
    if (!q) return;
    setGeo({ state: "loading", message: "Looking up…", options: [] });
    try {
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
      if (res.status !== 200) throw new Error("geocode");
      const { matches } = (await res.json()) as { matches: GeocodeMatch[] };
      if (matches.length === 0) setGeo({ state: "none", message: "No match found. Check the address, or pick a place from the list instead.", options: [] });
      else if (matches.length === 1) applyMatch(matches[0]);
      else setGeo({ state: "multiple", message: `Found ${matches.length} possible matches. Choose one.`, options: matches });
    } catch {
      setGeo({ state: "error", message: "Location lookup is unavailable right now. Pick a place from the list instead.", options: [] });
    }
  }

  async function send(action: "save_draft" | "save" | "publish" | "cancel") {
    const clientErrors = validateClient(values, action === "cancel");
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setErrorFocusTick((n) => n + 1);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    const body = {
      action,
      name: values.name, name_es: values.nameEs,
      host: values.host, host_es: values.hostEs,
      description: values.description, description_es: values.descriptionEs,
      what_to_bring: values.whatToBring, what_to_bring_es: values.whatToBringEs,
      cancel_note: values.cancelNote, cancel_note_es: values.cancelNoteEs,
      starts_at_local: values.startsLocal, ends_at_local: values.endsLocal,
      venue_id: values.venueId || undefined,
      address: values.address,
      lat: values.lat === "" ? undefined : Number(values.lat),
      lng: values.lng === "" ? undefined : Number(values.lng),
      venue_name: values.venueName,
      link_url: values.linkUrl,
      link_label: values.linkLabel,
      link_label_custom: values.linkLabelCustom,
      link_label_custom_es: values.linkLabelCustomEs,
      ...(isEdit ? { expectedUpdatedAt: version } : {}),
      ...(!isEdit && submissionId ? { submission_id: submissionId } : {}),
    };
    try {
      const res = await fetch(isEdit ? `/api/admin/events/${eventId}` : "/api/admin/events", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 422) {
        setErrors(((await res.json()) as { errors: FieldErrors }).errors);
        setErrorFocusTick((n) => n + 1);
      } else if (res.status === 200 || res.status === 201) {
        const data = (await res.json()) as { id?: string; status: EventStatus; updated_at: string };
        if (!isEdit && data.id) {
          router.replace(`/admin/events/${data.id}/edit?saved=1`);
          return;
        }
        setStatus(data.status);
        setVersion(data.updated_at);
        // Any successful save closes the cancel step, as before.
        if (cancelling) closeCancelStep();
        setSaved({ id: eventId as string });
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        setFailure({ message: data?.message ?? "The event was not saved. Try again.", code: data?.error ?? null });
      }
    } catch {
      setFailure({ message: "The event was not saved. Try again.", code: null });
    } finally {
      setBusy(false);
    }
  }

  async function suggestSpanish() {
    // Only fields with English text and a still-empty Spanish box are worth asking for.
    const pairs: [string, keyof EventFormValues, keyof EventFormValues][] = [
      ["name", "name", "nameEs"],
      ["host", "host", "hostEs"],
      ["description", "description", "descriptionEs"],
      ["what_to_bring", "whatToBring", "whatToBringEs"],
      ...(showCancelNote ? ([["cancel_note", "cancelNote", "cancelNoteEs"]] as [string, keyof EventFormValues, keyof EventFormValues][]) : []),
      ...(values.linkLabel === "custom"
        ? ([["link_label_custom", "linkLabelCustom", "linkLabelCustomEs"]] as [string, keyof EventFormValues, keyof EventFormValues][])
        : []),
    ];
    if (!pairs.some(([, en]) => values[en].trim())) {
      setSuggest("none");
      return;
    }
    const ask = pairs.filter(([, en, es]) => values[en].trim() && !values[es].trim());
    if (ask.length === 0) {
      setSuggest("full");
      return;
    }
    setSuggest("busy");
    try {
      const res = await fetch("/api/admin/events/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(ask.map(([key, en]) => [key, values[en]]))),
      });
      if (res.status !== 200) throw new Error("translate");
      const { suggestions } = (await res.json()) as { suggestions: Record<string, string> };
      setValues((p) => {
        const next = { ...p };
        for (const [key, en, es] of ask) {
          const text = suggestions[`${key}_es`];
          // Skip a field whose English changed in flight: the draft is for the old English.
          if (typeof text === "string" && !p[es].trim() && p[en] === values[en]) next[es] = text;
        }
        return next;
      });
      setSuggest("done");
    } catch {
      setSuggest("error");
    }
  }

  // Runs only from the on-page confirm's Archive event button: that second press is the gate.
  async function archive() {
    setBusy(true);
    setFailure(null);
    setArchiveError(null);
    // Shown once: inside the confirm, where the admin pressed; a conflict
    // goes only to the top box instead, the one that carries Reload.
    const fail = (message: string, code: string | null) => {
      if (code === "conflict") setFailure({ message, code });
      else setArchiveError(message);
    };
    try {
      const res = await fetch(`/api/admin/events/${eventId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: version }),
      });
      if (res.status === 200) {
        router.push("/admin/events");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      fail(data?.message ?? "The event was not archived. Try again.", data?.error ?? null);
    } catch {
      fail("The event was not archived. Try again.", null);
    } finally {
      setBusy(false);
    }
  }

  const matches =
    venueQuery.trim().length >= 2
      ? venues.filter((x) => `${x.name} ${x.address}`.toLowerCase().includes(venueQuery.trim().toLowerCase())).slice(0, 8)
      : [];

  // Save draft gets Publish beside it on a new event (not one from a submission: the route refuses
  // Publish then) and on a draft; otherwise the save button stands alone.
  const hasPublish = isEdit ? status === "draft" : !submissionId;

  // The place's problem line sits directly under the red-edged box it is
  // about (#926), so each place mode renders it right after its own box.
  const placeError = errors.place ? (
    <p id="event-place-error" role="alert" className={errorClass}>
      {errors.place}
    </p>
  ) : null;

  // Closes the cancel step without sending anything: the half-typed note and
  // its error go too, so a reopened step starts clean.
  function keepEvent() {
    setValues((p) => ({ ...p, cancelNote: "", cancelNoteEs: "" }));
    setErrors((p) => ({ ...p, cancel_note: undefined, cancel_note_es: undefined }));
    closeCancelStep();
  }

  const cancelNoteFields = (
    // data-admin-step: the note sits in its own TextField wrapper, so the
    // step's Escape listener goes on this box to work from both buttons too.
    // While cancelling it is a step beside the Archive confirm, so it takes the
    // confirm's look (AdminConfirm: 1 px red edge, 10 px corners, white) and
    // its button row. A cancelled event's note, edited later, keeps the clay group.
    <fieldset
      data-admin-step
      className={
        cancelling
          ? "rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-white p-4"
          : "rounded-[var(--radius-lg)] border border-[var(--color-clay-500)] p-4"
      }
    >
      <legend className={`${labelClass} px-1`}>Cancellation note</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="event-cancel-note" multiline required label="Note (English)" value={values.cancelNote} onChange={(v) => set("cancelNote", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.cancel_note} fieldRef={cancelling ? cancelNoteRef : undefined} />
        <TextField id="event-cancel-note-es" multiline lang="es" label="Note (Spanish)" value={values.cancelNoteEs} onChange={(v) => set("cancelNoteEs", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.cancel_note_es} />
      </div>
      {/* #926 decision 8: the safe button first, then the red one. "Keep event",
          not "Cancel": this form already has a Cancel that leaves the page. */}
      {cancelling && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={keepEvent} className={secondaryButtonClass}>
            Keep event
          </button>
          <button type="button" onClick={() => void send("cancel")} {...busyButtonProps(busy)} className={dangerButtonClass}>
            {busy ? "Cancelling…" : "Confirm cancel event"}
          </button>
        </div>
      )}
    </fieldset>
  );

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        void send(isEdit ? "save" : "save_draft");
      }}
      noValidate
      className="space-y-5"
    >
      {notice && <p className={`${cardSlimClass} text-sm text-[var(--color-ink-700)]`}>{notice}</p>}

      {saved && (
        <div role="status" className="rounded-[var(--radius-md)] border border-[var(--color-sage-500)] bg-[var(--color-sage-50)] px-4 py-3 text-sm text-[var(--color-sage-700)]">
          <p className="font-medium">Saved.</p>
          <p className="flex flex-wrap gap-x-4">
            {/* ?event=<id> opens this event's card on the map (#758). */}
            <Link href={`/?event=${saved.id}`} className={tapLinkClass}>
              View on map
            </Link>
            <Link href="/admin/events" className={tapLinkClass}>
              Back to events
            </Link>
          </p>
        </div>
      )}

      {failure && (
        <div role="alert" className={failureBoxClass}>
          <p className={`${failureLineClass} font-medium`}>{failure.message}</p>
          {failure.code === "conflict" && (
            <button type="button" onClick={() => window.location.reload()} className={`mt-2 ${dangerButtonClass}`}>
              Reload
            </button>
          )}
        </div>
      )}

      <p className="text-sm text-[var(--color-ink-500)]">
        Spanish is optional. Where it is blank, visitors see the English text.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void suggestSpanish()} {...busyButtonProps(suggest === "busy")} className={secondaryButtonClass}>
          {suggest === "busy" ? "Suggesting…" : "Suggest Spanish"}
        </button>
        <p aria-live="polite" className={`text-sm ${suggest === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-500)]"}`}>
          {suggest === "busy" && "Suggesting Spanish…"}
          {suggest === "done" && "Spanish suggested by a machine. Read it before publishing."}
          {suggest === "error" && "The Spanish suggestion could not be made. You can type the Spanish by hand."}
          {suggest === "none" && "Add some English text first, then ask for a Spanish suggestion."}
          {suggest === "full" && "The Spanish boxes are already filled, so nothing was changed."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="event-name" label="Name (English)" required value={values.name} onChange={(v) => set("name", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.name} />
        <TextField id="event-name-es" label="Name (Spanish)" lang="es" value={values.nameEs} onChange={(v) => set("nameEs", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.name_es} />
        <TextField id="event-host" label="Host (English)" hint="(optional) who is running it" value={values.host} onChange={(v) => set("host", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.host} />
        <TextField id="event-host-es" label="Host (Spanish)" lang="es" value={values.hostEs} onChange={(v) => set("hostEs", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.host_es} />
      </div>

      {/* Start / end — Pueblo time, converted to UTC by the server. */}
      <fieldset className={fieldGroupClass}>
        <legend className={`${labelClass} px-1`}>
          When <span className={hintClass}>(Pueblo time, Mountain Time)</span>
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="event-starts" type="datetime-local" label="Starts" required value={values.startsLocal} onChange={(v) => set("startsLocal", v)} max={0} error={errors.starts_at} />
          <TextField id="event-ends" type="datetime-local" label="Ends" required value={values.endsLocal} onChange={(v) => set("endsLocal", v)} max={0} error={errors.ends_at} />
        </div>
      </fieldset>

      {/* Place — pick an existing venue, or type an address and find its location. */}
      <fieldset className={fieldGroupClass}>
        <legend className={`${labelClass} px-1`}>
          Where <span aria-hidden className={requiredMarkClass}>*</span>
        </legend>
        {/* WHY short words: the slider's two halves are equal and never wrap, so at 360 wide the
            longer "A place already on the map" would push the page sideways. The legend carries the meaning. */}
        <div className="mb-3">
          <AdminSegmented
            name="place-mode"
            legend="Choose a place already on the map, or type a different address"
            options={[
              { value: "venue", label: "On the map" },
              { value: "address", label: "Other address" },
            ]}
            value={placeMode}
            onChange={(v) => {
              setPlaceMode(v as "venue" | "address");
              clearPlace();
            }}
          />
        </div>

        {placeMode === "venue" ? (
          <div>
            {values.venueId ? (
              <div className={`flex items-start justify-between gap-3 bg-white ${fieldGroupClass}`}>
                <p className="text-sm text-[var(--color-ink-700)]">
                  <span className="font-medium text-[var(--color-ink-900)]">{pickedVenue?.name ?? "Selected place"}</span>
                  <br />
                  {values.address}
                </p>
                <button
                  ref={changePlaceRef}
                  type="button"
                  onClick={() => {
                    focusNext.current = "search";
                    clearPlace();
                  }}
                  className={secondaryButtonClass}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <label htmlFor="event-venue-search" className={labelClass}>
                  Search places by name or address
                </label>
                <input
                  ref={venueSearchRef}
                  id="event-venue-search"
                  type="text"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  aria-invalid={errors.place ? "true" : undefined}
                  aria-describedby={errors.place ? "event-place-error" : undefined}
                  className={`${inputBase} ${inputBorder(!!errors.place)}`}
                />
                {placeError}
                {matches.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            focusNext.current = "change";
                            pickVenue(m);
                          }}
                          className={pickerOptionClass}
                        >
                          <span className="font-medium text-[var(--color-ink-900)]">{m.name}</span>
                          <br />
                          {m.address}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {venueQuery.trim().length >= 2 && matches.length === 0 && (
                  <p className="mt-2 text-sm text-[var(--color-ink-500)]">No places match. Try another name, or use a different address.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="event-address" className={labelClass}>Address</label>
              <input
                id="event-address"
                type="text"
                value={values.address}
                // Dropping lat/lng on edit: old coordinates must not outlive the address they belonged to.
                onChange={(e) => { setValues((p) => ({ ...p, address: e.target.value, lat: "", lng: "" })); setGeo({ state: "idle", message: "", options: [] }); }}
                maxLength={FIELD_LIMITS.SUGGEST_ADDRESS}
                aria-invalid={errors.place ? "true" : undefined}
                aria-describedby={errors.place ? "event-place-error" : undefined}
                className={`${inputBase} ${inputBorder(!!errors.place)}`}
              />
              {placeError}
            </div>
            <button
              ref={findLocationRef}
              type="button"
              disabled={!values.address.trim()}
              onClick={() => void findLocation()}
              {...busyButtonProps(geo.state === "loading")}
              className={`${secondaryButtonClass} whitespace-nowrap`}
            >
              {/* Both words in one grid cell, so the button keeps its width while
                  "Looking up…" shows; the unseen one is aria-hidden. */}
              <span className="grid">
                <span aria-hidden={geo.state === "loading" || undefined} className={`[grid-area:1/1] ${geo.state === "loading" ? "invisible" : ""}`}>
                  Find location from address
                </span>
                <span aria-hidden={geo.state !== "loading" || undefined} className={`[grid-area:1/1] ${geo.state === "loading" ? "" : "invisible"}`}>
                  Looking up…
                </span>
              </span>
            </button>
            {/* "Looking up…" shows once, in the button; mounted while empty so the result is still announced. */}
            {geo.message && (
              <p
                aria-live="polite"
                className={geo.state === "none" || geo.state === "error" ? errorClass : "text-sm text-[var(--color-ink-500)]"}
              >
                {geo.state === "loading" ? "" : geo.message}
              </p>
            )}
            {values.lat !== "" && values.lng !== "" && geo.state !== "found" && (
              <p className="text-sm text-[var(--color-sage-600)]">Location set.</p>
            )}
            {geo.options.length > 0 && (
              <ul className="space-y-1.5">
                {geo.options.map((m, i) => (
                  <li key={`${m.lat}-${m.lng}-${i}`}>
                    <button
                      type="button"
                      onClick={() => {
                        applyMatch(m);
                        // The list goes away with the pressed match in it: focus goes back to Find location.
                        findLocationRef.current?.focus();
                      }}
                      className={pickerOptionClass}
                    >
                      {m.matchedAddress}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {/* Only when there is no box to sit under (a place is already chosen). */}
        {placeMode === "venue" && values.venueId && placeError}
        <div className="mt-4">
          <TextField
            id="event-venue-name"
            label="Venue name"
            hint="(optional) shown in bold above the address"
            value={values.venueName}
            onChange={(v) => set("venueName", v)}
            max={FIELD_LIMITS.SUGGEST_VENUE_NAME}
            error={errors.venue_name}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="event-description" multiline label="Description (English)" hint="(optional)" value={values.description} onChange={(v) => set("description", v)} max={FIELD_LIMITS.SUGGEST_NOTES} error={errors.description} />
        <TextField id="event-description-es" multiline lang="es" label="Description (Spanish)" value={values.descriptionEs} onChange={(v) => set("descriptionEs", v)} max={FIELD_LIMITS.SUGGEST_NOTES} error={errors.description_es} />
        <TextField id="event-bring" multiline label="What to bring (English)" hint="(optional)" value={values.whatToBring} onChange={(v) => set("whatToBring", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.what_to_bring} />
        <TextField id="event-bring-es" multiline lang="es" label="What to bring (Spanish)" value={values.whatToBringEs} onChange={(v) => set("whatToBringEs", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.what_to_bring_es} />
      </div>

      {/* The link becomes the card's green action button (#882); no link, no button. */}
      <fieldset className={fieldGroupClass}>
        <legend className={`${labelClass} px-1`}>Action button</legend>
        <div className="space-y-4">
          <TextField id="event-link" type="url" label="Link" hint="(optional) starts with https://" value={values.linkUrl} onChange={(v) => set("linkUrl", v)} max={FIELD_LIMITS.SUGGEST_CONTACT} error={errors.link_url} />
          <div>
            <label htmlFor="event-link-label" className={labelClass}>Button says</label>
            <select
              id="event-link-label"
              value={values.linkLabel}
              onChange={(e) => set("linkLabel", e.target.value)}
              aria-invalid={errors.link_label ? "true" : undefined}
              aria-describedby={errors.link_label ? "event-link-label-error" : undefined}
              className={`${inputBase} ${inputBorder(!!errors.link_label)}`}
            >
              {LINK_LABEL_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {errors.link_label && (
              <p id="event-link-label-error" role="alert" className={errorClass}>
                {errors.link_label}
              </p>
            )}
          </div>
          {values.linkLabel === "custom" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField id="event-link-label-custom" label="Button words (English)" required value={values.linkLabelCustom} onChange={(v) => set("linkLabelCustom", v)} max={FIELD_LIMITS.EVENT_LINK_LABEL} error={errors.link_label_custom} />
              <TextField id="event-link-label-custom-es" label="Button words (Spanish)" lang="es" value={values.linkLabelCustomEs} onChange={(v) => set("linkLabelCustomEs", v)} max={FIELD_LIMITS.EVENT_LINK_LABEL} error={errors.link_label_custom_es} />
            </div>
          )}
        </div>
      </fieldset>

      {/* Saves on its own; hands the new `updated_at` up so the next Save doesn't 409 (#760). */}
      <EventFlyerField eventId={eventId} version={version} onVersion={setVersion} initialFlyer={initialFlyer} />

      {/* A cancelled event's note is edited here and saved with Save changes. While cancelling a
          published one, the same fields open in the lower section instead (never both at once: same ids). */}
      {status === "cancelled" && !cancelling && cancelNoteFields}

      {errors._form && (
        <p role="alert" className={errorClass}>
          {errors._form}
        </p>
      )}

      {/* Cancel (a link: saves nothing) then the save buttons. Save draft / Save changes stays the
          form's first type="submit", so Enter in a box saves. */}
      <div className={saveRowClass}>
        {/* The list, where Archive lands too (a save stays on the form). Off while a save runs. */}
        <Link href="/admin/events" className={ADMIN_SECONDARY_BUTTON} {...cancelLinkProps(busy)}>
          Cancel
        </Link>
        {hasPublish ? (
          // WHY 8 px sides (px-2!, important so it wins over the shared
          // px-4) and nowrap: at 360 each of these two is 103 wide, and with
          // 16 px sides "Save draft" broke onto two lines. 87 of room holds it.
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" {...busyButtonProps(busy)} className={`${ADMIN_SECONDARY_BUTTON} w-full whitespace-nowrap px-2!`}>
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button type="button" onClick={() => void send("publish")} {...busyButtonProps(busy)} className={`${ADMIN_PRIMARY_BUTTON} w-full whitespace-nowrap px-2!`}>
              Publish
            </button>
          </div>
        ) : (
          <button type="submit" {...busyButtonProps(busy)} className={`${ADMIN_PRIMARY_BUTTON} w-full`}>
            {busy ? "Saving…" : isEdit && status !== "draft" ? "Save changes" : "Save draft"}
          </button>
        )}
      </div>

      {/* WHY Cancel event lives down here, apart from the save row: it marks the EVENT cancelled,
          and beside Save it would read as "leave this form". */}
      {isEdit && (
        <section aria-labelledby="event-danger-zone" className="space-y-3 border-t border-[var(--color-bone-200)] pt-5">
          <h3 id="event-danger-zone" className={sectionTitleClass}>
            Danger zone
          </h3>
          {/* Kept mounted (hidden) while the step is open, so Keep event can hand focus back. */}
          {status === "published" && (
            <button
              ref={cancelEventRef}
              type="button"
              hidden={cancelling}
              disabled={busy}
              onClick={openCancelStep}
              className={dangerButtonClass}
            >
              Cancel event
            </button>
          )}
          {cancelling && cancelNoteFields}
          <div>
            <button
              ref={archiveRef}
              type="button"
              hidden={askingArchive}
              disabled={busy}
              onClick={() => {
                setArchiveError(null);
                askArchive();
              }}
              className={dangerButtonClass}
            >
              Archive event
            </button>
            {askingArchive && (
              <AdminConfirm
                title="Archive this event?"
                confirmLabel="Archive event"
                busyLabel="Archiving…"
                tone="danger"
                busy={busy}
                error={archiveError}
                onConfirm={() => void archive()}
                onCancel={() => {
                  setArchiveError(null);
                  cancelArchive();
                }}
              >
                It leaves the map and the list of live events, and stays in the admin history.
              </AdminConfirm>
            )}
          </div>
        </section>
      )}
    </form>
  );
}
