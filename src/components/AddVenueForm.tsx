"use client";

/**
 * AddVenueForm — client component for the admin "Add a venue" form (#254).
 *
 * Presentational + self-contained: owns all field state, client-side
 * validation, and the POST to /api/admin/venues. No auth/D1 in scope here —
 * the Cloudflare Access gate lives in the parent Server Component
 * (src/app/admin/venues/new/page.tsx, same pattern as AGENTS.md "Admin
 * authentication"). This mirrors SuggestForm.tsx's own form/route split;
 * this component imitates SuggestForm's input/label/error token classes
 * (bone borders, sage focus rings) directly rather than importing them —
 * no shared form-component library exists between the public and admin
 * surfaces, so each form owns its own copy, same as SuggestForm already does.
 *
 * On a successful create (201), redirects to /admin and calls
 * router.refresh() so the Server Component's venues query re-runs and the
 * new draft appears in the list immediately (next/navigation's useRouter).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { DISPLAY_DAY_KEYS, type DayKey } from "@/lib/hours";
import type { VenueCategory, WeeklyHours } from "@/types/venue";

// ─── Types ──────────────────────────────────────────────────────────────────

type TriStateValue = "" | "1" | "0";
type HoursDraft = Record<DayKey, string>;

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

export default function AddVenueForm({ initialValues }: AddVenueFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<AddVenueFormValues>(() => defaultValues(initialValues));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  function setField<K extends keyof AddVenueFormValues>(key: K, value: AddVenueFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setHourDay(day: DayKey, value: string) {
    setValues((prev) => ({ ...prev, hours: { ...prev.hours, [day]: value } }));
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
    };

    try {
      const res = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        router.push("/admin");
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
      {/* ponytail: plain number inputs for now — a map-click picker (drop a
          pin, autofill lat/lng from the click) is the natural upgrade once
          hand-typing coordinates becomes the bottleneck; no ceiling here
          beyond that UX gap. */}
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
        {status === "submitting" ? "Saving…" : "Add venue"}
      </button>
    </form>
  );
}
