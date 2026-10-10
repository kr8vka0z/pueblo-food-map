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
 * with a new address.
 *
 * Status actions: create = Save draft / Publish; edit = Save (+ Publish for a
 * draft, Cancel event for a published one — which reveals the required
 * cancel note) and Archive. The `updated_at` precondition (`expectedUpdatedAt`)
 * is refreshed from each successful save, so consecutive saves don't 409
 * against the admin's own previous save; a real 409 shows the server message
 * and a Reload button, leaving the admin's unsaved edits on screen.
 *
 * Suggest Spanish: one button asks POST /api/admin/events/translate for a
 * machine draft of the Spanish boxes. It fills ONLY boxes that are empty (also
 * re-checked when the answer lands, in case the admin typed meanwhile), so
 * Spanish someone wrote is never overwritten. Nothing is saved by it.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import type { VenueChoice } from "@/lib/adminEventReads";
import type { EventStatus } from "@/lib/adminEventValidation";

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
  linkUrl: string;
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
}

// Keys match the server's error map (adminEventValidation.ts): snake_case field names, `place`, `starts_at`, `ends_at`, `_form`.
type FieldErrors = Record<string, string | undefined>;

interface GeocodeMatch {
  lat: number;
  lng: number;
  matchedAddress: string;
}

const EMPTY: EventFormValues = {
  name: "", nameEs: "", host: "", hostEs: "", description: "", descriptionEs: "",
  whatToBring: "", whatToBringEs: "", cancelNote: "", cancelNoteEs: "",
  startsLocal: "", endsLocal: "", venueId: "", address: "", lat: "", lng: "", linkUrl: "",
};

// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
const inputBase =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
  "bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";
const inputBorder = (hasError: boolean) => (hasError ? "border-[var(--color-danger)]" : "border-[var(--color-bone-300)]");
const errorClass = "mt-1 text-xs text-[var(--color-danger)]";
const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";
const hintClass = "font-normal text-[var(--color-ink-400)]";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-sage-500)] " +
  "px-4 text-sm font-medium text-[var(--color-sage-600)] bg-transparent transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-50)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] px-4 " +
  "text-base font-semibold text-[var(--color-bone-50)] transition-colors duration-150 hover:bg-[var(--color-sage-700)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";
const dangerButtonClass =
  "inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 " +
  "text-sm font-medium text-[var(--color-danger)] bg-transparent transition-colors duration-150 " +
  "hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

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
}

function TextField({ id, label, value, onChange, max, error, required, multiline, lang, hint, type = "text", placeholder }: TextFieldProps) {
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
          <span aria-hidden className="text-[var(--color-danger)]">
            {" "}*
          </span>
        )}
        {hint && <span className={hintClass}> {hint}</span>}
      </label>
      {multiline ? <textarea rows={3} {...common} /> : <input type={type} {...common} />}
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
  return e;
}

export default function EventForm({ venues, eventId, initialValues, status: initialStatus, expectedUpdatedAt, justSaved }: EventFormProps) {
  const router = useRouter();
  const isEdit = eventId !== undefined;
  const [values, setValues] = useState<EventFormValues>({ ...EMPTY, ...initialValues });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; code: string | null } | null>(null);
  const [saved, setSaved] = useState<{ id: string } | null>(justSaved && eventId ? { id: eventId } : null);
  const [status, setStatus] = useState<EventStatus>(initialStatus ?? "draft");
  const [version, setVersion] = useState(expectedUpdatedAt);
  const [cancelling, setCancelling] = useState(false);
  const [suggest, setSuggest] = useState<"idle" | "busy" | "done" | "none" | "full" | "error">("idle");
  const [placeMode, setPlaceMode] = useState<"venue" | "address">(initialValues?.venueId ? "venue" : "address");
  const [venueQuery, setVenueQuery] = useState("");
  const [geo, setGeo] = useState<{ state: "idle" | "loading" | "found" | "none" | "error" | "multiple"; message: string; options: GeocodeMatch[] }>({
    state: "idle",
    message: "",
    options: [],
  });

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => setValues((p) => ({ ...p, [key]: value }));
  const showCancelNote = cancelling || status === "cancelled";
  const pickedVenue = venues.find((x) => x.id === values.venueId);

  function pickVenue(venue: VenueChoice) {
    setValues((p) => ({ ...p, venueId: venue.id, address: venue.address, lat: String(venue.lat), lng: String(venue.lng) }));
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
      link_url: values.linkUrl,
      ...(isEdit ? { expectedUpdatedAt: version } : {}),
    };
    try {
      const res = await fetch(isEdit ? `/api/admin/events/${eventId}` : "/api/admin/events", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 422) {
        setErrors(((await res.json()) as { errors: FieldErrors }).errors);
      } else if (res.status === 200 || res.status === 201) {
        const data = (await res.json()) as { id?: string; status: EventStatus; updated_at: string };
        if (!isEdit && data.id) {
          router.replace(`/admin/events/${data.id}/edit?saved=1`);
          return;
        }
        setStatus(data.status);
        setVersion(data.updated_at);
        setCancelling(false);
        setSaved({ id: eventId as string });
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        setFailure({ message: data?.message ?? "Something went wrong. The event was not saved. Try again.", code: data?.error ?? null });
      }
    } catch {
      setFailure({ message: "Something went wrong. The event was not saved. Try again.", code: null });
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
        for (const [key, , es] of ask) {
          const text = suggestions[`${key}_es`];
          if (typeof text === "string" && !p[es].trim()) next[es] = text;
        }
        return next;
      });
      setSuggest("done");
    } catch {
      setSuggest("error");
    }
  }

  async function archive() {
    if (!window.confirm("Archive this event? It leaves the map and the list of live events, and stays in the admin history.")) return;
    setBusy(true);
    setFailure(null);
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
      setFailure({ message: data?.message ?? "Something went wrong. The event was not archived. Try again.", code: data?.error ?? null });
    } catch {
      setFailure({ message: "Something went wrong. The event was not archived. Try again.", code: null });
    } finally {
      setBusy(false);
    }
  }

  const matches =
    venueQuery.trim().length >= 2
      ? venues.filter((x) => `${x.name} ${x.address}`.toLowerCase().includes(venueQuery.trim().toLowerCase())).slice(0, 8)
      : [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(isEdit ? "save" : "save_draft");
      }}
      noValidate
      className="max-w-2xl space-y-5"
    >
      {saved && (
        <div role="status" className="rounded-[var(--radius-md)] border border-[var(--color-sage-500)] bg-[var(--color-sage-50)] px-4 py-3 text-sm text-[var(--color-sage-700)]">
          <p className="font-medium">Saved.</p>
          <p className="mt-1 flex flex-wrap gap-x-4">
            {/* ?event=<id> deep-links the map to this event; the map ignores it until slice 2 (#758). */}
            <Link href={`/?event=${saved.id}`} className="font-medium underline underline-offset-2">
              View on map
            </Link>
            <Link href="/admin/events" className="font-medium underline underline-offset-2">
              Back to events
            </Link>
          </p>
        </div>
      )}

      {failure && (
        <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-white px-4 py-3">
          <p className="text-sm font-medium text-[var(--color-danger)]">{failure.message}</p>
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
        <button type="button" disabled={suggest === "busy"} aria-busy={suggest === "busy"} onClick={() => void suggestSpanish()} className={secondaryButtonClass}>
          {suggest === "busy" ? "Suggesting…" : "Suggest Spanish"}
        </button>
        <p aria-live="polite" className={`text-sm ${suggest === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-500)]"}`}>
          {suggest === "done" && "Spanish suggested by a machine. Read it before publishing."}
          {suggest === "error" && "The Spanish suggestion could not be made. You can type the Spanish by hand."}
          {suggest === "none" && "Add some English text first, then ask for a Spanish suggestion."}
          {suggest === "full" && "The Spanish boxes are already filled, so nothing was changed."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="event-name" label="Name (English)" required value={values.name} onChange={(v) => set("name", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.name} />
        <TextField id="event-name-es" label="Name (Spanish)" lang="es" value={values.nameEs} onChange={(v) => set("nameEs", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.name_es} />
        <TextField id="event-host" label="Host (English)" hint="who is running it" value={values.host} onChange={(v) => set("host", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.host} />
        <TextField id="event-host-es" label="Host (Spanish)" lang="es" value={values.hostEs} onChange={(v) => set("hostEs", v)} max={FIELD_LIMITS.SUGGEST_VENUE_NAME} error={errors.host_es} />
      </div>

      {/* Start / end — Pueblo time, converted to UTC by the server. */}
      <fieldset className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] p-4">
        <legend className={`${labelClass} px-1`}>
          When <span className={hintClass}>(Pueblo time, Mountain Time)</span>
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="event-starts" type="datetime-local" label="Starts" required value={values.startsLocal} onChange={(v) => set("startsLocal", v)} max={0} error={errors.starts_at} />
          <TextField id="event-ends" type="datetime-local" label="Ends" required value={values.endsLocal} onChange={(v) => set("endsLocal", v)} max={0} error={errors.ends_at} />
        </div>
      </fieldset>

      {/* Place — pick an existing venue, or type an address and find its location. */}
      <fieldset className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] p-4">
        <legend className={`${labelClass} px-1`}>
          Where <span aria-hidden className="text-[var(--color-danger)]">*</span>
        </legend>
        <div className="mb-3 flex flex-wrap gap-4 text-sm text-[var(--color-ink-700)]">
          <label className="flex min-h-11 cursor-pointer items-center gap-2">
            <input type="radio" name="place-mode" checked={placeMode === "venue"} onChange={() => { setPlaceMode("venue"); clearPlace(); }} />
            A place already on the map
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2">
            <input type="radio" name="place-mode" checked={placeMode === "address"} onChange={() => { setPlaceMode("address"); clearPlace(); }} />
            A different address
          </label>
        </div>

        {placeMode === "venue" ? (
          <div>
            {values.venueId ? (
              <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white p-3">
                <p className="text-sm text-[var(--color-ink-700)]">
                  <span className="font-medium text-[var(--color-ink-900)]">{pickedVenue?.name ?? "Selected place"}</span>
                  <br />
                  {values.address}
                </p>
                <button type="button" onClick={clearPlace} className={secondaryButtonClass}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <label htmlFor="event-venue-search" className={labelClass}>
                  Search places by name or address
                </label>
                <input
                  id="event-venue-search"
                  type="text"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  aria-invalid={errors.place ? "true" : undefined}
                  aria-describedby={errors.place ? "event-place-error" : undefined}
                  className={`${inputBase} ${inputBorder(!!errors.place)}`}
                />
                {matches.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => pickVenue(m)}
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-left text-sm text-[var(--color-ink-700)] hover:border-[var(--color-sage-500)] hover:bg-[var(--color-sage-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
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
            </div>
            <button type="button" onClick={() => void findLocation()} disabled={!values.address.trim() || geo.state === "loading"} className={secondaryButtonClass}>
              {geo.state === "loading" ? "Looking up…" : "Find location from address"}
            </button>
            {geo.message && (
              <p aria-live="polite" className="text-sm text-[var(--color-ink-500)]">{geo.message}</p>
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
                      onClick={() => applyMatch(m)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-left text-sm text-[var(--color-ink-700)] hover:border-[var(--color-sage-500)] hover:bg-[var(--color-sage-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                    >
                      {m.matchedAddress}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {errors.place && (
          <p id="event-place-error" role="alert" className={errorClass}>
            {errors.place}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="event-description" multiline label="Description (English)" value={values.description} onChange={(v) => set("description", v)} max={FIELD_LIMITS.SUGGEST_NOTES} error={errors.description} />
        <TextField id="event-description-es" multiline lang="es" label="Description (Spanish)" value={values.descriptionEs} onChange={(v) => set("descriptionEs", v)} max={FIELD_LIMITS.SUGGEST_NOTES} error={errors.description_es} />
        <TextField id="event-bring" multiline label="What to bring (English)" value={values.whatToBring} onChange={(v) => set("whatToBring", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.what_to_bring} />
        <TextField id="event-bring-es" multiline lang="es" label="What to bring (Spanish)" value={values.whatToBringEs} onChange={(v) => set("whatToBringEs", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.what_to_bring_es} />
      </div>

      <TextField id="event-link" type="url" label="Link" hint="optional, starts with https://" value={values.linkUrl} onChange={(v) => set("linkUrl", v)} max={FIELD_LIMITS.SUGGEST_CONTACT} error={errors.link_url} />

      {showCancelNote && (
        <fieldset className="rounded-[var(--radius-lg)] border border-[var(--color-clay-500)] p-4">
          <legend className={`${labelClass} px-1`}>Cancellation note</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField id="event-cancel-note" multiline required label="Note (English)" value={values.cancelNote} onChange={(v) => set("cancelNote", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.cancel_note} />
            <TextField id="event-cancel-note-es" multiline lang="es" label="Note (Spanish)" value={values.cancelNoteEs} onChange={(v) => set("cancelNoteEs", v)} max={FIELD_LIMITS.EVENT_SHORT_TEXT} error={errors.cancel_note_es} />
          </div>
          {cancelling && (
            <button type="button" disabled={busy} onClick={() => void send("cancel")} className={`mt-3 ${dangerButtonClass}`}>
              {busy ? "Cancelling…" : "Confirm cancel event"}
            </button>
          )}
        </fieldset>
      )}

      {errors._form && (
        <p role="alert" className={errorClass}>
          {errors._form}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {!isEdit && (
          <>
            <button type="submit" disabled={busy} className={secondaryButtonClass}>
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button type="button" disabled={busy} onClick={() => void send("publish")} className={primaryButtonClass}>
              Publish
            </button>
          </>
        )}
        {isEdit && (
          <>
            <button type="submit" disabled={busy} className={status === "draft" ? secondaryButtonClass : primaryButtonClass}>
              {busy ? "Saving…" : status === "draft" ? "Save draft" : "Save changes"}
            </button>
            {status === "draft" && (
              <button type="button" disabled={busy} onClick={() => void send("publish")} className={primaryButtonClass}>
                Publish
              </button>
            )}
            {status === "published" && !cancelling && (
              <button type="button" disabled={busy} onClick={() => setCancelling(true)} className={dangerButtonClass}>
                Cancel event
              </button>
            )}
          </>
        )}
        <Link href="/admin/events" className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2">
          Back to events
        </Link>
      </div>

      {isEdit && (
        <div className="border-t border-[var(--color-bone-200)] pt-5">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink-700)]">Danger zone</h3>
          <button type="button" disabled={busy} onClick={() => void archive()} className={dangerButtonClass}>
            Archive event
          </button>
        </div>
      )}
    </form>
  );
}
