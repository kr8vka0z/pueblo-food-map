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

  // Shared
  EMAIL: 254, // RFC 5321 maximum
} as const;
