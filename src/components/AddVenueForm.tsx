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
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { DISPLAY_DAY_KEYS, type DayKey } from "@/lib/hours";
import type { VenueCategory, WeeklyHours } from "@/types/venue";

// ─── Types ──────────────────────────────────────────────────────────────────

type TriStateValue = "" | "1" | "0";
type HoursDraft = Record<DayKey, string>;

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
  acceptsSnap: TriStateValue;
  acceptsWic: TriStateValue;
  phone: string;
  email: string;
  url: string;
  operator: string;
  notes: string;
  source: string;
  outsideCounty: boolean;
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
  | "accepts_snap"
  | "accepts_wic"
  | "phone"
  | "email"
  | "url"
  | "operator"
  | "notes"
  | "outside_county";

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
    acceptsSnap: "",
    acceptsWic: "",
    phone: "",
    email: "",
    url: "",
    operator: "",
    notes: "",
    source: "Manual entry",
    outsideCounty: false,
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

export default function AddVenueForm({ initialValues, venueId, submissionId }: AddVenueFormProps) {
  const router = useRouter();
  const isEditMode = venueId !== undefined;
  const [values, setValues] = useState<AddVenueFormValues>(() => defaultValues(initialValues));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [geocodeStatus, setGeocodeStatus] = useState<GeocodeStatus>("idle");
  const [geocodeMessage, setGeocodeMessage] = useState("");
  const [geocodeCandidates, setGeocodeCandidates] = useState<GeocodeMatch[]>([]);

  function setField<K extends keyof AddVenueFormValues>(key: K, value: AddVenueFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setHourDay(day: DayKey, value: string) {
    setValues((prev) => ({ ...prev, hours: { ...prev.hours, [day]: value } }));
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
      accepts_snap: values.acceptsSnap === "" ? null : Number(values.acceptsSnap),
      accepts_wic: values.acceptsWic === "" ? null : Number(values.acceptsWic),
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      url: values.url.trim() || undefined,
      operator: values.operator.trim() || undefined,
      notes: values.notes.trim() || undefined,
      outside_county: values.outsideCounty ? 1 : 0,
      // #259: only ever sent on a fresh create reached from the review
      // queue — never in edit mode (submissionId is meaningless there; see
      // this prop's own doc comment above).
      ...(!isEditMode && submissionId != null ? { submissionId } : {}),
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
        // #259: a create that approved a submission returns to the review
        // queue (so the admin picks up the next pending card) rather than
        // the plain venue list; every other path is unchanged.
        router.push(!isEditMode && submissionId != null ? "/admin/submissions" : "/admin");
        router.refresh();
        return;
      }

      if (res.status === 422) {
        const data = (await res.json()) as { errors: FieldErrors };
        setErrors(data.errors);
        setStatus("idle");
        return;
      }

      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  const inputBase =
    "w-full rounded-[var(--radius-md)] border px-3 py-2 text-sm text-[var(--color-ink-900)] " +
    "bg-white placeholder:text-[var(--color-ink-300)] " +
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
          <p className="text-sm font-medium text-red-700">Something went wrong.</p>
          <p className="text-sm text-red-600 mt-0.5">The venue was not saved. Try again.</p>
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
