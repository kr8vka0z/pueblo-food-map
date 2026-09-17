/**
 * boxEvents.ts — pure helpers computing which box_events lifecycle rows an
 * admin's create/edit write should insert (Blessing Boxes slice 3,
 * migrations/0008_box_events.sql).
 *
 * WHY these are pure functions the two admin routes call, rather than logic
 * living inline in each route.ts: same lib/route split every other admin
 * mutation in this app already uses (adminVenueValidation.ts's own header
 * names the precedent) — testable against plain fixtures, no D1 needed.
 *
 * WHY archiving a box (POST /api/admin/venues/[id]/archive) writes NO
 * box_events row at all, even though it's a real lifecycle transition:
 * every read of this table (src/lib/boxActivity.ts's UNION ALL) joins
 * venues on `category = 'blessing_box' AND status != 'archived'` — the
 * same filter SELECT_LIVE_BOXES_SQL already uses (blessingBoxes.ts) — so a
 * 'removed' row written at the exact moment a box is archived would vanish
 * from every public read the instant it's written, self-defeating the
 * point of recording it. The archive route is therefore left completely
 * unmodified by this slice. The same reasoning applies to an edit that
 * changes a box's category AWAY from 'blessing_box' (see
 * computeBoxEventWrites' own header below) — that path is reachable
 * through PATCH, so it's handled explicitly here rather than by omission.
 */

export type BoxEventKind = "added" | "moved" | "renamed" | "paused" | "removed";

/** Mirrors migrations/0008_box_events.sql's `kind` CHECK constraint exactly. */
export const BOX_EVENT_KINDS: readonly BoxEventKind[] = ["added", "moved", "renamed", "paused", "removed"];

export const BOX_EVENT_INSERT_SQL = "INSERT INTO box_events (venue_id, kind, detail, created_at) VALUES (?, ?, ?, ?)";

export interface BoxEventWrite {
  kind: BoxEventKind;
  detail: string | null;
}

/** The subset of a create/edit's validated fields this module needs to diff — narrower than ValidatedVenueFields so a caller never has to construct the full shape just to call these functions. */
interface CandidateBoxFields {
  name: string;
  address: string;
  box: { removedOn: string | null } | null;
}

/**
 * POST /api/admin/venues (create): a brand-new blessing_box always gets
 * exactly one 'added' event, detail null — there is no "before" row to
 * diff against, so there's nothing more specific to say than "this box now
 * exists." Every other category gets none.
 */
export function boxEventsForCreate(fields: CandidateBoxFields): BoxEventWrite[] {
  return fields.box !== null ? [{ kind: "added", detail: null }] : [];
}

/**
 * The pre-edit facts computeBoxEventWrites needs, distinct from the full
 * AdminVenueRow — kept narrow so a caller can build this from a plain
 * venues SELECT plus one extra blessing_boxes.removed_on lookup (see
 * PATCH /api/admin/venues/[id]'s own call site) with no adapter.
 */
export interface ExistingBoxEventContext {
  category: string;
  name: string;
  address: string;
  /** blessing_boxes.removed_on as it stood BEFORE this edit — null when the venue wasn't a box a moment ago (no row existed to read) or the box was never marked removed. */
  removedOn: string | null;
}

const isSet = (v: string | null): boolean => v !== null && v.trim() !== "";

/**
 * PATCH /api/admin/venues/[id] (edit): diffs the pre-edit row against the
 * validated payload and returns every lifecycle event this specific save
 * implies — zero, one, or several (a rename AND an address change land in
 * the same save both get their own row, since both really happened).
 *
 * WHY "becoming a box for the first time" short-circuits to a single
 * 'added' event rather than ALSO diffing name/address: there is no real
 * "before" for a box that wasn't one a moment ago — "Old Name" -> "New
 * Name" on a venue that was a plain pantry a second ago isn't a box being
 * renamed, it's a box being created with whatever name/address it happens
 * to already carry. Mirrors boxEventsForCreate's own single-event shape.
 *
 * WHY a category change AWAY from blessing_box writes nothing: same
 * self-defeating-join reasoning as archiving (this file's own header) — a
 * 'removed' row here would never be readable, since the venue no longer
 * matches boxActivity.ts's `category = 'blessing_box'` join filter the
 * instant this same edit commits.
 *
 * WHY removed_on clearing (a box coming back into service) writes nothing:
 * there is no event kind for it in migrations/0008's CHECK constraint —
 * the Build Plan's activity log lists only added/moved/renamed/paused/
 * removed, and "un-removed" isn't one of them. A future slice that wants
 * this needs a schema change, not a code change here.
 */
export function computeBoxEventWrites(
  existing: ExistingBoxEventContext,
  fields: CandidateBoxFields,
): BoxEventWrite[] {
  const wasBox = existing.category === "blessing_box";
  const isBox = fields.box !== null;

  if (!wasBox && isBox) return [{ kind: "added", detail: null }];
  if (!wasBox || !isBox) return []; // never a box, or leaving box-hood — see header above

  // ponytail: this is a raw string-difference check, not a real "did the
  // location/name meaningfully change" check — correcting a typo in an
  // address (e.g. a missing comma) reads as a public "moved" event, and
  // likewise for a name spelling fix. Case-insensitive equality (below) is
  // the one free guard available here (both sides are already trimmed by
  // adminVenueValidation.ts before this function ever sees them, so a pure
  // case fix — "Main St" -> "main st" — is caught for free); a genuine
  // typo fix in the same case still fires. Ceiling: no diff-distance/
  // normalization here, and none should be added casually — the upgrade
  // path, if this ever matters enough, is asking the admin to confirm
  // "is this a real move?" on save rather than inferring it from the diff.
  const events: BoxEventWrite[] = [];
  if (existing.name.toLowerCase() !== fields.name.toLowerCase()) {
    events.push({ kind: "renamed", detail: `${existing.name} → ${fields.name}` });
  }
  if (existing.address.toLowerCase() !== fields.address.toLowerCase()) {
    events.push({ kind: "moved", detail: `${existing.address} → ${fields.address}` });
  }
  const wasRemoved = isSet(existing.removedOn);
  const isRemoved = isSet(fields.box!.removedOn);
  if (!wasRemoved && isRemoved) {
    events.push({ kind: "removed", detail: fields.box!.removedOn });
  }
  return events;
}
