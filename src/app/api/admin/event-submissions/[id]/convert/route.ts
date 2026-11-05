/**
 * POST /api/admin/event-submissions/[id]/convert — "Make it a draft event"
 * (#883): turns a pending public submission into a DRAFT event (never
 * published) and marks the submission converted, atomically
 * (commitConversion in src/lib/eventSubmissions.ts). The flyer is copied
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
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { authorizeAdminWrite, type AdminDbAccess } from "@/lib/adminDb";
import { geocodeAddress } from "@/lib/censusGeocode";
import { puebloPin } from "@/lib/adminEventValidation";
import {
  commitConversion,
  copyPendingFlyer,
  draftFromPayload,
  loadPendingEventSubmission,
  parseSubmissionPayload,
  type CopiedFlyer,
} from "@/lib/eventSubmissions";

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

  const { env } = await getCloudflareContext({ async: true });
  const r2 = env.EVENT_FLYERS;
  const eventId = crypto.randomUUID();
  let flyer: CopiedFlyer | null;
  try {
    flyer = await copyPendingFlyer(r2, sub, eventId);
  } catch {
    return fail(502, "upload_failed", "The flyer could not be copied. Try again.");
  }

  const row = draftFromPayload(eventId, payload, place, flyer, identity.email, new Date().toISOString());
  let outcome: "converted" | "gone";
  try {
    outcome = await commitConversion(db, r2, identity, sub, row);
  } catch {
    return fail(500, "write_failed", "The draft was not created. Try again.");
  }
  if (outcome === "gone") return fail(409, "conflict", "Someone already handled this event. Reload to see it.");
  return NextResponse.json({ ok: true, id: eventId, editUrl: `/admin/events/${eventId}/edit?saved=1` });
}
