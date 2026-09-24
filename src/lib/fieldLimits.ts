/**
 * Field length limits shared between server-side route validation and
 * client-side form maxlength attributes (#160 1.2).
 *
 * WHY a shared module: the server caps and the HTML maxlength must stay
 * identical — if they drift, the server will reject submissions that the
 * client allowed, causing confusing silent failures. Single source of truth
 * eliminates that risk.
 *
 * Import in route handlers (server) and form components (client) alike.
 */

export const FIELD_LIMITS = {
  // Report form
  REPORT_DESCRIPTION: 2000,

  // Suggest form
  SUGGEST_VENUE_NAME: 200,
  SUGGEST_ADDRESS: 300,
  SUGGEST_HOURS: 200,
  SUGGEST_CONTACT: 300,
  SUGGEST_NOTES: 2000,

  // Feedback form
  FEEDBACK_MESSAGE: 3000,

  // Blessing box check-in note (Blessing Boxes slice 2) — "a short note",
  // per the Build Plan; deliberately far shorter than the report/suggest
  // description fields above since a check-in note is a one-line aside
  // ("shelf was full, added extra diapers"), not a description.
  BOX_CHECKIN_NOTE: 280,

  // Blessing box adopter (Blessing Boxes slice 6) — display_name is public
  // ("Cared for by ..."), so kept short like a name/label, not a bio; note
  // is a private admin-only aside, same length class as a check-in note.
  BOX_ADOPTER_DISPLAY_NAME: 60,
  BOX_ADOPTER_NOTE: 280,

  // Shared
  EMAIL: 254, // RFC 5321 maximum

  // Admin venue form (#297) — name/address/notes/operator/phone/url reuse
  // an existing public-form constant for the same semantic field rather
  // than a second, separately-maintained copy of the same value:
  // name -> SUGGEST_VENUE_NAME, address -> SUGGEST_ADDRESS, notes ->
  // SUGGEST_NOTES, operator -> SUGGEST_VENUE_NAME (an org name, same
  // length class as a venue name), phone/url -> SUGGEST_CONTACT (the
  // suggest form's own combined "phone / email / URL" field). `source` (a
  // provenance citation, e.g. "OpenStreetMap (node/4041375052)") has no
  // public-form equivalent — new constant, sized like SUGGEST_ADDRESS.
  ADMIN_VENUE_SOURCE: 300,
} as const;
