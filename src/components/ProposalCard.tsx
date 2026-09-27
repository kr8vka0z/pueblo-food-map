"use client";

/**
 * ProposalCard — one `change_proposals` row's review card: source/lane
 * badges, a per-change_type detail renderer, the right-hand public-card
 * preview, and the Approve/Reject actions. Extracted from
 * ProposalsReviewView.tsx (issue #674, "fold the Data refresh tab into
 * Places") — that component owned both this card AND the /admin/flags
 * queue's filter chips/bulk-approve UI; the queue itself is gone (its
 * chips/filters/bulk-approve moved into the Places tab's VenueListView +
 * ToReviewSummaryBox), but the SAME card renders in two places now: the
 * venue edit page's "Suggestions to review" box (SuggestionsBox.tsx, one
 * venue's own pending proposals) and, for a brand-new `add` proposal with
 * no existing venue row to attach to, above the prefilled
 * /admin/venues/new form.
 *
 * Prop shape changed from ProposalsReviewView's `venueLookup: Record<string,
 * VenueLookup>` map to a single, optional `venue` — every call site here
 * already knows exactly which one venue (if any) this card's proposal
 * targets, so a full lookup map was only ever needed by the old queue's
 * mixed list of many venues at once.
 *
 * Behavior change from the original card (issue #674's own spec): a
 * genuinely-new `add` proposal (no existing venue row — `venue` is
 * undefined) no longer shows a one-click Approve button here. Approving a
 * brand-new place now means opening it in the real "Add a venue" form first
 * (/admin/venues/new?proposal=<id>, prefilled via
 * adminVenueForm.ts's mapAddProposalToFormValues) so the admin can review
 * and fix fields before it's created — the old one-click Approve applied
 * `diff.after` completely unedited. This card still offers Reject for a bad
 * suggestion without opening the form. A RESTORE (`add` targeting an
 * existing archived venue — `venue.status === "archived"`) is unaffected:
 * the venue row already exists, so Approve here still works exactly as
 * before (POST .../approve, applyApprovedProposal's isRestore branch).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { formatLastVerified } from "@/lib/adminVenues";
import { formatSlot } from "@/lib/hours";
import { safeUrl } from "@/lib/safeUrl";
import VenueCard from "@/components/VenueCard";
import type { Venue, VenueCategory, WeeklyHours } from "@/types/venue";
import { renameMetaOf, reviewableDiffFields, reviewLaneOf } from "@/lib/adminProposals";
import type {
  ChangeProposalRow,
  ParsedProposal,
  ProposalChangeType,
  ProposalSourceValue,
  ProposedDiff,
  ReviewLane,
} from "@/lib/adminProposals";
import type { VenueLookup } from "@/lib/adminVenueLookup";

// ─── Shared styling (reuses existing DESIGN.md tokens — no new ones) ───────

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

// Exported: NeedsDecisionPanel.tsx (Dashboard's "Needs a decision" panel)
// reuses this SAME label map for its own source display, rather than a
// second copy that could drift from this one.
export const SOURCE_BADGE: Record<ProposalSourceValue, { label: string; className: string }> = {
  osm: { label: "OpenStreetMap", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  plentiful: { label: "Plentiful", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  gtfs: { label: "GTFS", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  link_health: { label: "Broken link", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
};

// Triage lanes (#543) — existing badge colour pairs only, no new tokens.
export const LANE_BADGE: Record<ReviewLane, { label: string; className: string }> = {
  needs_human: { label: "Needs a human", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
  likely_rename: { label: "Likely rename", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  likely_noise: { label: "Likely noise", className: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]" },
};

const REMOVE_REASON_LABEL: Record<string, string> = {
  gone: "closed",
  temporarily_missing: "a scrape gap, still open",
  renamed_or_moved: "renamed or moved",
  unclear: "unclear",
};

const pct = (p: number) => `${Math.round(p * 100)}%`;

/**
 * One plain sentence from the stored Jev answers (triage_json), or null
 * when the row was never triaged. Exported for tests and for
 * adminProposals.ts's Places "To review" row summary, which reuses this
 * exact sentence rather than a second copy.
 */
export function triageSummary(row: Pick<ChangeProposalRow, "triage_json">): string | null {
  if (!row.triage_json) return null;
  type Answer = { noul?: number; choice?: string; probabilities?: Record<string, number> };
  let parsed: { answers?: Record<string, Answer> };
  try {
    parsed = JSON.parse(row.triage_json);
  } catch {
    return null;
  }
  const a = parsed.answers ?? {};
  if (typeof a.same_place?.noul === "number") return `Jev: ${pct(a.same_place.noul)} likely the same place under a new listing.`;
  if (typeof a.same_value?.noul === "number")
    return `Jev: ${pct(a.same_value.noul)} likely the same value, only written differently.`;
  const reason = a.remove_reason;
  if (reason?.choice) {
    const p = reason.probabilities?.[reason.choice];
    return `Jev's best guess: ${REMOVE_REASON_LABEL[reason.choice] ?? reason.choice}${typeof p === "number" ? ` (${pct(p)})` : ""}.`;
  }
  return null;
}

export const CHANGE_TYPE_LABEL: Record<ProposalChangeType, string> = {
  add: "New venue",
  update: "Field update",
  remove: "Remove",
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-ink-700)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-bone-100)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const dangerButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  category: "Category",
  lat: "Latitude",
  lng: "Longitude",
  address: "Address",
  phone: "Phone",
  url: "Website",
  hours_weekly: "Hours",
  operator: "Operator",
  last_verified: "Last verified",
};

// Exported for the same reuse reason as SOURCE_BADGE above.
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function capitalizeDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/**
 * Per-day hours summary shared by formatFieldValue (update diffs) and
 * AddDetails (new-venue proposals) — routes every slot through
 * @/lib/hours' formatSlot so an admin reads "9am – 5pm," never a raw
 * "09:00-17:00"/"9:00 AM - 5:00 PM" string or a dumped JSON object. Empty
 * (no days with slots) returns "(empty)", same convention as
 * formatFieldValue's other empty values.
 */
function formatHoursSummary(hours: WeeklyHours): string {
  const entries = Object.entries(hours).filter(([, slots]) => (slots ?? []).length > 0);
  if (entries.length === 0) return "(empty)";
  return entries
    .map(([day, slots]) => `${capitalizeDay(day)}: ${(slots ?? []).map(formatSlot).join(", ")}`)
    .join(" · ");
}

/** Renders one Venue field's value for the diff view — hours_weekly gets a compact per-day summary, everything else stringifies plainly. Empty/null/undefined renders as an explicit "(empty)" so a real value clearing to nothing reads clearly, not as a blank cell. Exported for the same reuse reason as SOURCE_BADGE above. */
export function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (field === "hours_weekly" && typeof value === "object") {
    return formatHoursSummary(value as WeeklyHours);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// ─── Component ──────────────────────────────────────────────────────────────

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

export interface ProposalCardProps {
  proposal: ParsedProposal;
  /** The proposal's current target venue, or undefined for a genuinely-new `add` with no existing row. */
  venue?: VenueLookup;
}

export default function ProposalCard({ proposal, venue }: ProposalCardProps) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejectState, setRejectState] = useState<ActionState>({ status: "idle" });
  const [approveState, setApproveState] = useState<ActionState>({ status: "idle" });

  const { row } = proposal;
  const source = row.source as ProposalSourceValue;
  const changeType = row.change_type as ProposalChangeType;
  const sourceBadge = SOURCE_BADGE[source] ?? { label: row.source, className: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]" };
  const reasonFieldId = `proposal-reject-reason-${row.id}`;

  const afterName = !proposal.parseError && typeof proposal.diff.after?.name === "string" ? proposal.diff.after.name : undefined;
  const beforeName = !proposal.parseError && typeof proposal.diff.before?.name === "string" ? proposal.diff.before.name : undefined;
  const venueName = venue?.name ?? afterName ?? beforeName ?? row.target_venue_id;
  const isRestore = changeType === "add" && venue?.status === "archived";
  // A brand-new `add` (no existing row at all) routes through the "Add a
  // venue" form instead of a one-click Approve here — see this file's own
  // header for why.
  const isNewPlace = changeType === "add" && !isRestore;
  const lane = reviewLaneOf(row, proposal.parseError ? null : proposal.diff);
  const laneBadge = LANE_BADGE[lane];
  const summary = triageSummary(row);
  const rename = proposal.parseError ? null : renameMetaOf(proposal.diff);

  async function postAction(path: "approve" | "reject", body?: unknown) {
    return fetch(`/api/admin/proposals/${row.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async function handleApprove(confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setApproveState({ status: "submitting" });
    try {
      const res = await postAction("approve");
      if (res.status === 200) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setApproveState({
        status: "error",
        message: data?.message ?? "Something went wrong. This wasn't applied. Try again.",
      });
    } catch {
      setApproveState({ status: "error", message: "Something went wrong. This wasn't applied. Try again." });
    }
  }

  async function handleConfirmReject() {
    setRejectState({ status: "submitting" });
    try {
      // #675 fix: this used to post an empty {} body, silently dropping the
      // reason typed into the textarea just above — SubmissionCard.tsx's own
      // reject already sends { reason }; this card fell out of sync when it
      // was extracted from the old /admin/flags queue.
      const res = await postAction("reject", { reason });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setRejectState({
        status: "error",
        message: data?.message ?? "Something went wrong. This wasn't rejected. Try again.",
      });
    } catch {
      setRejectState({ status: "error", message: "Something went wrong. This wasn't rejected. Try again." });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${sourceBadge.className}`}>
            {sourceBadge.label}
          </span>
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-bone-100)] text-[var(--color-ink-500)]">
            {isRestore ? "Restore" : rename ? "Rename / move" : CHANGE_TYPE_LABEL[changeType] ?? changeType}
          </span>
          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${laneBadge.className}`}>
            {laneBadge.label}
          </span>
        </div>
        {/* created_at + run_id — a reviewer working a real queue needs to know
            whether a card is from last night's run or one from weeks ago. */}
        <p className="text-xs text-[var(--color-ink-400)]">
          {formatSubmittedAt(row.created_at)} · run {row.run_id}
        </p>
      </div>

      {/* Detail column stacks under the preview on narrow screens (mobile-
          first base rule) and sits side-by-side with it from lg: up — a
          side-by-side layout needs real width for both to stay readable, so
          this doesn't flip at md: (design/references/mobile.md). */}
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* data-testid: the preview column intentionally re-renders the
            venue's name/address/category via the real VenueCard — tests
            need to scope queries to one column or the other rather than
            asserting on now-legitimately-duplicated text. */}
        <div data-testid="proposal-detail" className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--color-ink-700)]">{venueName}</p>
          {/* Address alongside the name — recognising the actual place, not just
              matching an id, is what lets an admin judge the change at all. */}
          {venue?.address && <p className="text-xs text-[var(--color-ink-500)]">{venue.address}</p>}
          <p className="text-xs text-[var(--color-ink-400)]">{row.target_venue_id}</p>
          {rename && (
            <p className="mt-2 text-sm text-[var(--color-ink-700)]">
              {sourceBadge.label} stopped listing this place and started listing <span className="break-all">{rename.to_id}</span> at
              the same spot or phone. Approving updates this venue in place — same page and link — with the new details below.
            </p>
          )}
          {summary && <p className="mt-2 text-xs text-[var(--color-ink-500)]">{summary}</p>}

          {proposal.parseError ? (
            <p className="mt-2 text-sm text-[var(--color-clay-700)]">
              Couldn&apos;t read details for this proposal — the stored data may be malformed. You can still
              reject it below.
            </p>
          ) : source === "link_health" ? (
            <LinkHealthDetails diff={proposal.diff} />
          ) : changeType === "remove" ? (
            <RemoveDetails name={venueName} venue={venue} sourceLabel={sourceBadge.label} />
          ) : changeType === "add" ? (
            <AddDetails diff={proposal.diff} sourceLabel={sourceBadge.label} isRestore={isRestore} />
          ) : (
            <FieldDiff diff={proposal.diff} sourceLabel={sourceBadge.label} />
          )}
        </div>

        {!proposal.parseError && source !== "link_health" && (
          <div data-testid="proposal-preview" className="min-w-0 lg:w-[320px] lg:shrink-0">
            <ProposalPreview changeType={changeType} diff={proposal.diff} venue={venue} venueId={row.target_venue_id} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!proposal.parseError && source === "link_health" && (
          <Link href={`/admin/venues/${row.target_venue_id}/edit?proposal=${row.id}`} className={primaryButtonClass}>
            Review &amp; fix link
          </Link>
        )}
        {!proposal.parseError && isNewPlace && (
          <Link href={`/admin/venues/new?proposal=${row.id}`} className={primaryButtonClass}>
            Review as new place
          </Link>
        )}
        {!proposal.parseError && source !== "link_health" && !isNewPlace && changeType !== "remove" && (
          <button
            type="button"
            onClick={() => handleApprove()}
            disabled={approveState.status === "submitting"}
            className={primaryButtonClass}
          >
            {approveState.status === "submitting" ? "Applying…" : rename ? "Approve rename" : "Approve"}
          </button>
        )}
        {!proposal.parseError && changeType === "remove" && (
          <button
            type="button"
            onClick={() =>
              handleApprove(
                `Remove "${venueName}" from the map? It will stop appearing on the next publish, but its record is kept, not deleted, and this can be reviewed later.`,
              )
            }
            disabled={approveState.status === "submitting"}
            className={dangerButtonClass}
          >
            {approveState.status === "submitting" ? "Removing…" : "Archive this venue"}
          </button>
        )}
        {!rejectOpen && (
          <button type="button" onClick={() => setRejectOpen(true)} className={secondaryButtonClass}>
            Reject
          </button>
        )}
      </div>

      {approveState.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {approveState.message}
        </p>
      )}

      {rejectOpen && (
        <div className="mt-4 border-t border-[var(--color-bone-200)] pt-4">
          <label htmlFor={reasonFieldId} className={`${fieldLabelClass} mb-1 block`}>
            Reason <span className="font-normal normal-case text-[var(--color-ink-400)]">(optional, for your own notes)</span>
          </label>
          <textarea
            id={reasonFieldId}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            // text-base on mobile: iOS Safari auto-zooms on focus under 16px.
            className={
              "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm " +
              "text-[var(--color-ink-900)] bg-white placeholder:text-[var(--color-ink-400)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              "focus-visible:border-[var(--color-sage-500)]"
            }
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={rejectState.status === "submitting"}
              className={dangerButtonClass}
            >
              {rejectState.status === "submitting" ? "Rejecting…" : "Confirm reject"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false);
                setReason("");
                setRejectState({ status: "idle" });
              }}
              disabled={rejectState.status === "submitting"}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
          {rejectState.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
              {rejectState.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Per-change_type detail rows ────────────────────────────────────────────

/**
 * Renders one already-formatted field value inline — the ONE shared place
 * every field value in this queue routes through, so a `url`/`phone` field
 * reads as a real link everywhere it's shown, not just the one call site
 * Kyle happened to review (staging review: a Website value rendered as
 * inert plain text). `url` reuses `safeUrl` (src/lib/safeUrl.ts) rather
 * than a fresh regex check — the same http(s)-only allowlist guard
 * BottomSheet/DesktopVenueWindow already apply to `venue.url`, since this
 * data comes from the exact same untrusted OSM/Plentiful sources. `phone`
 * is skipped when the value is the "(empty)" sentinel formatFieldValue
 * produces for a null/undefined/empty field — a `tel:(empty)` link would be
 * worse than no link. `break-all` on the url anchor lets a long link wrap
 * instead of blowing out the card width (the same reason VenueCard's own
 * distance readout uses a fixed-width font rather than letting layout
 * jitter — different fix, same "don't let one value's length break the
 * layout" concern).
 */
function renderFieldValue(field: string | undefined, formatted: string): React.ReactNode {
  const linkClass = "break-all text-[var(--color-sage-700)] underline underline-offset-2";
  if (field === "url") {
    const href = safeUrl(formatted);
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {formatted}
        </a>
      );
    }
  }
  if (field === "phone" && formatted !== "(empty)") {
    return (
      <a href={`tel:${formatted}`} className={linkClass}>
        {formatted}
      </a>
    );
  }
  return formatted;
}

/** Plain "Label: value" row — same shape SubmissionsReviewView's own DetailRow uses, kept local since that file doesn't export it. `field` (optional) routes the value through renderFieldValue's url/phone link treatment. */
function DetailRow({ label, value, field }: { label: string; value: string; field?: string }) {
  return (
    <p className="text-sm text-[var(--color-ink-700)]">
      <span className={fieldLabelClass}>{label}: </span>
      {renderFieldValue(field, value)}
    </p>
  );
}

/**
 * `venue` (the current D1 row) is normally present — a remove proposal
 * targets a venue that still exists (that's the point) — but stays optional
 * so this never throws on a stray lookup miss. Address is NOT repeated here
 * — the card header (above this component) already shows it for every
 * non-`add` card, same source, so a second copy would just be visual noise
 * on the one card type that most needs its message to stand out. Names
 * `sourceLabel` explicitly ("OpenStreetMap no longer lists...") instead of
 * the old source-less "this source" — a reviewer with several sources in
 * the queue at once needs to know which one dropped it.
 */
function RemoveDetails({ name, venue, sourceLabel }: { name: string; venue: VenueLookup | undefined; sourceLabel: string }) {
  return (
    <div className="mt-2 space-y-1">
      {venue && <DetailRow label="Category" value={categoryLabels[venue.category as VenueCategory] ?? venue.category} />}
      <p className="text-sm text-[var(--color-ink-700)]">
        {sourceLabel} no longer lists &ldquo;{name}&rdquo;. Archiving keeps its record — it stops appearing on the
        public map but is never deleted.
      </p>
    </div>
  );
}

/**
 * No address row for the same reason RemoveDetails drops it — the card
 * header already shows it. The dead URL still renders as a real link (via
 * renderFieldValue) rather than plain text — a 404 at the last scheduled
 * check doesn't mean the site is down right now, and letting the reviewing
 * admin click through to verify before fixing anything is exactly the
 * judgment call this queue exists for.
 */
function LinkHealthDetails({ diff }: { diff: ProposedDiff }) {
  const deadUrl = typeof diff.before?.url === "string" ? diff.before.url : null;
  const httpStatus = typeof diff.meta?.http_status === "number" ? diff.meta.http_status : null;
  const checkedAt = typeof diff.meta?.checked_at === "string" ? diff.meta.checked_at : null;
  return (
    <p className="mt-2 text-sm text-[var(--color-ink-700)]">
      {deadUrl ? (
        <>
          This venue&apos;s website ({renderFieldValue("url", deadUrl)}) returned{" "}
          {httpStatus ?? "an error"} on the last check
          {checkedAt ? `, ${formatSubmittedAt(checkedAt)}` : ""}.
        </>
      ) : (
        "This venue's website was flagged as unreachable on the last check."
      )}
    </p>
  );
}

/**
 * `add` proposals (diffEngine.ts's buildProposal) always carry `before:
 * null` — there is no existing D1 row to diff against, so a before/after
 * table has nothing on the "before" side to show. The full proposed record
 * lives entirely in `diff.after`; this renders it directly, explicitly
 * marked as not yet on the public map, rather than routing it through
 * FieldDiff (which would render every field as "(empty) → value," reading
 * like a diff of a blank record instead of a new venue to review).
 */
function AddDetails({ diff, sourceLabel, isRestore }: { diff: ProposedDiff; sourceLabel: string; isRestore: boolean }) {
  const after = (diff.after ?? {}) as Partial<Venue>;
  const categoryLabel = after.category ? (categoryLabels[after.category as VenueCategory] ?? after.category) : undefined;
  const hoursSummary =
    after.hours_weekly && Object.keys(after.hours_weekly).length > 0 ? formatHoursSummary(after.hours_weekly) : undefined;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-sm font-medium text-[var(--color-clay-700)]">
        {isRestore
          ? `${sourceLabel} lists this place again — not currently shown on the map.`
          : `Found by ${sourceLabel} — not currently on the map.`}
      </p>
      {after.address && <DetailRow label="Address" value={after.address} />}
      {categoryLabel && <DetailRow label="Category" value={categoryLabel} />}
      {after.phone && <DetailRow label="Phone" value={after.phone} field="phone" />}
      {after.url && <DetailRow label="Website" value={after.url} field="url" />}
      {hoursSummary && <DetailRow label="Hours" value={hoursSummary} />}
    </div>
  );
}

function FieldDiff({ diff, sourceLabel }: { diff: ProposedDiff; sourceLabel: string }) {
  // last_verified is a pure freshness stamp, not a field an admin needs to
  // eyeball in a before/after table — every add/update proposal carries it,
  // so showing it as a full diff row would visually bury the field that
  // actually matters. A freshness-only proposal (fields_changed ===
  // ["last_verified"]) gets its own short-circuit message instead. `id` is
  // excluded too (an `add` proposal's fields_changed always includes it,
  // straight off Object.keys(incoming venue) in diffEngine.ts) — the card
  // header already shows the target id directly under the venue name.
  // reviewableDiffFields (adminProposals.ts) is the shared selection —
  // NeedsDecisionPanel.tsx's compact diff summary reads the same set.
  const reviewFields = reviewableDiffFields(diff);

  if (reviewFields.length === 0) {
    // WHY name the source and date rather than the old source-less
    // "Confirmed still present at the source": that sentence is this
    // card's ENTIRE information content on a freshness-only proposal (the
    // common case in a real run) — omitting who checked and when left
    // nothing for a reviewer to actually verify.
    const verifiedAt = typeof diff.after?.last_verified === "string" ? diff.after.last_verified : undefined;
    return (
      <p className="mt-2 text-sm text-[var(--color-ink-500)]">
        Confirmed still present by {sourceLabel}
        {verifiedAt ? ` on ${formatLastVerified(verifiedAt)}` : ""} — no other details changed.
      </p>
    );
  }

  const before = (diff.before ?? {}) as Record<string, unknown>;
  const after = (diff.after ?? {}) as Record<string, unknown>;

  return (
    <dl className="mt-2 space-y-1.5">
      {reviewFields.map((field) => (
        <div key={field} className="text-sm">
          <dt className={fieldLabelClass}>{fieldLabel(field)}</dt>
          <dd className="text-[var(--color-ink-700)]">
            {/* Only the "after" (resulting) value becomes a link — the
                struck-through "before" value is being replaced, not
                something worth clicking through to. */}
            <span className="text-[var(--color-clay-700)] line-through decoration-1">
              {formatFieldValue(field, before[field])}
            </span>{" "}
            <span aria-hidden>→</span>{" "}
            <span className="font-medium text-[var(--color-sage-700)]">
              {renderFieldValue(field, formatFieldValue(field, after[field]))}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Right-hand preview: the real public venue card, fed proposed data ────

/**
 * Builds the Venue object handed to the real VenueCard for the preview
 * column — `after` merged OVER the current venue so an `update` proposal
 * shows the RESULTING card, not today's. `add` proposals carry a full
 * `after` record already (diffEngine.ts's buildProposal never emits a
 * partial add); `remove` calls this with `after: null` (a remove proposal
 * carries no field diff — diffEngine always writes `fields_changed: []` for
 * it) to preview today's card unmodified, with the "will disappear" framing
 * handled entirely by the caller, not here.
 *
 * Only `name`/`category`/`address` are required to return a real Venue —
 * the three fields VenueCard actually renders. `lat`/`lng`/`source`/
 * `last_verified` are required by the Venue TYPE but never read by
 * VenueCard's own render, so a missing value there defaults rather than
 * blocking the whole preview — an `add` proposal's diff, for instance,
 * doesn't carry `source` (only `change_proposals.source`, a different
 * column, does), and there's no existing venue row for a brand-new venue to
 * fall back to.
 *
 * Returns null when even that minimum isn't met (a stray lookup miss on an
 * `update`/`remove`, or a malformed proposal) — same fail-soft posture as
 * this file's other per-row defensive branches (parseError, RemoveDetails'
 * optional venue) rather than crashing the card on bad data.
 */
function buildPreviewVenue(venue: VenueLookup | undefined, after: Partial<Venue> | null | undefined, id: string): Venue | null {
  const base: Partial<Venue> = venue
    ? {
        id,
        name: venue.name,
        category: venue.category as VenueCategory,
        lat: venue.lat,
        lng: venue.lng,
        address: venue.address,
        hours_weekly: venue.hours_weekly ?? undefined,
        accepts_snap: venue.accepts_snap,
        accepts_wic: venue.accepts_wic,
        phone: venue.phone ?? undefined,
        url: venue.url ?? undefined,
        source: venue.source,
        last_verified: venue.last_verified,
      }
    : {};
  const merged: Partial<Venue> = { ...base, ...(after ?? {}), id };

  if (!merged.name || !merged.category || !merged.address) return null;

  return {
    ...merged,
    name: merged.name,
    category: merged.category,
    address: merged.address,
    lat: merged.lat ?? 0,
    lng: merged.lng ?? 0,
    source: merged.source ?? "",
    last_verified: merged.last_verified ?? "",
  } as Venue;
}

/**
 * Right-hand preview panel — Kyle's staging review: "it would be nice if
 * there was a full preview on the right hand side that showed what the new
 * venue card was going to look like. easier to catch errors that way."
 * Renders the SAME public VenueCard component src/components/ListView.tsx
 * uses for the real /list row, fed buildPreviewVenue()'s merged data — not
 * a hand-rolled lookalike, so what an admin sees here is exactly what the
 * public map renders once approved.
 *
 * `inert` (not just visual dimming) on the wrapping `<ul>`: VenueCard's
 * root is a real focusable `<button>` — leaving it focusable while visually
 * inert would be a keyboard trap to a control that does nothing, and
 * `aria-hidden` on a focusable descendant is the WCAG anti-pattern the
 * native `inert` attribute exists specifically to avoid (it removes the
 * subtree from focus AND the accessibility tree together). This preview is
 * context, not a second set of controls — Approve/Reject below stay the
 * card's only actions.
 */
function ProposalPreview({
  changeType,
  diff,
  venue,
  venueId,
}: {
  changeType: ProposalChangeType;
  diff: ProposedDiff;
  venue: VenueLookup | undefined;
  venueId: string;
}) {
  const isRemove = changeType === "remove";
  const previewVenue = buildPreviewVenue(venue, isRemove ? null : diff.after, venueId);

  return (
    <div>
      <p className={`${fieldLabelClass} mb-2`}>Preview — public map</p>
      {previewVenue ? (
        <ul
          inert
          className={
            "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white " +
            (isRemove ? "opacity-50 grayscale" : "")
          }
        >
          <VenueCard venue={previewVenue} isSelected={false} onClick={() => {}} headingLevel={3} />
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-ink-500)]">Not enough data to preview this change.</p>
      )}
      {isRemove && previewVenue && (
        <p className="mt-2 text-sm font-medium text-[var(--color-clay-700)]">
          This venue will no longer appear on the public map.
        </p>
      )}
    </div>
  );
}
