// @vitest-environment node
/**
 * "Make it a draft event" (#883, spec Proof): a public submission, made
 * through the real public flyer and submit routes, becomes a DRAFT event
 * (never published) with every field and the flyer copied, and the
 * submission is marked converted in the same write. When the address can't
 * be located, nothing is written and the prefilled form's save (POST
 * /api/admin/events with submission_id) does the same conversion, draft only.
 *
 * Real route handlers, real getAdminDb()/requireAdminOrigin(), real SQLite
 * from the migration files; Better Auth's session check, the Cloudflare
 * context, R2 (an in-memory map) and outside fetches (Turnstile, Resend,
 * the Census geocoder) are faked.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { jpegBytes } from "@/lib/eventFlyers.testutil";
import { makeSubmitRequest } from "@/__tests__/helpers/submitRouteTestHelpers";

const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));
const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST as uploadFlyer } from "@/app/(site)/events/share/flyer/route";
import { POST as submitEvent } from "@/app/(site)/events/share/submit/route";
import { POST as convert } from "@/app/api/admin/event-submissions/[id]/convert/route";
import { POST as createEvent } from "@/app/api/admin/events/route";
import { convertToDraft, dismissSubmission, draftFromPayload, loadPendingEventSubmission, parseSubmissionPayload } from "@/lib/eventSubmissions";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const SENDER_EMAIL = "pat@example.com";
let sqlite: Database.Database;
let objects: Map<string, Uint8Array>;
let censusMatches: unknown[];

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test_key");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
  sqlite = new Database(":memory:");
  for (const f of [
    "0001_init_admin_schema.sql", "0007_box_checkins.sql", "0017_auth_events.sql", "0018_events.sql",
    "0019_event_flyer.sql", "0026_event_venue_and_button.sql", "0027_event_submissions.sql",
  ]) {
    sqlite.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  }
  objects = new Map();
  const bucket = {
    put: vi.fn(async (key: string, bytes: ArrayBuffer) => void objects.set(key, new Uint8Array(bytes))),
    get: vi.fn(async (key: string) => {
      const o = objects.get(key);
      return o ? { arrayBuffer: async () => o.slice().buffer } : null;
    }),
    delete: vi.fn(async (key: string) => void objects.delete(key)),
  };
  const ctx = { env: { ADMIN_DB: sqliteD1(sqlite), EVENT_FLYERS: bucket } };
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockImplementation((opts?: { async?: boolean }) => (opts?.async ? Promise.resolve(ctx) : ctx));
  mockRequireAdminSession.mockReset();
  mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL, sessionId: "sess-1" });
  censusMatches = [{ matchedAddress: "123 MAIN ST, PUEBLO, CO, 81003", coordinates: { x: -104.61, y: 38.27 } }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("turnstile")) return { ok: true, json: async () => ({ success: true }) };
      if (u.includes("geocoding.geo.census.gov")) return { ok: true, json: async () => ({ result: { addressMatches: censusMatches } }) };
      return { ok: true, json: async () => ({}), text: async () => "" }; // Resend
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Sends an event with a flyer the way the public page does; returns the submission id and pending flyer key. */
async function sendIn(pin: { lat?: unknown; lng?: unknown } = {}): Promise<{ id: string; flyerKey: string }> {
  const form = new FormData();
  form.set("flyer", new Blob([jpegBytes(40, 60) as BlobPart], { type: "image/jpeg" }), "flyer.jpg");
  const probe = new Request("http://localhost/x", { method: "POST", body: form });
  const raw = await probe.arrayBuffer();
  const up = await uploadFlyer(
    new NextRequest("http://localhost/events/share/flyer", {
      method: "POST",
      headers: { "content-type": probe.headers.get("content-type") as string, "content-length": String(raw.byteLength) },
      body: raw,
    }),
  );
  const { key } = (await up.json()) as { key: string };
  const res = await submitWithFlyer(key, pin);
  expect(res.status).toBe(200);
  const { id } = sqlite.prepare("SELECT id FROM event_submissions").get() as { id: string };
  return { id, flyerKey: key };
}

/** The public submit, with a given (already uploaded) flyer key. */
function submitWithFlyer(key: string, pin: { lat?: unknown; lng?: unknown } = {}) {
  return submitEvent(
    makeSubmitRequest("/events/share/submit", {
      name: "Turkey Giveaway",
      host: "Pueblo Food Project",
      date: "2026-11-22",
      start_time: "10:00",
      end_time: "13:00",
      description: "Free turkeys.",
      what_to_bring: "Bags",
      venue_name: "St. Mary's hall",
      address: "123 Main St, Pueblo, CO",
      link_url: "https://example.org/rsvp",
      link_label: "rsvp",
      flyer_key: key,
      ...pin,
      submitter_name: "Pat",
      submitter_email: SENDER_EMAIL,
      website: "",
      turnstileToken: "token",
    }),
  );
}

const adminPost = (url: string, body?: unknown) =>
  new NextRequest(`https://pueblofoodmap.com${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ADMIN_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const runConvert = (id: string) => convert(adminPost(`/api/admin/event-submissions/${id}/convert`), { params: Promise.resolve({ id }) });
const submission = (id: string) => sqlite.prepare("SELECT * FROM event_submissions WHERE id = ?").get(id) as Record<string, unknown>;
const events = () => sqlite.prepare("SELECT * FROM events").all() as Record<string, unknown>[];
const audits = () => sqlite.prepare("SELECT * FROM audit_log").all() as Record<string, unknown>[];

describe("Make it a draft event", () => {
  test("creates a draft (never published) with every field and the flyer copied, and marks the submission converted", async () => {
    const { id, flyerKey } = await sendIn();
    const flyerBytes = objects.get(flyerKey);

    const res = await runConvert(id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; editUrl: string };
    expect(body.editUrl).toBe(`/admin/events/${body.id}/edit?saved=1`);

    const [event] = events();
    expect(event).toMatchObject({
      id: body.id,
      status: "draft",
      published_at: null,
      name: "Turkey Giveaway",
      host: "Pueblo Food Project",
      description: "Free turkeys.",
      what_to_bring: "Bags",
      venue_name: "St. Mary's hall",
      address: "123 Main St, Pueblo, CO",
      link_url: "https://example.org/rsvp",
      link_label: "rsvp",
      starts_at: "2026-11-22T17:00:00.000Z",
      ends_at: "2026-11-22T20:00:00.000Z",
      lat: 38.27,
      lng: -104.61,
      flyer_width: 40,
      flyer_height: 60,
    });
    // The flyer moved onto the event's own key; the pending copy is gone.
    expect(String(event.flyer_key).startsWith(`${body.id}/`)).toBe(true);
    expect(objects.get(event.flyer_key as string)).toEqual(flyerBytes);
    expect(objects.has(flyerKey)).toBe(false);

    expect(submission(id)).toMatchObject({ status: "converted", converted_event_id: body.id, reviewed_by: ADMIN_EMAIL });
    const rows = audits();
    expect(rows.map((a) => [a.entity, a.action, a.session_id])).toEqual([
      ["event", "create", "sess-1"],
      ["event_submission", "update", "sess-1"],
    ]);
    expect(JSON.stringify(rows)).not.toContain(SENDER_EMAIL);

    // A second click finds nothing pending and writes nothing.
    expect((await runConvert(id)).status).toBe(404);
    expect(events()).toHaveLength(1);
  });

  test("a pin the sender picked on the public form is used as is, and the geocoder is never called", async () => {
    const { id } = await sendIn({ lat: 38.2601, lng: -104.6002 });
    const res = await runConvert(id);
    expect(res.status).toBe(200);
    expect(events()[0]).toMatchObject({ status: "draft", lat: 38.2601, lng: -104.6002 });
    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([u]) => String(u));
    expect(calls.some((u) => u.includes("geocoding.geo.census.gov"))).toBe(false);
  });

  test("an address that can't be located writes nothing and points at the prefilled form, whose draft save converts it", async () => {
    censusMatches = [];
    const { id } = await sendIn();

    const res = await runConvert(id);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "needs_location", openUrl: `/admin/events/new?from=${id}` });
    expect(events()).toHaveLength(0);
    expect(submission(id).status).toBe("pending");

    const form = {
      name: "Turkey Giveaway",
      starts_at_local: "2026-11-22T10:00",
      ends_at_local: "2026-11-22T13:00",
      address: "123 Main St, Pueblo, CO",
      lat: 38.2,
      lng: -104.6,
      submission_id: id,
    };
    // Publish is refused on this path: a public submission only ever becomes a draft.
    expect((await createEvent(adminPost("/api/admin/events", { ...form, action: "publish" }))).status).toBe(422);
    const saved = await createEvent(adminPost("/api/admin/events", { ...form, action: "save_draft" }));
    expect(saved.status).toBe(201);
    const [event] = events();
    expect(event).toMatchObject({ status: "draft", published_at: null, lat: 38.2 });
    expect(objects.has(event.flyer_key as string)).toBe(true);
    expect(submission(id)).toMatchObject({ status: "converted", converted_event_id: event.id });
  });

  test("a second send reusing the same uploaded flyer is refused, and converting the first still moves its flyer", async () => {
    const { id, flyerKey } = await sendIn();
    const again = await submitWithFlyer(flyerKey);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "flyer_reused" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM event_submissions").get()).toEqual({ n: 1 });

    expect((await runConvert(id)).status).toBe(200);
    const [event] = events();
    expect(objects.has(event.flyer_key as string)).toBe(true);
  });
});

describe("two admins acting on one submission in the same millisecond", () => {
  const identity = { email: ADMIN_EMAIL, sessionId: "sess-1" };
  afterEach(() => vi.useRealTimers());

  test("two conversions: one event, one event audit row, one submission audit row; the loser gets 409", async () => {
    const { id } = await sendIn();
    // Both requests read the row while it was still pending.
    const sub = (await loadPendingEventSubmission(sqliteD1(sqlite), id))!;
    const payload = parseSubmissionPayload(sub.payload)!;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const at = new Date().toISOString();
    const first = await convertToDraft(sqliteD1(sqlite), identity, sub, draftFromPayload("ev-a", payload, { lat: 38.2, lng: -104.6 }, ADMIN_EMAIL, at));
    const second = await convertToDraft(sqliteD1(sqlite), identity, sub, draftFromPayload("ev-b", payload, { lat: 38.2, lng: -104.6 }, ADMIN_EMAIL, at));
    expect(first).toBeNull();
    expect(second?.status).toBe(409);
    expect(events().map((e) => e.id)).toEqual(["ev-a"]);
    expect(audits().map((a) => [a.entity, a.entity_id])).toEqual([
      ["event", "ev-a"],
      ["event_submission", id],
    ]);
    expect(JSON.parse(audits()[1].after_json as string)).toMatchObject({ converted_event_id: "ev-a" });
  });

  test("two dismissals: one status change, one audit row", async () => {
    const { id } = await sendIn();
    const sub = (await loadPendingEventSubmission(sqliteD1(sqlite), id))!;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    expect(await dismissSubmission(sqliteD1(sqlite), identity, sub, "Turkey Giveaway")).toBe(true);
    expect(await dismissSubmission(sqliteD1(sqlite), identity, sub, "Turkey Giveaway")).toBe(false);
    expect(audits()).toHaveLength(1);
  });
});
