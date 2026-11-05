/**
 * POST /api/admin/event-submissions/[id]/convert — "Make it a draft event"
 * (#883): turns a pending public submission into a DRAFT event (never
 * published) and marks the submission converted, atomically
 * (convertToDraft in src/lib/eventSubmissions.ts). The flyer is copied
 * onto the new event.
 *
 * Location: when the sender picked a checked address on the public form,
 * its stored pin is used as is (re-checked to be inside Pueblo County) and
 * the geocoder is not called. Otherwise the typed address is geocoded here with the same Census lookup
 * as the forms' "Find location". An events row needs coordinates (lat/lng
 * are NOT NULL, migration 0018), so when the lookup fails or is ambiguous
 * (not exactly one match) nothing is written: the answer is 422
 * `needs_location` with `openUrl`, the "Add event" form prefilled from this
 * submission (address filled, pin unset). Saving that form converts the
 * submission the same atomic way (POST /api/admin/events with
 * `submission_id`).
 *
 * Auth: authorizeAdminWrite (session, then requireAdminOrigin) before
 * anything is read.
 */

import { NextResponse, type NextRequest } from "next/server";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeAdminWrite, type AdminDbAccess } from "@/lib/adminDb";
import { geocodeAddress } from "@/lib/censusGeocode";
import { puebloPin } from "@/lib/adminEventValidation";
import { convertToDraft, draftFromPayload, loadPendingEventSubmission, parseSubmissionPayload } from "@/lib/eventSubmissions";

export const dynamic = "force-dynamic";

const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, message, ...extra }, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeAdminWrite(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id } = await params;

  const sub = await loadPendingEventSubmission(db, id);
  if (!sub) return fail(404, "not_found", "This event was already handled, or doesn't exist.");
  const payload = parseSubmissionPayload(sub.payload);
  if (!payload) return fail(422, "unreadable", "This submission can't be read. Dismiss it instead.");

  const openUrl = `/admin/events/new?from=${encodeURIComponent(sub.id)}`;
  let place = puebloPin(payload.lat, payload.lng);
  if (!place) {
    try {
      const matches = await geocodeAddress(payload.address);
      if (matches.length === 1) place = matches[0];
    } catch {
      // Lookup down: same as no match — the admin places it in the form.
    }
  }
  if (!place) {
    return fail(422, "needs_location", "We couldn't find this address on the map. Place it in the event form.", { openUrl });
  }

  const eventId = crypto.randomUUID();
  const failed = await convertToDraft(db, identity, sub, draftFromPayload(eventId, payload, place, identity.email, new Date().toISOString()));
  if (failed) return failed;
  return NextResponse.json({ ok: true, id: eventId, editUrl: `/admin/events/${eventId}/edit?saved=1` });
}
