/**
 * Shared constants for the feedback form and submit route.
 *
 * Keeping feedback type keys here avoids duplication between the client form
 * component and the server-side route handler.
 *
 * Canonical (English) labels are used in the email subject/body.
 * Localized option labels are rendered in the form UI via i18n t().
 */

export const FEEDBACK_TYPES = {
  positive: "Positive / compliment",
  problem: "Problem or bug",
  feature: "Feature request",
  other: "Other",
} as const;

export type FeedbackTypeKey = keyof typeof FEEDBACK_TYPES;
