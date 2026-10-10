// @vitest-environment node
/**
 * Public flyer serving route (#760). Real SQLite for the event rows, a fake
 * R2 that records reads. Covers: only the stored key of a published/cancelled
 * event is served; drafts, archived events, replaced keys and any name outside
 * the strict pattern are 404 (the pattern misses never touch storage); and the
 * headers that make hard caching and nosniff true.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { GET } from "@/app/api/public/events/[id]/flyer/[file]/route";

const ID = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222.png";
const KEY = `${ID}/${FILE}`;

let sqlite: Database.Database;
let getKeys: string[];

function setStatus(status: string, flyerKey: string | null = KEY) {
  sqlite.prepare("UPDATE events SET status = ?, flyer_key = ? WHERE id = ?").run(status, flyerKey, ID);
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  for (const f of ["0001_init_admin_schema.sql", "0017_auth_events.sql", "0018_events.sql"]) {
    sqlite.exec(readFileSync(join(process.cwd(), "migrations", f), "utf-8"));
  }
  sqlite
    .prepare(
      `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, flyer_key, created_by, updated_by)
       VALUES (?, 'E', '2026-11-21T17:00:00.000Z', '2026-11-21T21:00:00.000Z', 38.25, -104.6, 'x', 'published', ?, 'a', 'a')`,
    )
    .run(ID, KEY);
  getKeys = [];
  const bucket = {
    get: vi.fn(async (key: string) => {
      getKeys.push(key);
      return key === KEY ? { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } : null;
    }),
  };
  mockGetCloudflareContext.mockReset();
  mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(sqlite), EVENT_FLYERS: bucket } });
});

const get = (id: string, file: string) =>
  GET(new NextRequest(`https://pueblofoodmap.com/api/public/events/${id}/flyer/${file}`), { params: Promise.resolve({ id, file }) });

describe("GET /api/public/events/[id]/flyer/[file]", () => {
  test("serves a published event's flyer with its content type, nosniff and a year-long immutable cache", async () => {
    const res = await get(ID, FILE);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("a cancelled event's flyer still serves (a shared link keeps its picture)", async () => {
    setStatus("cancelled");
    expect((await get(ID, FILE)).status).toBe(200);
  });

  test.each(["draft", "archived"])("a %s event's flyer is a 404 even with the exact URL, and storage is not read", async (status) => {
    setStatus(status);
    const res = await get(ID, FILE);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBeNull();
    expect(getKeys).toEqual([]);
  });

  test("an old key after a replace or remove is a 404", async () => {
    setStatus("published", `${ID}/33333333-3333-4333-8333-333333333333.png`);
    expect((await get(ID, FILE)).status).toBe(404);
    setStatus("published", null);
    expect((await get(ID, FILE)).status).toBe(404);
  });

  test.each([
    [ID, "../0001.png"],
    [ID, "..%2f..%2fx.png"],
    [ID, "22222222-2222-4222-8222-222222222222.svg"],
    [ID, "22222222-2222-4222-8222-222222222222.png.html"],
    [ID, "22222222-2222-4222-8222-222222222222.PNG"],
    ["../other", FILE],
    ["a/b", FILE],
    ["box-photos", FILE],
    ["", FILE],
  ])("%s / %s is refused by the name pattern before any read", async (id, file) => {
    expect((await get(id, file)).status).toBe(404);
    expect(getKeys).toEqual([]);
  });

  test("an unknown event, or a database error, is a plain 404", async () => {
    expect((await get("99999999-9999-4999-8999-999999999999", FILE)).status).toBe(404);
    sqlite.exec("DROP TABLE events");
    expect((await get(ID, FILE)).status).toBe(404);
  });

  test("a row pointing at a missing object is a 404, not a crash", async () => {
    const other = `${ID}/44444444-4444-4444-8444-444444444444.jpg`;
    setStatus("published", other);
    expect((await get(ID, "44444444-4444-4444-8444-444444444444.jpg")).status).toBe(404);
  });
});
