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

/** Trims; blank or non-string -> null. Over-cap sets an error and returns null. */
function optionalText(value: unknown, key: string, max: number, errors: Record<string, string>): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    errors[key] = "Must be text.";
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    errors[key] = `Must be ${max} characters or fewer.`;
    return null;
  }
  return trimmed;
}

function validateLinkUrl(value: unknown, errors: Record<string, string>): string | null {
  const text = optionalText(value, "link_url", FIELD_LIMITS.SUGGEST_CONTACT, errors);
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

function isCoord(n: unknown, limit: number): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -limit && n <= limit;
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
  const nameEs = optionalText(b.name_es, "name_es", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const host = optionalText(b.host, "host", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const hostEs = optionalText(b.host_es, "host_es", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);
  const description = optionalText(b.description, "description", FIELD_LIMITS.SUGGEST_NOTES, errors);
  const descriptionEs = optionalText(b.description_es, "description_es", FIELD_LIMITS.SUGGEST_NOTES, errors);
  const whatToBring = optionalText(b.what_to_bring, "what_to_bring", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const whatToBringEs = optionalText(b.what_to_bring_es, "what_to_bring_es", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const cancelNote = optionalText(b.cancel_note, "cancel_note", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
  const cancelNoteEs = optionalText(b.cancel_note_es, "cancel_note_es", FIELD_LIMITS.EVENT_SHORT_TEXT, errors);
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
    linkLabelCustom = optionalText(b.link_label_custom, "link_label_custom", FIELD_LIMITS.EVENT_LINK_LABEL, errors);
    linkLabelCustomEs = optionalText(b.link_label_custom_es, "link_label_custom_es", FIELD_LIMITS.EVENT_LINK_LABEL, errors);
    if (!linkLabelCustom && !errors.link_label_custom) errors.link_label_custom = "Type what the button should say.";
  }
  const venueName = optionalText(b.venue_name, "venue_name", FIELD_LIMITS.SUGGEST_VENUE_NAME, errors);

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
  const venueId = optionalText(b.venue_id, "venue_id", FIELD_LIMITS.SUGGEST_CONTACT, errors);

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
