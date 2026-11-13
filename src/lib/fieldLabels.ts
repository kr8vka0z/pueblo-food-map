/**
 * fieldLabels.ts — the plain name a person reads for a venue field
 * ("accepts_snap" → "Accepts SNAP"), shared by the change cards
 * (ProposalCard), the Places "To review" column, the
 * source-switch panel and the Activity page's change lines (#926).
 *
 * WHY its own file: ActivityLog is a server component and ProposalCard is
 * "use client" (it also pulls in the public VenueCard), so the map cannot
 * live in ProposalCard and be called from the Activity page. No "use client"
 * here.
 *
 * A field with no entry falls back to a readable form (underscores to
 * spaces, first letter capital), never the raw key. src/lib/adminVenues.ts
 * keeps its own map for the edit page's "Waiting to publish" box.
 */

const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  name: "Name",
  category: "Category",
  status: "Status",
  lat: "Latitude",
  lng: "Longitude",
  address: "Address",
  phone: "Phone",
  email: "Email",
  url: "Website",
  hours_weekly: "Hours",
  hours_irregular: "Monthly hours",
  accepts_snap: "Accepts SNAP",
  accepts_wic: "Accepts WIC",
  notes: "Notes",
  operator: "Operator",
  source: "Source",
  last_verified: "Last verified",
};

export function fieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  const words = field.replace(/_+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : field;
}
