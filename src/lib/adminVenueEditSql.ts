/**
 * adminVenueEditSql.ts — the SQL behind PATCH /api/admin/venues/[id].
 *
 * Lives outside the route file so src/lib/adminVenueEditSql.sql.test.ts can run
 * these exact statements against real SQLite (#265): Next route files may only
 * export route handlers. See the route file's header for the concurrency design.
 */

// Every editable column except `status` (see file header for why status is
// permanently excluded) and the workflow columns an edit never touches:
// source_type, created_at, created_by, published_at, published_by.
// #265: `AND updated_at = ?` is the optimistic-concurrency precondition —
// see this file's own header. The last bound param is the expected value,
// NOT the new one (that's already bound as `updated_at = ?` above it).
export const VENUE_UPDATE_SQL = `UPDATE venues SET
  name = ?, category = ?, lat = ?, lng = ?, address = ?, hours_weekly = ?,
  accepts_snap = ?, accepts_wic = ?, phone = ?, email = ?, url = ?, notes = ?,
  operator = ?, source = ?, last_verified = ?, outside_county = ?,
  updated_by = ?, updated_at = ?
  WHERE id = ? AND updated_at = ?`;

// #265: SELECT-form (not VALUES) so the WHERE EXISTS guard can skip the
// insert entirely when the venue UPDATE above didn't actually apply — see
// this file's own header for why EXISTS-against-venues, not changes().
// Trailing two bind params (id, the NEW updatedAt) are the guard.
export const AUDIT_INSERT_SQL = `INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp)
  SELECT ?, ?, ?, ?, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)`;

// Blessing Boxes slice 1: an edit keeps the invariant "a blessing_boxes row
// exists iff venues.category = 'blessing_box'". DELETE-then-INSERT (rather
// than SQLite's ON CONFLICT upsert syntax) covers both the ordinary
// box-edit case and the "admin changed this venue's category AWAY FROM
// blessing_box" cleanup case in the same two statements — but ONLY when the
// edit actually touches a box, either direction (see needsBoxTouch below).
// Every ordinary non-box edit must add zero statements to the batch — the
// pre-existing #255/#390 tests assert an exact 2/3-statement shape for
// pantry/garden/etc. edits, and a box row that never existed has nothing to
// delete.
// #265: both guarded the same way as AUDIT_INSERT_SQL — a stale (rejected)
// edit must not delete or reinsert the box row using the stale editor's
// submitted fields. Trailing two bind params again (id, new updatedAt).
export const BOX_DELETE_SQL =
  "DELETE FROM blessing_boxes WHERE venue_id = ? AND EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)";
export const BOX_INSERT_SQL = `INSERT INTO blessing_boxes (venue_id, host_name, host_note, host_contact, most_needed, installed_on, removed_on)
  SELECT ?, ?, ?, ?, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)`;

// #265: this route's OWN guarded variant of boxEvents.ts's shared
// BOX_EVENT_INSERT_SQL — that constant stays unconditional (POST
// /api/admin/venues, the create route, has no existing row to guard
// against and imports it unmodified). A stale edit must not log a
// lifecycle event ("renamed", "moved", ...) for a change that was never
// actually written. Trailing two bind params, same guard shape as above.
export const BOX_EVENT_INSERT_SQL_GUARDED = `INSERT INTO box_events (venue_id, kind, detail, created_at)
  SELECT ?, ?, ?, ?
  WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)`;

// ponytail: AND status = 'pending' is a deliberate idempotency ceiling, not
// an oversight — same shape as public_submissions' own approve statements
// (see this file's header + ARCHITECTURE.md "Admin panel"). A
// double-approve affects 0 rows here and is silently a no-op on the
// proposal side. #265 adds a second guard (AND EXISTS ...) so a STALE edit
// can't mark the proposal approved for a fix that was never actually
// written either — trailing two bind params, same shape as the box/audit
// statements above.
export const APPROVE_PROPOSAL_SQL = `UPDATE change_proposals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, applied_at = ?
  WHERE id = ? AND status = 'pending' AND source = 'link_health' AND target_venue_id = ?
  AND EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)`;
