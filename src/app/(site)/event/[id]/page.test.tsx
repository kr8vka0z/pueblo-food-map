// @vitest-environment node
/**
 * /event/[id] and /es/event/[id] against a real SQLite database built from the
 * real migrations (#762): which events are visible, what a hidden or broken
 * database answers, the ended / cancelled states in the server HTML, hostile
 * text, and the metadata the route returns. Mocks only the Cloudflare context.
 *
 * Risky behavior only; no wording or CSS assertions beyond locating an element.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import Database from "better-sqlite3";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";
import { OG_IMAGE, SITE_URL } from "@/lib/site";

const mockContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => mockContext() }));

import EventRoute, { generateMetadata } from "@/app/(site)/event/[id]/page";
import EsEventRoute, { generateMetadata as generateEsMetadata } from "@/app/es/event/[id]/page";

const NOW = new Date("2026-11-20T18:00:00.000Z"); // Fri Nov 20 2026, 11 AM in Pueblo
const KEY = "up/22222222-2222-4222-8222-222222222222.jpg";

function migrate(withFlyerColumns: boolean) {
  const db = new Database(":memory:");
  db.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  if (withFlyerColumns) db.exec(readFileSync(join(process.cwd(), "migrations", "0019_event_flyer.sql"), "utf-8"));
  return db;
}

function insert(db: Database.Database, row: Record<string, unknown>) {
  const base = {
    name: "Event",
    starts_at: "2026-11-21T17:00:00.000Z",
    ends_at: "2026-11-21T21:00:00.000Z",
    lat: 38.25,
    lng: -104.6,
    address: "216 W Routt Ave, Pueblo, CO 81004",
    status: "published",
    created_by: "a",
    updated_by: "a",
  };
  const all = { ...base, ...row };
  const cols = Object.keys(all);
  db.prepare(`INSERT INTO events (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...Object.values(all));
}

function seed(db: Database.Database, withFlyerColumns = true) {
  insert(db, { id: "up", name: "Turkey drive", name_es: "Entrega de pavos", host: "Pueblo Food Project", description: "Free turkeys.", flyer_key: withFlyerColumns ? KEY : null });
  if (withFlyerColumns) db.prepare("UPDATE events SET flyer_width = 300, flyer_height = 420, flyer_alt = 'A flyer' WHERE id = 'up'").run();
  insert(db, { id: "ended-recent", name: "Last week", starts_at: "2026-11-19T17:00:00.000Z", ends_at: "2026-11-19T21:00:00.000Z" });
  insert(db, { id: "ended-old", name: "Long ago", starts_at: "2026-10-01T17:00:00.000Z", ends_at: "2026-10-01T21:00:00.000Z" });
  insert(db, { id: "cancelled", name: "Called off", status: "cancelled", cancel_note: "Snow day", cancel_note_es: "Día de nieve" });
  insert(db, { id: "draft", name: "Secret", status: "draft" });
  insert(db, { id: "archived", name: "Gone", status: "archived" });
  return db;
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const html = async (id: string, es = false) =>
  renderToStaticMarkup(await (es ? EsEventRoute : EventRoute)(params(id)));

async function notFoundDigest(id: string, es = false): Promise<string> {
  try {
    await (es ? EsEventRoute : EventRoute)(params(id));
  } catch (err) {
    return String((err as { digest?: string }).digest);
  }
  throw new Error(`expected /event/${id} to be not-found`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockContext.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("visibility", () => {
  test("draft, archived and unknown ids all answer with the same 404", async () => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(seed(migrate(true))) } });
    const digests = await Promise.all(["draft", "archived", "no-such-id"].map((id) => notFoundDigest(id)));
    expect(digests[0]).toContain("404");
    expect(new Set(digests).size).toBe(1);
    expect(await notFoundDigest("draft", true)).toBe(digests[0]);
    // No draft text anywhere: generateMetadata gives them nothing to leak either.
    for (const id of ["draft", "archived", "no-such-id"]) expect(await generateMetadata(params(id))).toEqual({});
  });

  test("the events table missing (migration 0018 not applied) is a 404, not a 500", async () => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(new Database(":memory:")) } });
    expect(await notFoundDigest("up")).toContain("404");
    expect(await notFoundDigest("up", true)).toContain("404");
    expect(await generateMetadata(params("up"))).toEqual({});
  });

  test("no Cloudflare context at all is a 404 too", async () => {
    mockContext.mockImplementation(() => {
      throw new Error("no context");
    });
    expect(await notFoundDigest("up")).toContain("404");
  });

  test("flyer columns missing (migration 0019 not applied): the event still renders, without a flyer", async () => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(seed(migrate(false), false)) } });
    const page = await html("up");
    expect(page).toContain("Turkey drive");
    expect(page).not.toContain("<img");
  });
});

describe("page states (server HTML)", () => {
  beforeEach(() => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(seed(migrate(true))) } });
  });

  test("an upcoming event shows the flyer with its size, a map link with ?event=, directions and the h1", async () => {
    const page = await html("up");
    expect(page).toMatch(/<h1[^>]*>Turkey drive<\/h1>/);
    expect(page).toContain(`src="/api/public/events/up/flyer/22222222-2222-4222-8222-222222222222.jpg"`);
    expect(page).toContain(`width="300"`);
    expect(page).toContain(`height="420"`);
    expect(page).toContain(`href="/?event=up"`);
    expect(page).toContain("google.com/maps/dir");
    expect(page).toContain(`data-phase="upcoming"`);
  });

  test("the Spanish page keeps the /es tree for its map link, other-language link and text", async () => {
    const page = await html("up", true);
    expect(page).toMatch(/<h1[^>]*>Entrega de pavos<\/h1>/);
    expect(page).toContain(`href="/es?event=up"`);
    expect(page).toContain(`href="/event/up"`); // the English twin
  });

  test("an ended event stays reachable and is marked ended, with no directions or calendar", async () => {
    const page = await html("ended-recent");
    expect(page).toContain(`data-phase="ended"`);
    expect(page).not.toContain("google.com/maps/dir");
    expect(page).not.toContain("<button");
  });

  test("a cancelled event shows Cancelled and the admin's note in the page's language, with no directions", async () => {
    const en = await html("cancelled");
    expect(en).toContain(`data-phase="cancelled"`);
    expect(en).toContain("Snow day");
    expect(en).not.toContain("google.com/maps/dir");
    expect(await html("cancelled", true)).toContain("Día de nieve");
  });

  test("a live event is marked live", async () => {
    vi.setSystemTime(new Date("2026-11-21T18:00:00.000Z"));
    expect(await html("up")).toContain(`data-phase="live"`);
  });

  test("hostile event text is escaped in the HTML, and both JSON-LD blocks stay valid JSON", async () => {
    const evil = `</script><script>alert(1)</script>"><img src=x onerror=alert(1)>`;
    const db = migrate(true);
    insert(db, { id: "evil", name: evil, host: evil, description: evil, what_to_bring: evil, address: evil, link_url: "javascript:alert(1)" });
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(db) } });

    const page = await html("evil");

    expect(page).not.toContain("<script>alert");
    expect(page).not.toContain("<img src=x");
    expect(page).not.toContain("javascript:");
    const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) expect(() => JSON.parse(block)).not.toThrow();
    expect(JSON.parse(blocks[0]).name).toBe(evil);
  });

  test("only an http(s) link is offered, and with rel=noopener noreferrer", async () => {
    const db = migrate(true);
    insert(db, { id: "linked", link_url: "https://example.org/info" });
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(db) } });
    const page = await html("linked");
    expect(page).toMatch(/<a[^>]*href="https:\/\/example\.org\/info"[^>]*rel="noopener noreferrer"|<a[^>]*rel="noopener noreferrer"[^>]*href="https:\/\/example\.org\/info"/);
  });
});

describe("metadata", () => {
  beforeEach(() => {
    mockContext.mockReturnValue({ env: { ADMIN_DB: sqliteD1(seed(migrate(true))) } });
  });

  test("EN: self-canonical, hreflang pair, flyer as the share image, indexable", async () => {
    const meta = await generateMetadata(params("up"));
    expect(meta.alternates).toEqual({
      canonical: `${SITE_URL}/event/up`,
      languages: { en: `${SITE_URL}/event/up`, es: `${SITE_URL}/es/event/up`, "x-default": `${SITE_URL}/event/up` },
    });
    expect(meta.openGraph?.images).toEqual([
      { url: `${SITE_URL}/api/public/events/up/flyer/22222222-2222-4222-8222-222222222222.jpg`, width: 300, height: 420, alt: "A flyer" },
    ]);
    expect(meta.robots).toBeUndefined();
  });

  test("ES: self-canonical on /es and es_US", async () => {
    const meta = await generateEsMetadata(params("up"));
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/es/event/up`);
    expect(meta.openGraph).toMatchObject({ locale: "es_US" });
  });

  test("an event without a flyer uses the site's default share image", async () => {
    const meta = await generateMetadata(params("cancelled"));
    expect(meta.openGraph?.images).toEqual([OG_IMAGE]);
  });

  test("an event that ended more than a week ago is noindex,follow; a recently ended or cancelled one is indexable", async () => {
    expect((await generateMetadata(params("ended-old"))).robots).toEqual({ index: false, follow: true });
    expect((await generateMetadata(params("ended-recent"))).robots).toBeUndefined();
    expect((await generateMetadata(params("cancelled"))).robots).toBeUndefined();
  });
});
