/**
 * /admin/events and /admin/events/[id]/edit (#757): the production-safety
 * behaviors. The `events` table may not exist in an environment whose
 * migration hasn't been applied, so the pages must render their
 * "couldn't load, retry" state — not throw — while still failing closed on
 * auth. Runs against real SQLite with and without the migration applied.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { AccessDeniedError } from "@/lib/adminOrigin";
import { sqliteD1 } from "@/lib/sqliteD1.testutil";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({ getAdminDb: (...a: unknown[]) => mockGetAdminDb(...a) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("@/lib/logger", () => ({ logAdminAuthFailure: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN");
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import AdminEventsPage from "@/app/(site)/admin/events/page";
import EditEventPage from "@/app/(site)/admin/events/[id]/edit/page";

const identity = { email: "admin@pueblofoodmap.com", isOwner: false };

function db(withMigration: boolean): Database.Database {
  const d = new Database(":memory:");
  if (withMigration) d.exec(readFileSync(join(process.cwd(), "migrations", "0018_events.sql"), "utf-8"));
  return d;
}

function addEvent(d: Database.Database, id: string, name: string, status = "published") {
  d.prepare(
    `INSERT INTO events (id, name, starts_at, ends_at, lat, lng, address, status, created_by, updated_by)
     VALUES (?, ?, '2026-11-21T17:00:00.000Z', '2026-11-21T21:00:00.000Z', 38.25, -104.6, '1 Main', ?, 'a@b.c', 'a@b.c')`,
  ).run(id, name, status);
}

const useDb = (d: Database.Database) => mockGetAdminDb.mockResolvedValue({ db: sqliteD1(d), identity });
const editProps = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  mockGetAdminDb.mockReset();
});

describe("/admin/events", () => {
  test("FAIL SOFT: no events table -> the page renders its retry state, it does not throw", async () => {
    useDb(db(false));
    render(await AdminEventsPage());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  test("lists events with an edit link to each", async () => {
    const d = db(true);
    addEvent(d, "e1", "Turkey drive");
    useDb(d);
    render(await AdminEventsPage());
    expect(screen.getByText("Turkey drive")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit turkey drive/i })).toHaveAttribute("href", "/admin/events/e1/edit");
  });

  test("with no events it offers Add event", async () => {
    useDb(db(true));
    render(await AdminEventsPage());
    expect(screen.getAllByRole("link", { name: /add event/i })[0]).toHaveAttribute("href", "/admin/events/new");
  });

  test("still fails closed on auth: no session -> login redirect", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("no_session"));
    await expect(AdminEventsPage()).rejects.toThrow("REDIRECT");
  });
});

describe("/admin/events/[id]/edit", () => {
  test("FAIL SOFT: no events table -> retry state, not a crash", async () => {
    useDb(db(false));
    render(await EditEventPage(editProps("e1")));
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  test("unknown id -> 404", async () => {
    useDb(db(true));
    await expect(EditEventPage(editProps("nope"))).rejects.toThrow("NOT_FOUND");
  });

  test("an archived event is shown read-only (no form to save into a 409)", async () => {
    const d = db(true);
    addEvent(d, "e1", "Old drive", "archived");
    useDb(d);
    render(await EditEventPage(editProps("e1")));
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  test("a draft opens in the form with its Pueblo-time values pre-filled", async () => {
    const d = db(true);
    addEvent(d, "e1", "Turkey drive", "draft");
    useDb(d);
    render(await EditEventPage(editProps("e1")));
    expect(screen.getByLabelText(/^Starts/)).toHaveValue("2026-11-21T10:00");
    expect(screen.getByLabelText(/^Ends/)).toHaveValue("2026-11-21T14:00");
  });
});
