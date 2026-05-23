/**
 * Shared constants for the venue report form and submit route.
 *
 * Keeping issue type keys here avoids duplication between the client form
 * component and the server-side route handler.
 */

export const ISSUE_TYPES = {
  location: "Location is wrong (wrong address or pin position)",
  hours: "Hours are wrong or out of date",
  contact: "Contact info (phone / email / URL) is wrong",
  closed: "Venue has closed permanently",
  snapwic: "SNAP / WIC acceptance is wrong",
  other: "Other",
} as const;

export type IssueTypeKey = keyof typeof ISSUE_TYPES;
