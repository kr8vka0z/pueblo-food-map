// @vitest-environment node
/**
 * The public "Share an event" flyer (#883): a flyer uploaded through the real
 * public upload route is stored only under the pending prefix, and no public
 * flyer URL can reach it (spec Proof: "a pending flyer URL returns 404").
 * Real SQLite for the rate-limit counter and events table, fake R2.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { jpegBytes } from "@/lib/eventFlyers.testutil";
import { flyerPublicPath, PENDING_FLYER_KEY_RE } from "@/lib/eventFlyers";

const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { POST as uploadFlyer } from "@/app/(site)/events/share/flyer/route";
import { GET as publicFlyer } from "@/app/api/public/events/[id]/flyer/[file]/route";

let objects: Map<string, Uint8Array>;
let reads: string[];

beforeEach(() => {
  vi.stubEnv("CHECKIN_RATE_LIMIT_SECRET", "test-rate-limit-secret");
  const sqlite = new Database(":memory:");
  for (const f of ["0001_init_admin_schema.sql", "0007_box_checkins.sql", "0017_auth_events.sql", "0018_events.sql"]) {
    sqlite.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  }
  objects = new Map();
  reads = [];
  const bucket = {
    put: vi.fn(async (key: string, bytes: ArrayBuffer) => void objects.set(key, new Uint8Array(bytes))),
    get: vi.fn(async (key: string) => {
      reads.push(key);
      const o = objects.get(key);
      return o ? { arrayBuffer: async () => o.buffer } : null;
    }),
  };
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(sqlite), EVENT_FLYERS: bucket } });
});

async function upload(): Promise<string> {
  const form = new FormData();
  form.set("flyer", new Blob([jpegBytes(40, 60) as BlobPart], { type: "image/jpeg" }), "flyer.jpg");
  const probe = new Request("http://localhost/x", { method: "POST", body: form });
  const raw = await probe.arrayBuffer();
  const res = await uploadFlyer(
    new NextRequest("http://localhost/events/share/flyer", {
      method: "POST",
      headers: { "content-type": probe.headers.get("content-type") as string, "content-length": String(raw.byteLength) },
      body: raw,
    }),
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { key: string }).key;
}

describe("public event flyer upload", () => {
  test("stores the flyer under the pending prefix, and no public flyer URL serves it (404, storage never read)", async () => {
    const key = await upload();
    expect(key).toMatch(PENDING_FLYER_KEY_RE);
    expect(objects.has(key)).toBe(true);
    expect(flyerPublicPath(key)).toBeNull();

    const [folder, file] = key.split("/");
    for (const id of [folder, encodeURIComponent(folder), "pending", "pending.submissions"]) {
      const res = await publicFlyer(new NextRequest(`https://pueblofoodmap.com/api/public/events/${id}/flyer/${file}`), {
        params: Promise.resolve({ id, file }),
      });
      expect(res.status).toBe(404);
    }
    expect(reads).toEqual([]);
  });
});
