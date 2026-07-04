/**
 * adminVenueValidation.ts — authoritative server-side validation for
 * POST /api/admin/venues (#254; docs/admin/cloudflare-native-admin-spec.md
 * §5 step 1 "Create").
 *
 * Kept separate from src/app/api/admin/venues/route.ts so the validation
 * rules are unit-testable with plain fixtures (see
 * adminVenueValidation.test.ts) — same lib/route split as
 * publishVenues.ts's validateAndMapRow vs. its route handler.
 *
 * WHY re-validate here even though AddVenueForm.tsx already checks
 * required fields client-side: this route is the authoritative trust
 * boundary. SQLite's own CHECK constraints (migrations/0001_init_admin_schema.sql)
 * only constrain `category`/`status`/`source_type` enums — they do NOT
 * bound lat/lng, enforce a parseable date, or shape-check the
 * hours_weekly JSON blob, so a bad row could otherwise land in `venues`
 * silently. Every rule below either mirrors a real CHECK constraint or
 * closes a gap SQLite itself leaves open.
 *
 * Every field error is collected in one pass (not abort-on-first, unlike
 * publishVenues.ts's validateSnapshot) — this is an interactive form, so an
 * admin fixing one typo shouldn't have to resubmit repeatedly to discover
 * the next problem.
 */

import { categoryLabels } from "@/data/venues";
import { DISPLAY_DAY_KEYS } from "@/lib/hours";
import { EMAIL_RE } from "@/lib/rateLimit";
import type { VenueCategory, WeeklyHours } from "@/types/venue";

// Reuses the category labels map's own keys as the enum source of truth
// (same technique VenueListView.tsx's ALL_CATEGORIES already uses) instead
// of hand-maintaining a 4th copy of the 7-value list (schema CHECK,
// VenueCategory union, publishVenues.ts's VALID_CATEGORIES, and this one).
const VALID_CATEGORIES = new Set(Object.keys(categoryLabels) as VenueCategory[]);
const VALID_DAY_KEYS: ReadonlySet<string> = new Set(DISPLAY_DAY_KEYS);

export type TriState = 0 | 1 | null;

/** Fields ready to bind into the INSERT statement — already the exact type/shape each D1 column expects. */
export interface ValidatedVenueFields {
  name: string;
  category: VenueCategory;
  lat: number;
  lng: number;
  address: string;
  /** Pre-serialized JSON text for the `hours_weekly` TEXT column, or null. */
  hoursWeeklyJson: string | null;
  acceptsSnap: TriState;
  acceptsWic: TriState;
  phone: string | null;
  email: string | null;
  url: string | null;
  notes: string | null;
  operator: string | null;
  source: string;
  lastVerified: string;
  outsideCounty: 0 | 1;
}

export type ValidateCreateVenueResult =
  | { ok: true; fields: ValidatedVenueFields }
  | { ok: false; errors: Record<string, string> };

/** Optional free-text field: undefined/null -> null; non-string -> error; blank-after-trim -> null. */
function optionalString(value: unknown, field: string, errors: Record<string, string>): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    errors[field] = "Must be text.";
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Matches the D1 tri-state convention (migrations/0001_init_admin_schema.sql): NULL=unknown, 0=no, 1=yes. */
function validateTriState(value: unknown, field: string, errors: Record<string, string>): TriState {
  if (value === undefined || value === null) return null;
  if (value === 0 || value === 1) return value;
  errors[field] = "Must be Unknown, Yes, or No.";
  return null;
}

/**
 * Validates the optional hours_weekly object against the WeeklyHours shape
 * (src/types/venue.ts) and serializes it to the JSON text the `hours_weekly`
 * TEXT column stores. An object with every day blank/absent maps to `null`
 * (not the string "{}") — that's the same "no hours entered" signal a
 * completely-omitted field would produce, so callers reading this back
 * (e.g. publishVenues.ts's validateAndMapRow) never see a spurious empty
 * schedule.
 */
function validateHoursWeekly(value: unknown, errors: Record<string, string>): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.hours_weekly = "Hours must be a weekly schedule object.";
    return null;
  }

  const cleaned: WeeklyHours = {};
  for (const [day, slots] of Object.entries(value as Record<string, unknown>)) {
    if (!VALID_DAY_KEYS.has(day)) {
      errors.hours_weekly = `Unknown day "${day}" in hours.`;
      return null;
    }
    if (!Array.isArray(slots) || slots.some((s) => typeof s !== "string" || s.trim().length === 0)) {
      errors.hours_weekly = `Hours for "${day}" must be a list of time ranges.`;
      return null;
    }
    cleaned[day as keyof WeeklyHours] = slots.map((s) => (s as string).trim());
  }

  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Validates a raw POST /api/admin/venues JSON body. Returns either the
 * fully-typed, bind-ready fields or a field-name-keyed error map the client
 * can map directly onto its inputs (AddVenueForm.tsx uses the same field
 * names for its own error state).
 */
export function validateCreateVenuePayload(body: unknown): ValidateCreateVenueResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: { _form: "Invalid request body." } };
  }
  const b = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) errors.name = "Name is required.";

  const category = typeof b.category === "string" ? (b.category as VenueCategory) : undefined;
  if (!category || !VALID_CATEGORIES.has(category)) {
    errors.category = "Select a valid category.";
  }

  // lat/lng must be genuine JSON numbers, never numeric strings — this is
  // the authoritative boundary, so a loosely-typed caller sending "38.25"
  // as a string is a validation failure, not something to silently coerce.
  const lat = b.lat;
  const latValid = typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
  if (!latValid) errors.lat = "Latitude must be a number between -90 and 90.";

  const lng = b.lng;
  const lngValid = typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  if (!lngValid) errors.lng = "Longitude must be a number between -180 and 180.";

  const address = typeof b.address === "string" ? b.address.trim() : "";
  if (!address) errors.address = "Address is required.";

  const source = typeof b.source === "string" ? b.source.trim() : "";
  if (!source) errors.source = "Source is required.";

  const lastVerified = typeof b.last_verified === "string" ? b.last_verified.trim() : "";
  if (!lastVerified || Number.isNaN(Date.parse(lastVerified))) {
    errors.last_verified = "Enter a valid date.";
  }

  const hoursWeeklyJson = validateHoursWeekly(b.hours_weekly, errors);
  const acceptsSnap = validateTriState(b.accepts_snap, "accepts_snap", errors);
  const acceptsWic = validateTriState(b.accepts_wic, "accepts_wic", errors);

  const phone = optionalString(b.phone, "phone", errors);
  const email = optionalString(b.email, "email", errors);
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  const url = optionalString(b.url, "url", errors);
  const notes = optionalString(b.notes, "notes", errors);
  const operator = optionalString(b.operator, "operator", errors);

  let outsideCounty: 0 | 1 = 0;
  if (b.outside_county === true || b.outside_county === 1) {
    outsideCounty = 1;
  } else if (b.outside_county !== undefined && b.outside_county !== false && b.outside_county !== 0) {
    errors.outside_county = "Must be true or false.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    fields: {
      name,
      category: category as VenueCategory,
      lat: lat as number,
      lng: lng as number,
      address,
      hoursWeeklyJson,
      acceptsSnap,
      acceptsWic,
      phone,
      email,
      url,
      notes,
      operator,
      source,
      lastVerified,
      outsideCounty,
    },
  };
}
