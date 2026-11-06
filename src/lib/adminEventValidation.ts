/**
 * adminEventValidation.ts — authoritative server-side validation for the
 * admin events routes (POST /api/admin/events, PATCH .../[id]; #757).
 *
 * Hand-rolled in the style of adminVenueValidation.ts (no schema library):
 * one pass that collects every field error so the form can show each next to
 * its field. The routes are the trust boundary; EventForm.tsx's own checks
 * are only fast feedback.
 *
 * Times arrive as Pueblo wall-clock strings (`starts_at_local` /
 * `ends_at_local`, the raw value of a datetime-local input) and leave as UTC
 * instants. The conversion lives here, server-side, so the browser's own
 * timezone can never affect what is stored (see eventTime.ts).
 *
 * Error keys: name, host, ..., `starts_at`, `ends_at`, `place` (one message
 * covering "no place chosen / address never located / bad coordinates"),
 * `link_url`, `link_label`, `link_label_custom(_es)`, `venue_name`,
 * `cancel_note`, and `_form` for body-level problems.
 */

import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { puebloLocalToUtcIso } from "@/lib/eventTime";
import { isValidEmail } from "@/lib/email";
import { isCoord, isOutsideCounty } from "@/lib/mapBounds";
import { optionalStringCapped } from "@/lib/adminVenueValidation";

export const EVENT_STATUSES = ["draft", "published", "cancelled", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** What the card's action button can say (#882). Stored in events.link_label; NULL reads as "website". */
export const EVENT_LINK_LABELS = ["website", "signup", "tickets", "rsvp", "volunteer", "donate", "custom"] as const;
export type EventLinkLabel = (typeof EVENT_LINK_LABELS)[number];

export interface ValidatedEventFields {
  name: string;
  nameEs: string | null;
  host: string | null;
  hostEs: string | null;
  description: string | null;
  descriptionEs: string | null;
  whatToBring: string | null;
  whatToBringEs: string | null;
  cancelNote: string | null;
  cancelNoteEs: string | null;
  /** UTC ISO instants, ready to bind. */
  startsAt: string;
  endsAt: string;
  lat: number;
  lng: number;
  address: string;
  venueId: string | null;
  venueName: string | null;
  linkUrl: string | null;
  linkLabel: EventLinkLabel | null;
  /** Only ever non-null when linkLabel is "custom". */
  linkLabelCustom: string | null;
  linkLabelCustomEs: string | null;
}

export type ValidateEventResult<A extends string> =
  | { ok: true; fields: ValidatedEventFields; action: A }
  | { ok: false; errors: Record<string, string> };

function validateLinkUrl(value: unknown, errors: Record<string, string>): string | null {
  const text = optionalStringCapped(value, "link_url", FIELD_LIMITS.SUGGEST_CONTACT, errors);
  if (text === null) return null;
  // http(s) only: this value becomes a public href, and `javascript:` would run on click.
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") return text;
  } catch {
    // fall through to the error
  }
  errors.link_url = "Enter a full web address starting with http:// or https://.";
  return null;
}

/**
 * Validates a raw events JSON body. `allowedActions` is per route (create:
 * save_draft | publish; edit: save | publish | cancel), so a route can never
 * be driven into a transition it doesn't offer.
 */
export function validateEventPayload<A extends string>(
  body: unknown,
  allowedActions: readonly A[],
): ValidateEventResult<A> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: { _form: "Invalid request body." } };
  }
  const b = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const action = allowedActions.find((a) => a === b.action);
  if (action === undefined) errors._form = "Unknown action.";

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) errors.name = "Name is required.";
  else if (name.length > FIELD_LIMITS.SUGGEST_VENUE_NAME) {
    errors.name = `Name must be ${FIELD_LIMITS.SUGGEST_VENUE_NAME} characters or fewer.`;
  }
  const nameEs = optionalStringCapped(b.name_es, "name_es", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const host = optionalStringCapped(b.host, "host", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const hostEs = optionalStringCapped(b.host_es, "host_es", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const description = optionalStringCapped(b.description, "description", FIELD_LIMITS.SUGGEST_NOTES, errors);
  const descriptionEs = optionalStringCapped(b.description_es, "description_es", FIELD_LIMITS.SUGGEST_NOTES, errors);
  const whatToBring = optionalStringCapped(b.what_to_bring, "what_to_bring", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const whatToBringEs = optionalStringCapped(b.what_to_bring_es, "what_to_bring_es", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const cancelNote = optionalStringCapped(b.cancel_note, "cancel_note", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const cancelNoteEs = optionalStringCapped(b.cancel_note_es, "cancel_note_es", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  if (b.action === "cancel" && !cancelNote && !errors.cancel_note) {
    errors.cancel_note = "Add a note explaining the cancellation.";
  }
  const linkUrl = validateLinkUrl(b.link_url, errors);

  // Button wording (#882). Blank = NULL = "Visit website". The custom words are
  // kept only with "custom", so switching to a built-in wording can't leave
  // stale text in the row (or the audit log) that nothing shows.
  let linkLabel: EventLinkLabel | null = null;
  if (b.link_label !== undefined && b.link_label !== null && b.link_label !== "") {
    linkLabel = EVENT_LINK_LABELS.find((l) => l === b.link_label) ?? null;
    if (linkLabel === null) errors.link_label = "Choose what the button says from the list.";
  }
  let linkLabelCustom: string | null = null;
  let linkLabelCustomEs: string | null = null;
  if (linkLabel === "custom") {
    linkLabelCustom = optionalStringCapped(b.link_label_custom, "link_label_custom", FIELD_LIMITS.EVENT_LINK_LABEL, errors);
    linkLabelCustomEs = optionalStringCapped(b.link_label_custom_es, "link_label_custom_es", FIELD_LIMITS.EVENT_LINK_LABEL, errors);
    if (!linkLabelCustom && !errors.link_label_custom) errors.link_label_custom = "Type what the button should say.";
  }
  const venueName = optionalStringCapped(b.venue_name, "venue_name", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);

  // Times: Pueblo wall clock in, UTC instants out; compare instants, never the typed text.
  const startsAt = typeof b.starts_at_local === "string" ? puebloLocalToUtcIso(b.starts_at_local) : null;
  if (!startsAt) errors.starts_at = "Enter a valid start date and time.";
  const endsAt = typeof b.ends_at_local === "string" ? puebloLocalToUtcIso(b.ends_at_local) : null;
  if (!endsAt) errors.ends_at = "Enter a valid end date and time.";
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.ends_at = "The end must be after the start.";
  }

  // Place: a venue pick and a typed address both end up as address + lat/lng,
  // so one rule covers both. venue_id is optional provenance only.
  const address = typeof b.address === "string" ? b.address.trim() : "";
  if (address.length > FIELD_LIMITS.SUGGEST_ADDRESS) {
    errors.place = `Address must be ${FIELD_LIMITS.SUGGEST_ADDRESS} characters or fewer.`;
  } else if (!address) {
    errors.place = "Choose a place or enter an address.";
  } else if (!isCoord(b.lat, 90) || !isCoord(b.lng, 180)) {
    errors.place = "Find the location for this address, or choose a place from the list.";
  }
  const venueId = optionalStringCapped(b.venue_id, "venue_id", FIELD_LIMITS.SUGGEST_CONTACT, errors);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    action: action as A,
    fields: {
      name,
      nameEs,
      host,
      hostEs,
      description,
      descriptionEs,
      whatToBring,
      whatToBringEs,
      cancelNote,
      cancelNoteEs,
      startsAt: startsAt as string,
      endsAt: endsAt as string,
      lat: b.lat as number,
      lng: b.lng as number,
      address,
      venueId,
      venueName,
      linkUrl,
      linkLabel,
      linkLabelCustom,
      linkLabelCustomEs,
    },
  };
}

/** Button wordings the PUBLIC form offers (#883): the six built-ins, never Custom. */
export const PUBLIC_EVENT_LINK_LABELS = EVENT_LINK_LABELS.filter((l): l is Exclude<EventLinkLabel, "custom"> => l !== "custom");
export type PublicEventLinkLabel = (typeof PUBLIC_EVENT_LINK_LABELS)[number];

/** What an event_submissions row's `payload` holds: admin-shaped fields, times already UTC. No personal data. */
export interface EventSubmissionPayload {
  name: string;
  host: string;
  description: string;
  whatToBring: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string | null;
  address: string;
  linkUrl: string | null;
  linkLabel: PublicEventLinkLabel;
  /**
   * The pin of the address the sender picked in the address check (#883 spec
   * change), or null when there was none. Only kept when both are finite and
   * inside Pueblo County's box; anything else is dropped, never an error, so
   * a bad pin can't block a send. Rows saved before this field read as null.
   */
  lat: number | null;
  lng: number | null;
}

/** A sender-supplied pin, kept only if it is two finite numbers inside Pueblo County's box. */
export function puebloPin(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return isOutsideCounty({ lat, lng }) ? null : { lat, lng };
}

export type ValidateSubmissionResult =
  | { ok: true; payload: EventSubmissionPayload; submitterName: string; submitterEmail: string }
  | { ok: false; errors: Record<string, string> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * The public "Share an event" form (#883, POST /events/share/submit). Same
 * caps, link rule and Pueblo-time conversion as the admin form above, but its
 * own required set: the public sends one date plus a start and end time (the
 * same day; an overnight event is rare enough for the admin to fix in the
 * draft), no coordinates (the admin's convert geocodes the address), no
 * Spanish and no Custom button wording. Error keys are the body's own field
 * names. The client's checks are only fast feedback; this is the boundary.
 */
export function validateEventSubmission(body: unknown): ValidateSubmissionResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: { _form: "Invalid request body." } };
  }
  const b = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const required = (key: string, max: number, message: string): string => {
    const text = optionalStringCapped(b[key], key, max, errors);
    if (!text && !errors[key]) errors[key] = message;
    return text ?? "";
  };

  const name = required("name", FIELD_LIMITS.SUGGEST_VENUE_NAME, "Name is required.");
  const host = required("host", FIELD_LIMITS.SUGGEST_VENUE_NAME, "Say who is hosting it.");
  const description = required("description", FIELD_LIMITS.SUGGEST_NOTES, "Say what the event is.");
  const whatToBring = optionalStringCapped(b.what_to_bring, "what_to_bring", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const venueName = optionalStringCapped(b.venue_name, "venue_name", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const address = required("address", FIELD_LIMITS.SUGGEST_ADDRESS, "Enter the street address.");
  const linkUrl = validateLinkUrl(b.link_url, errors);
  const linkLabel = PUBLIC_EVENT_LINK_LABELS.find((l) => l === (b.link_label ?? "website"));
  if (!linkLabel) errors.link_label = "Choose what the button says from the list.";
  const submitterName = required("submitter_name", FIELD_LIMITS.SUGGEST_VENUE_NAME, "Enter your name.");
  const submitterEmail = typeof b.submitter_email === "string" ? b.submitter_email.trim() : "";
  if (!submitterEmail) errors.submitter_email = "Enter your email.";
  else if (submitterEmail.length > FIELD_LIMITS.EMAIL || !isValidEmail(submitterEmail)) errors.submitter_email = "Enter a valid email.";

  const date = typeof b.date === "string" && DATE_RE.test(b.date) ? b.date : null;
  const start = typeof b.start_time === "string" && TIME_RE.test(b.start_time) ? b.start_time : null;
  const end = typeof b.end_time === "string" && TIME_RE.test(b.end_time) ? b.end_time : null;
  const startsAt = date && start ? puebloLocalToUtcIso(`${date}T${start}`) : null;
  const endsAt = date && end ? puebloLocalToUtcIso(`${date}T${end}`) : null;
  if (!date) errors.date = "Enter a valid date.";
  if (date && !startsAt) errors.start_time = "Enter a valid start time.";
  if (date && !endsAt) errors.end_time = "Enter a valid end time.";
  else if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.end_time = "The end must be after the start.";

  const pin = puebloPin(b.lat, b.lng);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    submitterName,
    submitterEmail,
    payload: {
      name,
      host,
      description,
      whatToBring,
      startsAt: startsAt as string,
      endsAt: endsAt as string,
      venueName,
      address,
      linkUrl,
      linkLabel: linkLabel as PublicEventLinkLabel,
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
    },
  };
}
