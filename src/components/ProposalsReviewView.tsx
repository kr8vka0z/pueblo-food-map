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
 *
 * Website/phone links (usability fix, second staging review pass): a
 * Website value used to render as inert plain text — `renderFieldValue()`
 * is the ONE shared place every field value routes through (DetailRow,
 * FieldDiff's after value, LinkHealthDetails' dead-link banner) so a url/
 * phone field reads as a real link everywhere this queue shows one, not
 * just the one spot Kyle happened to review.
 *
 * Right-hand preview (`ProposalPreview`, same review pass — Kyle: "it would
 * be nice if there was a full preview on the right hand side that showed
 * what the new venue card was going to look like. easier to catch errors
 * that way"): renders the REAL public VenueCard component
 * (src/components/VenueCard.tsx, the same one src/components/ListView.tsx
 * uses) fed `buildPreviewVenue()`'s merge of the proposal's `after` diff
 * over the current venueLookup row — not a hand-rolled lookalike, so what
 * an admin sees here is exactly what the public map renders once approved,
 * not an approximation of it. `remove` previews today's card (a remove
 * proposal carries no field diff) under a dimmed `inert` treatment plus a
 * real (non-hidden) sentence explaining the outcome — Kyle's own
 * instruction was explicit that a normal-looking card here would
 * misrepresent what happens on approval. `link_health` never reaches this
 * component (routed to the venue edit screen instead, see the card's own
 * action row below) — a dead-link finding has no proposed field change to
 * preview, and the edit screen IS the real, richer place to inspect it.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { formatLastVerified } from "@/lib/adminVenues";
import { formatSlot } from "@/lib/hours";
import { safeUrl } from "@/lib/safeUrl";
import VenueCard from "@/components/VenueCard";
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
          {targetVenue?.address && (
            <p className="text-xs text-[var(--color-ink-500)]">{targetVenue.address}</p>
          )}
          <p className="text-xs text-[var(--color-ink-400)]">{row.target_venue_id}</p>

          {proposal.parseError ? (
            <p className="mt-2 text-sm text-[var(--color-clay-700)]">
              Couldn&apos;t read details for this proposal — the stored data may be malformed. You can still
              reject it below.
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

        {!proposal.parseError && source !== "link_health" && (
          <div data-testid="proposal-preview" className="min-w-0 lg:w-[320px] lg:shrink-0">
            <ProposalPreview changeType={changeType} diff={proposal.diff} venue={targetVenue} venueId={row.target_venue_id} />
          </div>
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
 * column — `after` merged OVER the current venueLookup row so an `update`
 * proposal shows the RESULTING card, not today's. `add` proposals carry a
 * full `after` record already (diffEngine.ts's buildProposal never emits a
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
 * column, does), and there's no existing venueLookup row for a brand-new
 * venue to fall back to.
 *
 * Returns null when even that minimum isn't met (a stray venueLookup miss
 * on an `update`/`remove`, or a malformed proposal) — same fail-soft
 * posture as this file's other per-row defensive branches (parseError,
 * RemoveDetails' optional venue) rather than crashing the card on bad data.
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
