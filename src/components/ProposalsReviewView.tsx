"use client";

/**
 * ProposalsReviewView — the /admin/flags review queue's card list. Rendered
 * by src/app/admin/flags/page.tsx, which owns the auth gate and the
 * `SELECT ... WHERE status = 'pending' ORDER BY created_at DESC` read; this
 * component is presentational + interactive only, same
 * Server-Component-data / Client-Component-action split as
 * SubmissionsReviewView (the closest sibling — this component mirrors its
 * card-list shape, reject-with-reason flow, and per-row error handling
 * closely rather than inventing new UI conventions).
 *
 * Cards, not a dense table — a proposal carries a variable-shape field diff
 * that a fixed set of table columns can't represent cleanly (same reasoning
 * SubmissionsReviewView's own header gives for submissions vs.
 * VenueListView's dense table).
 *
 * Filterable by source and change_type (client-side, plain array filters —
 * the queue's own SELECT already scopes to `status = 'pending'`, so
 * "filterable in a way that makes a 100+ row queue workable" only needs
 * these two dimensions narrowed further, not a second D1 round trip).
 *
 * Three change_type shapes, each with its own action affordance:
 *   - `remove`: the dangerous kind. Never a single click — a native
 *     window.confirm() gate (same convention ArchiveVenueButton.tsx already
 *     established) before POSTing approve, and the danger (`--color-danger`)
 *     button styling that action already owns on this admin surface.
 *   - `add` / `update`: a plain sage "Approve" button — non-destructive
 *     field edits or a new draft row, POSTs approve directly.
 *   - `link_health` proposals (always change_type "update" from diffEngine,
 *     but source-gated, not change_type-gated, here): NO Approve button at
 *     all — "a dead-link finding is not a field edit to blindly apply"
 *     (the issue's own instruction). A "Review & fix link" navigation Link
 *     to the venue's edit screen instead
 *     (/admin/venues/<id>/edit?proposal=<id>, resolved server-side by that
 *     page's resolveLinkHealthProposalContext()) — POST
 *     /api/admin/proposals/[id]/approve independently enforces this same
 *     rule (400 on a link_health source), so this is defense-in-depth, not
 *     the only guard.
 *
 * Reject (every kind) — POST /api/admin/proposals/<id>/reject — mirrors
 * SubmissionsReviewView's reject-with-optional-reason flow exactly.
 *
 * A 409 `{error: "stale", message}` response from either action (the
 * supersede-race / stale-apply correctness requirements —
 * src/app/api/admin/proposals/[id]/approve/route.ts's own header) surfaces
 * that `message` inline on the card rather than a generic failure string —
 * the one place this queue's error handling diverges from
 * SubmissionsReviewView's, which has no equivalent staleness concept.
 *
 * On any successful action, router.refresh() re-runs the Server Component's
 * query — the acted-on card simply stops matching `status = 'pending'` and
 * disappears from the next render.
 *
 * Detail rendering (usability fix, staging review): Kyle's verdict on
 * staging was "How am I supposed to tell what the change is? There's no
 * detail" — a card could name a venue and a changing field but gave no way
 * to judge the change against the real place. Fixed by widening
 * page.tsx's venueLookup (name/status only -> + category/address/phone/
 * url/last_verified) and adding a distinct detail renderer per
 * change_type: `AddDetails` shows the full proposed record for a venue
 * that isn't on the map yet (diff.after is the only source of truth —
 * venueLookup has nothing to show), `RemoveDetails` now states which
 * source stopped listing the place alongside its current address/category,
 * and `FieldDiff`'s freshness-only branch now names the confirming source
 * and date instead of a source-less "still present" sentence. Hours values
 * everywhere route through @/lib/hours' formatSlot so an admin reads
 * "9am – 5pm," never a raw "09:00-17:00" or a JSON blob.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { formatLastVerified } from "@/lib/adminVenues";
import { formatSlot } from "@/lib/hours";
import type { Venue, VenueCategory, WeeklyHours } from "@/types/venue";
import type { ParsedProposal, ProposalChangeType, ProposalSourceValue, ProposedDiff } from "@/lib/adminProposals";
import type { VenueLookup } from "@/app/admin/flags/page";

export interface ProposalsReviewViewProps {
  proposals: ParsedProposal[];
  venueLookup: Record<string, VenueLookup>;
}

// ─── Shared styling (reuses existing DESIGN.md tokens — no new ones) ───────

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

const SOURCE_BADGE: Record<ProposalSourceValue, { label: string; className: string }> = {
  osm: { label: "OpenStreetMap", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  plentiful: { label: "Plentiful", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  gtfs: { label: "GTFS", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  link_health: { label: "Broken link", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
};

const CHANGE_TYPE_LABEL: Record<ProposalChangeType, string> = {
  add: "New venue",
  update: "Field update",
  remove: "Remove",
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-500)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 " +
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

const filterChipClass = (active: boolean) =>
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 " +
  (active
    ? "border-[var(--color-sage-500)] bg-[var(--color-sage-100)] text-[var(--color-sage-700)]"
    : "border-[var(--color-bone-300)] text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)]");

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

function fieldLabel(field: string): string {
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

/** Renders one Venue field's value for the diff view — hours_weekly gets a compact per-day summary, everything else stringifies plainly. Empty/null/undefined renders as an explicit "(empty)" so a real value clearing to nothing reads clearly, not as a blank cell. */
function formatFieldValue(field: string, value: unknown): string {
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

type SourceFilter = "all" | ProposalSourceValue;
type ChangeTypeFilter = "all" | ProposalChangeType;

export default function ProposalsReviewView({ proposals, venueLookup }: ProposalsReviewViewProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeTypeFilter>("all");

  const presentSources = useMemo(
    () => [...new Set(proposals.map((p) => p.row.source))] as ProposalSourceValue[],
    [proposals],
  );
  const presentChangeTypes = useMemo(
    () => [...new Set(proposals.map((p) => p.row.change_type))] as ProposalChangeType[],
    [proposals],
  );

  const filtered = proposals.filter((p) => {
    if (sourceFilter !== "all" && p.row.source !== sourceFilter) return false;
    if (changeTypeFilter !== "all" && p.row.change_type !== changeTypeFilter) return false;
    return true;
  });

  if (proposals.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-16 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">No proposals to review</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          Changes found by the automated venue-refresh pipeline will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(presentSources.length > 1 || presentChangeTypes.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSourceFilter("all")} className={filterChipClass(sourceFilter === "all")}>
            All sources
          </button>
          {presentSources.map((source) => (
            <button key={source} type="button" onClick={() => setSourceFilter(source)} className={filterChipClass(sourceFilter === source)}>
              {SOURCE_BADGE[source]?.label ?? source}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--color-bone-300)]" aria-hidden />
          <button
            type="button"
            onClick={() => setChangeTypeFilter("all")}
            className={filterChipClass(changeTypeFilter === "all")}
          >
            All change types
          </button>
          {presentChangeTypes.map((ct) => (
            <button key={ct} type="button" onClick={() => setChangeTypeFilter(ct)} className={filterChipClass(changeTypeFilter === ct)}>
              {CHANGE_TYPE_LABEL[ct] ?? ct}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-[var(--color-ink-500)]">
        {filtered.length} of {proposals.length} pending {proposals.length === 1 ? "proposal" : "proposals"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-10 text-center">
          <p className="text-sm text-[var(--color-ink-500)]">No proposals match this filter.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((proposal) => (
            <li key={proposal.row.id}>
              <ProposalCard proposal={proposal} venueLookup={venueLookup} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── One card + its own local action state ─────────────────────────────────

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

function ProposalCard({
  proposal,
  venueLookup,
}: {
  proposal: ParsedProposal;
  venueLookup: Record<string, VenueLookup>;
}) {
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

  const targetVenue = venueLookup[row.target_venue_id];
  const afterName = !proposal.parseError && typeof proposal.diff.after?.name === "string" ? proposal.diff.after.name : undefined;
  const beforeName = !proposal.parseError && typeof proposal.diff.before?.name === "string" ? proposal.diff.before.name : undefined;
  const venueName = targetVenue?.name ?? afterName ?? beforeName ?? row.target_venue_id;
  const isRestore = changeType === "add" && targetVenue?.status === "archived";

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
      const res = await postAction("reject");
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
            {isRestore ? "Restore" : CHANGE_TYPE_LABEL[changeType] ?? changeType}
          </span>
        </div>
        {/* created_at + run_id — a reviewer working a real queue needs to know
            whether a card is from last night's run or one from weeks ago. */}
        <p className="text-xs text-[var(--color-ink-400)]">
          {formatSubmittedAt(row.created_at)} · run {row.run_id}
        </p>
      </div>

      <div className="mt-3">
        <p className="text-base font-semibold text-[var(--color-ink-700)]">{venueName}</p>
        {/* Address alongside the name — recognising the actual place, not just
            matching an id, is what lets an admin judge the change at all. */}
        {targetVenue?.address && (
          <p className="text-xs text-[var(--color-ink-500)]">{targetVenue.address}</p>
        )}
        <p className="text-xs text-[var(--color-ink-400)]">{row.target_venue_id}</p>

        {proposal.parseError ? (
          <p className="mt-2 text-sm text-[var(--color-clay-700)]">
            Couldn&apos;t read details for this proposal — the stored data may be malformed. You can still reject
            it below.
          </p>
        ) : source === "link_health" ? (
          <LinkHealthDetails diff={proposal.diff} />
        ) : changeType === "remove" ? (
          <RemoveDetails name={venueName} venue={targetVenue} sourceLabel={sourceBadge.label} />
        ) : changeType === "add" ? (
          <AddDetails diff={proposal.diff} sourceLabel={sourceBadge.label} isRestore={isRestore} />
        ) : (
          <FieldDiff diff={proposal.diff} sourceLabel={sourceBadge.label} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!proposal.parseError && source === "link_health" && (
          <Link href={`/admin/venues/${row.target_venue_id}/edit?proposal=${row.id}`} className={primaryButtonClass}>
            Review &amp; fix link
          </Link>
        )}
        {!proposal.parseError && source !== "link_health" && changeType !== "remove" && (
          <button
            type="button"
            onClick={() => handleApprove()}
            disabled={approveState.status === "submitting"}
            className={primaryButtonClass}
          >
            {approveState.status === "submitting" ? "Applying…" : "Approve"}
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
            className={
              "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-sm " +
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

/** Plain "Label: value" row — same shape SubmissionsReviewView's own DetailRow uses, kept local since that file doesn't export it. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-[var(--color-ink-700)]">
      <span className={fieldLabelClass}>{label}: </span>
      {value}
    </p>
  );
}

/**
 * `venue` (the current D1 row, from page.tsx's widened venueLookup) is
 * normally present — a remove proposal targets a venue that still exists
 * (that's the point) — but stays optional so this never throws on a stray
 * lookup miss. Address is NOT repeated here — the card header (above this
 * component) already shows it for every non-`add` card, same source, so a
 * second copy would just be visual noise on the one card type that most
 * needs its message to stand out. Names `sourceLabel` explicitly
 * ("OpenStreetMap no longer lists...") instead of the old source-less "this
 * source" — a reviewer with several sources in the queue at once needs to
 * know which one dropped it.
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

/** No address row for the same reason RemoveDetails drops it — the card header already shows it. */
function LinkHealthDetails({ diff }: { diff: ProposedDiff }) {
  const deadUrl = typeof diff.before?.url === "string" ? diff.before.url : null;
  const httpStatus = typeof diff.meta?.http_status === "number" ? diff.meta.http_status : null;
  const checkedAt = typeof diff.meta?.checked_at === "string" ? diff.meta.checked_at : null;
  return (
    <p className="mt-2 text-sm text-[var(--color-ink-700)]">
      {deadUrl ? (
        <>
          This venue&apos;s website (<span className="break-all">{deadUrl}</span>) returned{" "}
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
      {after.phone && <DetailRow label="Phone" value={after.phone} />}
      {after.url && <DetailRow label="Website" value={after.url} />}
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
  const reviewFields = diff.fields_changed.filter((f) => f !== "last_verified" && f !== "id");

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
            <span className="text-[var(--color-clay-700)] line-through decoration-1">
              {formatFieldValue(field, before[field])}
            </span>{" "}
            <span aria-hidden>→</span>{" "}
            <span className="font-medium text-[var(--color-sage-700)]">{formatFieldValue(field, after[field])}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
