"use client";

/**
 * AddVenueForm — client component for the admin "Add a venue" / "Edit a
 * venue" form (#254 create; edit mode added #255).
 *
 * Presentational + self-contained: owns all field state, client-side
 * validation, and the fetch call to the venues API. No auth/D1 in scope
 * here — the Cloudflare Access gate lives in the parent Server Component
 * (src/app/admin/venues/new/page.tsx or .../[id]/edit/page.tsx, same
 * pattern as AGENTS.md "Admin authentication"). This mirrors SuggestForm.tsx's
 * own form/route split; this component imitates SuggestForm's
 * input/label/error token classes (bone borders, sage focus rings) directly
 * rather than importing them — no shared form-component library exists
 * between the public and admin surfaces, so each form owns its own copy,
 * same as SuggestForm already does.
 *
 * ONE component serves both modes (#255 explicitly asked for this, not a
 * forked near-identical form) — create and edit submit the identical field
 * set and share every validation rule, so the only real difference is which
 * endpoint/method to call and what to say on the button. The optional
 * `venueId` prop is the mode switch: absent -> POST /api/admin/venues
 * (create); present -> PATCH /api/admin/venues/<venueId> (edit). Both modes
 * share the same success handling: redirect to /admin + router.refresh() so
 * the Server Component's venues query re-runs and the change is visible
 * immediately. `initialValues` (pre-#255) already covered pre-filling the
 * form; edit mode is just that same prop combined with `venueId`, wired by
 * the edit page (src/app/admin/venues/[id]/edit/page.tsx) via
 * src/lib/adminVenueForm.ts's mapVenueRowToFormValues().
 *
 * #259: an optional `submissionId` prop (create mode only) rides along in
 * the POST body so the create route can approve the originating
 * `public_submissions` row atomically with the venue insert — wired by
 * src/app/admin/venues/new/page.tsx when opened as `?submission=<id>`, with
 * initialValues supplied by src/lib/adminVenueForm.ts's
 * mapSubmissionPayloadToFormValues(). On success that path redirects back
 * to /admin/submissions instead of /admin, so the admin lands back on the
 * queue rather than the plain venue list.
 *
 * #390: an optional `proposalId` prop (EDIT mode only — the mirror image of
 * `submissionId` above, which is create-mode-only) rides along in the
 * PATCH body so the edit route can approve the originating `change_proposals`
 * row (source='link_health') atomically with the venue update — wired by
 * src/app/admin/venues/[id]/edit/page.tsx when opened as `?proposal=<id>`.
 * On success that path redirects back to /admin/flags instead of /admin.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { DISPLAY_DAY_KEYS, type DayKey } from "@/lib/hours";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import type { IrregularSchedule, VenueCategory, WeeklyHours } from "@/types/venue";

// ─── Types ──────────────────────────────────────────────────────────────────

type TriStateValue = "" | "1" | "0";
type HoursDraft = Record<DayKey, string>;

/**
 * One editable row of the "Monthly / irregular schedule" fieldset (#400).
 * Every field is a plain string/select value (form-draft shape, same
 * "loose strings, validated server-side" convention HoursDraft already
 * uses above) — buildHoursIrregular() below converts a list of these into
 * the IrregularSchedule[] the POST/PATCH body sends. `recurrence` starts
 * blank (not defaulted to "monthly_ordinal") so an admin must actively
 * pick a kind rather than silently submitting a half-filled ordinal row.
 */
export interface IrregularEntryDraft {
  recurrence: "" | IrregularSchedule["recurrence"];
  ordinal: "" | "1" | "2" | "3" | "4" | "5" | "last";
  weekday: "" | DayKey;
  dayOfMonth: string;
  /** Comma-separated time ranges — same convention as HoursDraft's per-day field. */
  slots: string;
  note: string;
}

/**
 * Shape returned by GET /api/admin/geocode (src/app/api/admin/geocode/route.ts).
 * Declared locally rather than imported from the route module — same
 * client/server duplication this file already uses for EMAIL_RE below,
 * since the route's own validation is the authoritative trust boundary and
 * this copy only needs to describe an already-trusted response.
 */
interface GeocodeMatch {
  lat: number;
  lng: number;
  matchedAddress: string;
}

type GeocodeStatus = "idle" | "loading" | "found" | "no-match" | "multiple" | "error";

export interface AddVenueFormValues {
  name: string;
  category: VenueCategory | "";
  address: string;
  lastVerified: string;
  lat: string;
  lng: string;
  hours: HoursDraft;
  /** Non-weekly (monthly-ordinal etc.) schedules (#400) — always ALONGSIDE `hours`, never a replacement. */
  hoursIrregular: IrregularEntryDraft[];
  acceptsSnap: TriStateValue;
  acceptsWic: TriStateValue;
  phone: string;
  email: string;
  url: string;
  operator: string;
  notes: string;
  source: string;
  outsideCounty: boolean;
  // Blessing-box-only fields (blessing_boxes table, migrations/0005) — only
  // ever read/sent when category === "blessing_box"; see handleSubmit.
  hostName: string;
  hostNote: string;
  hostContact: string;
  mostNeeded: string;
  installedOn: string;
  removedOn: string;
}

export interface AddVenueFormProps {
  /**
   * Optional initial field values. The form is otherwise fully
   * self-contained (owns its own state, fetch call, and redirect) — this
   * prop exists so a parent can render it pre-filled with sample data
   * (e.g. for a screenshot preview) without reaching into internal state.
   * Every key is optional; anything omitted falls back to the normal
   * empty/default value.
   */
  initialValues?: Partial<AddVenueFormValues>;
  /**
   * The mode switch (#255): omitted -> create mode (POST /api/admin/venues,
   * "Add venue" button). Present -> edit mode (PATCH
   * /api/admin/venues/<venueId>, "Save changes" button). The edit page
   * always passes both this AND `initialValues` (the existing row); this
   * component does not fetch the row itself.
   */
  venueId?: string;
  /**
   * The `public_submissions` row id this create was reached FROM (#259):
   * set only when /admin/venues/new was opened via a review-queue
   * "Approve" link (?submission=<id>), never by the plain "Add place" flow.
   * Meaningful only in CREATE mode — ignored entirely in edit mode, since a
   * submission is only ever approved into a brand-new venue, never onto an
   * edit of an existing one. Threaded straight through to the POST body so
   * POST /api/admin/venues can flip that submission to `status='approved'`
   * in the SAME atomic batch as the venue insert (see that route's header).
   */
  submissionId?: number;
  /**
   * The `change_proposals` row id this edit was reached FROM (#390): set
   * only when /admin/venues/<id>/edit was opened via the flags queue's
   * link_health "Review & fix link" hand-off (?proposal=<id>). Meaningful
   * only in EDIT mode — ignored in create mode, mirror image of
   * `submissionId` above. Threaded straight through to the PATCH body so
   * PATCH /api/admin/venues/<id> can flip that proposal to
   * `status='approved'` in the SAME atomic batch as the venue update.
   */
  proposalId?: number;
}

type FieldErrorKey =
  | "name"
  | "category"
  | "address"
  | "last_verified"
  | "lat"
  | "lng"
  | "source"
  | "hours_weekly"
  | "hours_irregular"
  | "accepts_snap"
  | "accepts_wic"
  | "phone"
  | "email"
  | "url"
  | "operator"
  | "notes"
  | "outside_county"
  | "host_name"
  | "host_note"
  | "host_contact"
  | "most_needed"
  | "installed_on"
  | "removed_on";

type FieldErrors = Partial<Record<FieldErrorKey, string>>;

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// Locally scoped, not shared with src/lib/adminVenueValidation.ts (the
// server's authoritative check) — same split SuggestForm.tsx already uses
// against its own submit route's validate(). Client validation exists only
// to give fast inline feedback before a round trip; the server re-checks
// everything regardless.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyHoursDraft(): HoursDraft {
  const draft = {} as HoursDraft;
  for (const day of DISPLAY_DAY_KEYS) draft[day] = "";
  return draft;
}

// UTC, not local time: last_verified is stored and displayed elsewhere
// (src/lib/adminVenues.ts's formatLastVerified) as a UTC-interpreted
// date-only string — defaulting "today" to the host's local date would
// disagree with how that same string renders everywhere else in the admin
// on a negative-UTC-offset host (e.g. Kyle's Mountain-time laptop near
// midnight).
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultValues(initialValues?: Partial<AddVenueFormValues>): AddVenueFormValues {
  return {
    name: "",
    category: "",
    address: "",
    lastVerified: todayIsoDate(),
    lat: "",
    lng: "",
    hours: emptyHoursDraft(),
    hoursIrregular: [],
    acceptsSnap: "",
    acceptsWic: "",
    phone: "",
    email: "",
    url: "",
    operator: "",
    notes: "",
    source: "Manual entry",
    outsideCounty: false,
    hostName: "",
    hostNote: "",
    hostContact: "",
    mostNeeded: "",
    installedOn: "",
    removedOn: "",
    ...initialValues,
  };
}

/** Comma-separated free text per day -> the WeeklyHours JSON shape, or undefined if every day is blank. */
function buildHoursWeekly(hours: HoursDraft): WeeklyHours | undefined {
  const result: WeeklyHours = {};
  for (const day of DISPLAY_DAY_KEYS) {
    const slots = hours[day]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (slots.length > 0) result[day] = slots;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function emptyIrregularDraft(): IrregularEntryDraft {
  return { recurrence: "", ordinal: "", weekday: "", dayOfMonth: "", slots: "", note: "" };
}

/**
 * IrregularEntryDraft[] -> IrregularSchedule[], or undefined if every row is
 * incomplete/blank. Incomplete rows (a recurrence picked but a required
 * field left blank) are silently skipped, not surfaced as a client error —
 * same "server is the authoritative trust boundary" split this form's own
 * header documents for validateClient() vs. adminVenueValidation.ts; a
 * half-filled row here just doesn't make it into the payload, and the
 * server's own `errors.hours_irregular` message (rendered below the
 * fieldset) covers any shape it still rejects.
 */
function buildHoursIrregular(drafts: IrregularEntryDraft[]): IrregularSchedule[] | undefined {
  const result: IrregularSchedule[] = [];
  for (const d of drafts) {
    const slots = d.slots
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const note = d.note.trim();

    if (d.recurrence === "monthly_ordinal") {
      if (!d.weekday || !d.ordinal || slots.length === 0) continue;
      const ordinal = d.ordinal === "last" ? "last" : (Number(d.ordinal) as 1 | 2 | 3 | 4 | 5);
      result.push({
        recurrence: "monthly_ordinal",
        ordinal,
        weekday: d.weekday,
        slots,
        ...(note ? { note } : {}),
      });
    } else if (d.recurrence === "monthly_date") {
      const dayOfMonth = Number(d.dayOfMonth);
      if (!dayOfMonth || slots.length === 0) continue;
      result.push({ recurrence: "monthly_date", day_of_month: dayOfMonth, slots, ...(note ? { note } : {}) });
    } else if (d.recurrence === "other") {
      if (!note) continue;
      result.push({ recurrence: "other", slots, note });
    }
    // d.recurrence === "" (no kind picked yet) — skipped, same as above.
  }
  return result.length > 0 ? result : undefined;
}

function validateClient(values: AddVenueFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (!values.category) errors.category = "Select a category.";
  if (!values.address.trim()) errors.address = "Address is required.";
  if (!values.lastVerified.trim()) errors.last_verified = "Enter a valid date.";

  const lat = Number(values.lat);
  if (values.lat.trim() === "" || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.lat = "Latitude must be a number between -90 and 90.";
  }
  const lng = Number(values.lng);
  if (values.lng.trim() === "" || Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.lng = "Longitude must be a number between -180 and 180.";
  }
  if (!values.source.trim()) errors.source = "Source is required.";
  if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddVenueForm({ initialValues, venueId, submissionId, proposalId }: AddVenueFormProps) {
  const router = useRouter();
  const isEditMode = venueId !== undefined;
  const [values, setValues] = useState<AddVenueFormValues>(() => defaultValues(initialValues));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  // #568 item 1: a 409 (edit refused — the venue is archived,
  // PATCH /api/admin/venues/[id]) carries a real, specific `message` the
  // admin needs to see — the generic "Something went wrong, try again"
  // below is actively misleading here, since retrying can never succeed.
  // null for every other error path, which keeps that generic copy.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeStatus>("idle");
  const [geocodeMessage, setGeocodeMessage] = useState("");
  const [geocodeCandidates, setGeocodeCandidates] = useState<GeocodeMatch[]>([]);

  function setField<K extends keyof AddVenueFormValues>(key: K, value: AddVenueFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setHourDay(day: DayKey, value: string) {
    setValues((prev) => ({ ...prev, hours: { ...prev.hours, [day]: value } }));
  }

  // ── Irregular schedule row editing (#400) ────────────────────────────────
  function addIrregularRow() {
    setValues((prev) => ({ ...prev, hoursIrregular: [...prev.hoursIrregular, emptyIrregularDraft()] }));
  }
  function removeIrregularRow(index: number) {
    setValues((prev) => ({ ...prev, hoursIrregular: prev.hoursIrregular.filter((_, i) => i !== index) }));
  }
  function setIrregularField<K extends keyof IrregularEntryDraft>(
    index: number,
    key: K,
    value: IrregularEntryDraft[K],
  ) {
    setValues((prev) => ({
      ...prev,
      hoursIrregular: prev.hoursIrregular.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  }

  /** Sets lat/lng from a chosen geocode match and clears any stale lat/lng field errors. */
  function applyGeocodeMatch(match: GeocodeMatch) {
    setValues((prev) => ({ ...prev, lat: String(match.lat), lng: String(match.lng) }));
    setErrors((prev) => {
      if (!prev.lat && !prev.lng) return prev;
      const next = { ...prev };
      delete next.lat;
      delete next.lng;
      return next;
    });
    setGeocodeCandidates([]);
    setGeocodeStatus("found");
    setGeocodeMessage(`Found: ${match.matchedAddress}`);
  }

  /**
   * Calls GET /api/admin/geocode with the current address field. Every
   * branch (0 matches, many matches, non-200, network failure) degrades to
   * an inline message rather than throwing — the lat/lng inputs stay
   * editable regardless, so a lookup failure never blocks adding a venue.
   */
  async function handleGeocode() {
    const q = values.address.trim();
    if (!q) return;

    setGeocodeStatus("loading");
    setGeocodeMessage("Looking up…");
    setGeocodeCandidates([]);

    try {
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
      if (res.status !== 200) {
        setGeocodeStatus("error");
        setGeocodeMessage("Location lookup is unavailable right now — enter coordinates below.");
        return;
      }
      const data = (await res.json()) as { matches: GeocodeMatch[] };

      if (data.matches.length === 0) {
        setGeocodeStatus("no-match");
        setGeocodeMessage("No match found — check the address or enter coordinates below.");
      } else if (data.matches.length === 1) {
        applyGeocodeMatch(data.matches[0]);
      } else {
        setGeocodeStatus("multiple");
        setGeocodeCandidates(data.matches);
        setGeocodeMessage(`Found ${data.matches.length} possible matches — choose one below.`);
      }
    } catch {
      setGeocodeStatus("error");
      setGeocodeMessage("Location lookup is unavailable right now — enter coordinates below.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const clientErrors = validateClient(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setErrors({});
    setErrorMessage(null);
    setStatus("submitting");

    const body = {
      name: values.name.trim(),
      category: values.category,
      lat: Number(values.lat),
      lng: Number(values.lng),
      address: values.address.trim(),
      source: values.source.trim(),
      last_verified: values.lastVerified,
      hours_weekly: buildHoursWeekly(values.hours),
      hours_irregular: buildHoursIrregular(values.hoursIrregular),
      accepts_snap: values.acceptsSnap === "" ? null : Number(values.acceptsSnap),
      accepts_wic: values.acceptsWic === "" ? null : Number(values.acceptsWic),
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      url: values.url.trim() || undefined,
      operator: values.operator.trim() || undefined,
      notes: values.notes.trim() || undefined,
      outside_county: values.outsideCounty ? 1 : 0,
      // Blessing-box-only fields: only sent when the admin picked that
      // category — the server (validateBoxFields, src/lib/adminVenueValidation.ts)
      // ignores these keys entirely for every other category anyway, but
      // omitting them here keeps an ordinary venue's request body identical
      // to what it was before this feature existed.
      ...(values.category === "blessing_box"
        ? {
            host_name: values.hostName.trim() || undefined,
            host_note: values.hostNote.trim() || undefined,
            host_contact: values.hostContact.trim() || undefined,
            most_needed: values.mostNeeded.trim() || undefined,
            installed_on: values.installedOn || undefined,
            removed_on: values.removedOn || undefined,
          }
        : {}),
      // #259: only ever sent on a fresh create reached from the review
      // queue — never in edit mode (submissionId is meaningless there; see
      // this prop's own doc comment above).
      ...(!isEditMode && submissionId != null ? { submissionId } : {}),
      // #390: mirror image — only ever sent on an edit reached from the
      // flags queue's link_health hand-off.
      ...(isEditMode && proposalId != null ? { proposalId } : {}),
    };

    // Create POSTs /api/admin/venues (201 on success); edit PATCHes
    // /api/admin/venues/<venueId> (200 on success) — see this component's
    // header for why one function/component covers both instead of two
    // near-identical submit paths.
    const endpoint = isEditMode ? `/api/admin/venues/${venueId}` : "/api/admin/venues";
    const method = isEditMode ? "PATCH" : "POST";
    const successStatus = isEditMode ? 200 : 201;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === successStatus) {
        // #259/#390: a create that approved a submission returns to the
        // review queue; an edit that approved a proposal returns to the
        // flags queue — so the admin picks up the next pending card in
        // either case, rather than the plain venue list. Default target is
        // /admin/places (moved from /admin, admin dashboard build — /admin
        // is now the Dashboard, a different screen; a venue-edit flow
        // should land back on the venue list, not the to-do list).
        let redirectTo = "/admin/places";
        if (!isEditMode && submissionId != null) redirectTo = "/admin/submissions";
        else if (isEditMode && proposalId != null) redirectTo = "/admin/flags";
        router.push(redirectTo);
        router.refresh();
        return;
      }

      if (res.status === 422) {
        const data = (await res.json()) as { errors: FieldErrors };
        setErrors(data.errors);
        setStatus("idle");
        return;
      }

      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setErrorMessage(data?.message ?? "This venue can't be edited right now.");
        setStatus("error");
        return;
      }

      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  // text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
  const inputBase =
    "w-full rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
    // #534: --color-ink-300 undefined — DESIGN.md documents ink-400 as the
    // placeholder-text token.
    "bg-white placeholder:text-[var(--color-ink-400)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
    "focus-visible:border-[var(--color-sage-500)]";
  const inputBorder = (hasError: boolean) =>
    hasError ? "border-red-500" : "border-[var(--color-bone-300)]";
  const errorClass = "mt-1 text-xs text-red-600";
  const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";
  // Secondary (bordered, sage-text) action — visually lower weight than the
  // primary sage-filled submit button below, but still sage per DESIGN.md
  // ("use sage for every interactive affordance"), not the ink-toned
  // secondary style ReportVenueButton.tsx uses for its lower-stakes action.
  const secondaryButtonClass =
    "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-sage-500)] " +
    "px-3 py-1.5 text-sm font-medium text-[var(--color-sage-600)] bg-transparent " +
    "transition-colors duration-150 hover:bg-[var(--color-sage-50)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";
  // Informational-emphasis tones per DESIGN.md's Do's/Don'ts: sage for a calm
  // positive confirmation (same hue as the "Show details" / operator-link
  // convention), clay for "didn't work, here's guidance" (the same role clay
  // already plays in LocationDeniedBanner/VenueListView) — never red, since
  // these never block submission the way a field validation error does.
  const geocodeToneClass: Record<GeocodeStatus, string> = {
    idle: "",
    loading: "text-[var(--color-ink-500)]",
    found: "text-[var(--color-sage-600)]",
    "no-match": "text-[var(--color-clay-700)]",
    multiple: "text-[var(--color-ink-500)]",
    error: "text-[var(--color-clay-700)]",
  };
  const requiredMark = (
    <span aria-hidden className="text-red-500">
      {" "}
      *
    </span>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-5">
      {status === "error" && (
        <div role="alert" className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3">
          {errorMessage ? (
            <p className="text-sm font-medium text-red-700">{errorMessage}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-red-700">Something went wrong.</p>
              <p className="text-sm text-red-600 mt-0.5">The venue was not saved. Try again.</p>
            </>
          )}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="venue-name" className={labelClass}>
          Name{requiredMark}
        </label>
        <input
          type="text"
          id="venue-name"
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          maxLength={FIELD_LIMITS.SUGGEST_VENUE_NAME}
          aria-required="true"
          aria-invalid={errors.name ? "true" : undefined}
          aria-describedby={errors.name ? "venue-name-error" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.name)}`}
        />
        {errors.name && (
          <p id="venue-name-error" role="alert" className={errorClass}>
            {errors.name}
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="venue-category" className={labelClass}>
          Category{requiredMark}
        </label>
        <select
          id="venue-category"
          value={values.category}
          onChange={(e) => setField("category", e.target.value as VenueCategory | "")}
          aria-required="true"
          aria-invalid={errors.category ? "true" : undefined}
          aria-describedby={errors.category ? "venue-category-error" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.category)}`}
        >
          <option value="">Select a category</option>
          {(Object.keys(categoryLabels) as VenueCategory[]).map((key) => (
            <option key={key} value={key}>
              {categoryLabels[key]}
            </option>
          ))}
        </select>
        {errors.category && (
          <p id="venue-category-error" role="alert" className={errorClass}>
            {errors.category}
          </p>
        )}
      </div>

      {/* Blessing box details — only when this venue IS a blessing box
          (Blessing Boxes slice 1). Every field optional, matching the build
          plan's admin story ("expose the box-only fields") with no stated
          required-ness. */}
      {values.category === "blessing_box" && (
        <fieldset className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] p-4">
          <legend className={labelClass.replace("mb-1", "px-1")}>Blessing box details</legend>

          <div>
            <label htmlFor="box-host-name" className={labelClass}>
              Host name
            </label>
            <input
              type="text"
              id="box-host-name"
              value={values.hostName}
              onChange={(e) => setField("hostName", e.target.value)}
              placeholder="e.g. First Baptist Church"
              maxLength={FIELD_LIMITS.SUGGEST_VENUE_NAME}
              className={`${inputBase} border-[var(--color-bone-300)]`}
            />
          </div>

          <div>
            <label htmlFor="box-host-note" className={labelClass}>
              Public note from the host
            </label>
            <textarea
              id="box-host-note"
              rows={2}
              value={values.hostNote}
              onChange={(e) => setField("hostNote", e.target.value)}
              placeholder="Shown on the box's public page"
              maxLength={FIELD_LIMITS.BOX_ADOPTER_NOTE}
              className={`${inputBase} border-[var(--color-bone-300)] resize-y min-h-[56px]`}
            />
          </div>

          <div>
            <label htmlFor="box-host-contact" className={labelClass}>
              Host contact{" "}
              <span className="font-normal text-[var(--color-ink-400)]">(private — never shown publicly)</span>
            </label>
            <input
              type="text"
              id="box-host-contact"
              value={values.hostContact}
              onChange={(e) => setField("hostContact", e.target.value)}
              placeholder="Phone or email, for admin use only"
              maxLength={FIELD_LIMITS.SUGGEST_CONTACT}
              className={`${inputBase} border-[var(--color-bone-300)]`}
            />
          </div>

          <div>
            <label htmlFor="box-most-needed" className={labelClass}>
              Most needed
            </label>
            <input
              type="text"
              id="box-most-needed"
              value={values.mostNeeded}
              onChange={(e) => setField("mostNeeded", e.target.value)}
              placeholder="e.g. canned protein, diapers, no glass"
              maxLength={FIELD_LIMITS.BOX_CHECKIN_NOTE}
              className={`${inputBase} border-[var(--color-bone-300)]`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="box-installed-on" className={labelClass}>
                Installed on
              </label>
              <input
                type="date"
                id="box-installed-on"
                value={values.installedOn}
                onChange={(e) => setField("installedOn", e.target.value)}
                className={`${inputBase} border-[var(--color-bone-300)]`}
              />
            </div>
            <div>
              <label htmlFor="box-removed-on" className={labelClass}>
                Removed on
              </label>
              <input
                type="date"
                id="box-removed-on"
                value={values.removedOn}
                onChange={(e) => setField("removedOn", e.target.value)}
                className={`${inputBase} border-[var(--color-bone-300)]`}
              />
            </div>
          </div>
        </fieldset>
      )}

      {/* Address */}
      <div>
        <label htmlFor="venue-address" className={labelClass}>
          Address{requiredMark}
        </label>
        <input
          type="text"
          id="venue-address"
          value={values.address}
          onChange={(e) => setField("address", e.target.value)}
          maxLength={FIELD_LIMITS.SUGGEST_ADDRESS}
          aria-required="true"
          aria-invalid={errors.address ? "true" : undefined}
          aria-describedby={errors.address ? "venue-address-error" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.address)}`}
        />
        {errors.address && (
          <p id="venue-address-error" role="alert" className={errorClass}>
            {errors.address}
          </p>
        )}
      </div>

      {/* Find location from address (US Census geocoder — see
          src/app/api/admin/geocode/route.ts for why Census, not Mapbox) */}
      <div>
        <button
          type="button"
          onClick={handleGeocode}
          disabled={!values.address.trim() || geocodeStatus === "loading"}
          className={secondaryButtonClass}
        >
          {geocodeStatus === "loading" ? "Looking up…" : "Find location from address"}
        </button>
        {geocodeMessage && (
          <p aria-live="polite" className={`mt-2 text-sm ${geocodeToneClass[geocodeStatus]}`}>
            {geocodeMessage}
          </p>
        )}
        {geocodeCandidates.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p id="geocode-candidates-label" className="text-xs font-medium text-[var(--color-ink-500)]">
              Choose the correct address:
            </p>
            <ul aria-labelledby="geocode-candidates-label" className="space-y-1.5">
              {geocodeCandidates.map((match, i) => (
                <li key={`${match.lat}-${match.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => applyGeocodeMatch(match)}
                    className={
                      "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
                      "px-3 py-2 text-left text-sm text-[var(--color-ink-700)] " +
                      "transition-colors duration-150 hover:bg-[var(--color-sage-50)] hover:border-[var(--color-sage-500)] " +
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                    }
                  >
                    {match.matchedAddress}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Last verified */}
      <div>
        <label htmlFor="venue-last-verified" className={labelClass}>
          Last verified{requiredMark}
        </label>
        <input
          type="date"
          id="venue-last-verified"
          value={values.lastVerified}
          onChange={(e) => setField("lastVerified", e.target.value)}
          aria-required="true"
          aria-invalid={errors.last_verified ? "true" : undefined}
          aria-describedby={errors.last_verified ? "venue-last-verified-error" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.last_verified)}`}
        />
        {errors.last_verified && (
          <p id="venue-last-verified-error" role="alert" className={errorClass}>
            {errors.last_verified}
          </p>
        )}
      </div>

      {/* Latitude / Longitude */}
      {/* ponytail: number inputs, auto-fillable via "Find location from
          address" above but still hand-editable — the precise source of
          truth and the fallback when geocoding finds no match or is down.
          A map-click picker (drop a pin, read lat/lng from the click) is
          the next upgrade if geocoding ever proves too imprecise (e.g. a
          venue set back from its mailing address); no ceiling here beyond
          that remaining UX gap. */}
      {/* WHY these stay type="number" rather than the usual mobile-friendly
          type="text" + inputMode="decimal" swap: every longitude in Pueblo
          County is NEGATIVE (~-104.6), and inputMode="decimal" renders a
          keypad of digits and a decimal separator with no minus key, which
          would make longitude unenterable on a phone — the opposite of the
          intended fix. type="number" keeps a numeric keyboard that still
          offers a sign. The one genuine hazard of type="number" is that a
          wheel scroll over a FOCUSED field silently edits its value, and
          these two write straight to the public map's coordinates, so the
          onWheel handlers below blur the field instead. If this is ever
          revisited, verify the minus key on a real iPhone first. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="venue-lat" className={labelClass}>
            Latitude{requiredMark}
          </label>
          <input
            type="number"
            id="venue-lat"
            step="any"
            value={values.lat}
            onChange={(e) => setField("lat", e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            aria-required="true"
            aria-invalid={errors.lat ? "true" : undefined}
            aria-describedby={errors.lat ? "venue-lat-error" : undefined}
            className={`${inputBase} ${inputBorder(!!errors.lat)}`}
          />
          {errors.lat && (
            <p id="venue-lat-error" role="alert" className={errorClass}>
              {errors.lat}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="venue-lng" className={labelClass}>
            Longitude{requiredMark}
          </label>
          <input
            type="number"
            id="venue-lng"
            step="any"
            value={values.lng}
            onChange={(e) => setField("lng", e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            aria-required="true"
            aria-invalid={errors.lng ? "true" : undefined}
            aria-describedby={errors.lng ? "venue-lng-error" : undefined}
            className={`${inputBase} ${inputBorder(!!errors.lng)}`}
          />
          {errors.lng && (
            <p id="venue-lng-error" role="alert" className={errorClass}>
              {errors.lng}
            </p>
          )}
        </div>
      </div>

      {/* Hours — basic per-day text, not a scheduler (kept lean per #254) */}
      <fieldset className="space-y-2">
        <legend className={labelClass.replace("mb-1", "mb-2")}>
          Hours <span className="font-normal text-[var(--color-ink-400)]">(optional)</span>
        </legend>
        <p className="text-xs text-[var(--color-ink-400)] mb-2">
          Comma-separated time ranges per day, e.g. &quot;9:00-17:00&quot;. Leave a day blank if closed or unknown.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DISPLAY_DAY_KEYS.map((day) => (
            <div key={day}>
              <label htmlFor={`venue-hours-${day}`} className="block text-xs text-[var(--color-ink-500)] mb-1">
                {DAY_LABELS[day]}
              </label>
              <input
                type="text"
                id={`venue-hours-${day}`}
                value={values.hours[day]}
                onChange={(e) => setHourDay(day, e.target.value)}
                placeholder="9:00-17:00"
                className={`${inputBase} border-[var(--color-bone-300)]`}
              />
            </div>
          ))}
        </div>
        {errors.hours_weekly && (
          <p role="alert" className={errorClass}>
            {errors.hours_weekly}
          </p>
        )}
      </fieldset>

      {/* Monthly / irregular schedule (#400) — kept lean per the weekly
          fieldset's own precedent above: a repeatable row of plain
          selects/inputs, not a calendar picker. Stored ALONGSIDE hours_weekly,
          never replacing it — a venue (e.g. Lynn Gardens Baptist Church) can
          have both. */}
      <fieldset className="space-y-3">
        <legend className={labelClass.replace("mb-1", "mb-2")}>
          Monthly schedule <span className="font-normal text-[var(--color-ink-400)]">(optional)</span>
        </legend>
        <p className="text-xs text-[var(--color-ink-400)] mb-2">
          For a schedule hours_weekly can&apos;t express, e.g. &quot;4th Tuesday of each month.&quot;
        </p>
        {values.hoursIrregular.map((row, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-bone-300)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`irregular-recurrence-${i}`} className="text-xs text-[var(--color-ink-500)]">
                Schedule {i + 1}
              </label>
              <button
                type="button"
                onClick={() => removeIrregularRow(i)}
                className="text-xs font-medium text-[var(--color-clay-700)] hover:underline"
              >
                Remove
              </button>
            </div>
            <select
              id={`irregular-recurrence-${i}`}
              value={row.recurrence}
              onChange={(e) => setIrregularField(i, "recurrence", e.target.value as IrregularEntryDraft["recurrence"])}
              className={`${inputBase} border-[var(--color-bone-300)]`}
            >
              <option value="">Select a kind…</option>
              <option value="monthly_ordinal">A specific weekday each month (e.g. 4th Tuesday)</option>
              <option value="monthly_date">A fixed day of the month (e.g. the 15th)</option>
              <option value="other">Other (describe in the note)</option>
            </select>

            {row.recurrence === "monthly_ordinal" && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label={`Schedule ${i + 1} ordinal`}
                  value={row.ordinal}
                  onChange={(e) => setIrregularField(i, "ordinal", e.target.value as IrregularEntryDraft["ordinal"])}
                  className={`${inputBase} border-[var(--color-bone-300)]`}
                >
                  <option value="">1st, 2nd…</option>
                  <option value="1">1st</option>
                  <option value="2">2nd</option>
                  <option value="3">3rd</option>
                  <option value="4">4th</option>
                  <option value="5">5th</option>
                  <option value="last">Last</option>
                </select>
                <select
                  aria-label={`Schedule ${i + 1} weekday`}
                  value={row.weekday}
                  onChange={(e) => setIrregularField(i, "weekday", e.target.value as IrregularEntryDraft["weekday"])}
                  className={`${inputBase} border-[var(--color-bone-300)]`}
                >
                  <option value="">Weekday…</option>
                  {DISPLAY_DAY_KEYS.map((day) => (
                    <option key={day} value={day}>
                      {DAY_LABELS[day]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {row.recurrence === "monthly_date" && (
              <input
                type="number"
                min={1}
                max={31}
                aria-label={`Schedule ${i + 1} day of month`}
                value={row.dayOfMonth}
                onChange={(e) => setIrregularField(i, "dayOfMonth", e.target.value)}
                placeholder="Day of month (1-31)"
                className={`${inputBase} border-[var(--color-bone-300)]`}
              />
            )}

            {(row.recurrence === "monthly_ordinal" || row.recurrence === "monthly_date") && (
              <input
                type="text"
                aria-label={`Schedule ${i + 1} time ranges`}
                value={row.slots}
                onChange={(e) => setIrregularField(i, "slots", e.target.value)}
                placeholder="11:00 AM - 12:00 PM"
                className={`${inputBase} border-[var(--color-bone-300)]`}
              />
            )}

            <textarea
              aria-label={`Schedule ${i + 1} note`}
              rows={2}
              value={row.note}
              onChange={(e) => setIrregularField(i, "note", e.target.value)}
              maxLength={FIELD_LIMITS.IRREGULAR_SCHEDULE_NOTE}
              placeholder={
                row.recurrence === "other"
                  ? "Describe the schedule, e.g. \"3rd weekend, call ahead\""
                  : "Note (optional)"
              }
              className={`${inputBase} border-[var(--color-bone-300)] resize-y min-h-[56px]`}
            />
          </div>
        ))}
        <button type="button" onClick={addIrregularRow} className={secondaryButtonClass}>
          + Add monthly schedule
        </button>
        {errors.hours_irregular && (
          <p role="alert" className={errorClass}>
            {errors.hours_irregular}
          </p>
        )}
      </fieldset>

      {/* SNAP / WIC tri-state */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="venue-snap" className={labelClass}>
            Accepts SNAP
          </label>
          <select
            id="venue-snap"
            value={values.acceptsSnap}
            onChange={(e) => setField("acceptsSnap", e.target.value as TriStateValue)}
            className={`${inputBase} border-[var(--color-bone-300)]`}
          >
            <option value="">Unknown</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
        <div>
          <label htmlFor="venue-wic" className={labelClass}>
            Accepts WIC
          </label>
          <select
            id="venue-wic"
            value={values.acceptsWic}
            onChange={(e) => setField("acceptsWic", e.target.value as TriStateValue)}
            className={`${inputBase} border-[var(--color-bone-300)]`}
          >
            <option value="">Unknown</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="venue-phone" className={labelClass}>
          Phone
        </label>
        <input
          type="tel"
          id="venue-phone"
          value={values.phone}
          onChange={(e) => setField("phone", e.target.value)}
          maxLength={FIELD_LIMITS.SUGGEST_CONTACT}
          className={`${inputBase} border-[var(--color-bone-300)]`}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="venue-email" className={labelClass}>
          Email
        </label>
        <input
          type="email"
          id="venue-email"
          value={values.email}
          onChange={(e) => setField("email", e.target.value)}
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={FIELD_LIMITS.EMAIL}
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "venue-email-error" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.email)}`}
        />
        {errors.email && (
          <p id="venue-email-error" role="alert" className={errorClass}>
            {errors.email}
          </p>
        )}
      </div>

      {/* Website */}
      <div>
        <label htmlFor="venue-url" className={labelClass}>
          Website
        </label>
        <input
          type="url"
          id="venue-url"
          value={values.url}
          onChange={(e) => setField("url", e.target.value)}
          maxLength={FIELD_LIMITS.SUGGEST_CONTACT}
          className={`${inputBase} border-[var(--color-bone-300)]`}
        />
      </div>

      {/* Operator */}
      <div>
        <label htmlFor="venue-operator" className={labelClass}>
          Operator
        </label>
        <input
          type="text"
          id="venue-operator"
          value={values.operator}
          onChange={(e) => setField("operator", e.target.value)}
          maxLength={FIELD_LIMITS.SUGGEST_VENUE_NAME}
          className={`${inputBase} border-[var(--color-bone-300)]`}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="venue-notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="venue-notes"
          rows={3}
          value={values.notes}
          onChange={(e) => setField("notes", e.target.value)}
          maxLength={FIELD_LIMITS.SUGGEST_NOTES}
          className={`${inputBase} border-[var(--color-bone-300)] resize-y min-h-[72px]`}
        />
      </div>

      {/* Source */}
      <div>
        <label htmlFor="venue-source" className={labelClass}>
          Source{requiredMark}
        </label>
        <input
          type="text"
          id="venue-source"
          value={values.source}
          onChange={(e) => setField("source", e.target.value)}
          maxLength={FIELD_LIMITS.ADMIN_VENUE_SOURCE}
          // Last single-line field — "Outside Pueblo County" below is a checkbox.
          enterKeyHint="done"
          aria-required="true"
          aria-invalid={errors.source ? "true" : undefined}
          aria-describedby={errors.source ? "venue-source-error" : undefined}
          className={`${inputBase} ${inputBorder(!!errors.source)}`}
        />
        {errors.source && (
          <p id="venue-source-error" role="alert" className={errorClass}>
            {errors.source}
          </p>
        )}
      </div>

      {/* Outside county */}
      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] cursor-pointer">
        <input
          type="checkbox"
          checked={values.outsideCounty}
          onChange={(e) => setField("outsideCounty", e.target.checked)}
          className={
            "w-4 h-4 rounded border-[var(--color-bone-300)] text-[var(--color-sage-500)] " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        />
        Outside Pueblo County
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={
          "w-full h-11 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
          "text-base font-semibold transition-colors duration-150 hover:bg-[var(--color-sage-600)] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
          "focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
        }
        aria-disabled={status === "submitting"}
      >
        {status === "submitting" ? "Saving…" : isEditMode ? "Save changes" : "Add venue"}
      </button>
    </form>
  );
}
