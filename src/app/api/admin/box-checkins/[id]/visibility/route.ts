/**
 * POST /api/admin/box-checkins/[id]/visibility — hide/unhide a check-in
 * (Blessing Boxes slice 2, Discovery C7/C9: "As the admin, I want to hide
 * any check-in or note after the fact, so spam and fake 'empty' reports
 * can be cleaned up").
 *
 * Same auth pair, same shape, as every other admin mutation in this app
 * (see AGENTS.md "Admin authentication" / POST /api/admin/venues/[id]/archive):
 * getAdminDb() (Better Auth session) then requireAdminOrigin() (CSRF).
 *
 * WHY action='update' rather than a new audit_log.action enum value: this
 * slice's acceptance criteria require every hide/unhide to go through the
 * EXISTING audit_log path — that table's `action` CHECK constraint
 * (migrations/0001) only allows 'create'/'update'/'publish'/'archive'.
 * Widening it for one new value would be a full SQLite table rebuild (the
 * same recipe migrations/0005 needed for venues.category), which is a
 * disproportionate schema change for a single enum member when 'update' is
 * already an exact semantic fit — a check-in's visibility column simply
 * changed. `entity='box_checkin'` (a new entity string, no schema change
 * needed — that column is a plain TEXT, not a CHECK-constrained enum) and
 * before_json/after_json carry the actual visibility flip, so the audit
 * trail is still fully queryable and readable; nothing about WHO/WHEN/WHAT
 * changed is lost.
 *
 * No permission levels (Kyle's decision, Discovery §"Decisions Kyle has
 * made"): any admin can hide/unhide any check-in — the audit_log row IS the
 * accountability mechanism, not a role check.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/adminOrigin";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";

interface BoxCheckinRow {
  id: number;
  venue_id: string;
  kind: string;
  note: string | null;
  visibility: "visible" | "hidden";
  hidden_by: string | null;
  hidden_at: string | null;
  created_at: string;
}

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

async function authorizeVisibilityRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeVisibilityRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id: rawId } = await params;
  const checkinId = Number(rawId);
  if (!Number.isInteger(checkinId) || checkinId <= 0) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const visibility = (body as { visibility?: unknown })?.visibility;
  if (visibility !== "visible" && visibility !== "hidden") {
    return NextResponse.json({ ok: false, error: "Invalid visibility" }, { status: 422 });
  }

  const existing = await db.prepare("SELECT * FROM box_checkins WHERE id = ?").bind(checkinId).first<BoxCheckinRow>();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const timestamp = new Date().toISOString();
  const hiddenBy = visibility === "hidden" ? identity.email : null;
  const hiddenAt = visibility === "hidden" ? timestamp : null;
  const afterRow: BoxCheckinRow = { ...existing, visibility, hidden_by: hiddenBy, hidden_at: hiddenAt };

  const updateCheckin = db
    .prepare("UPDATE box_checkins SET visibility = ?, hidden_by = ?, hidden_at = ? WHERE id = ?")
    .bind(visibility, hiddenBy, hiddenAt, checkinId);
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "box_checkin",
      String(checkinId),
      "update",
      JSON.stringify(existing),
      JSON.stringify(afterRow),
      timestamp,
    );

  // Atomic: the visibility flip and its own audit trail land together or not at all — same convention as every other admin mutation in this app.
  await db.batch([updateCheckin, insertAudit]);

  return NextResponse.json({ ok: true, id: checkinId, visibility });
}
