// @vitest-environment node
/**
 * Integration tests for the admin sign-in record (#679). Same approach as
 * adminAuthAllowlistPlugin.test.ts: a REAL Better Auth instance
 * (betterAuth(buildAuthOptions(...))) against a real, migrated
 * better-sqlite3 database, driven through `auth.handler` (the same entry
 * point /api/auth/[...all] uses), so the hooks run through Better Auth's
 * real dispatch pipeline. The auth_events writes go to the SAME database
 * through a tiny D1-shaped wrapper, as they do on the Worker (one ADMIN_DB).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "@/lib/auth-options";
import { signInMethodForPath, type AuthEventDeps } from "@/lib/authEvents";
import { lastEmailedCode } from "@/__tests__/helpers/authTestHelpers";

const MIGRATIONS = [
  "0001_init_admin_schema.sql",
  "0003_better_auth_schema.sql",
  "0004_rate_limit_table.sql",
  "0017_auth_events.sql",
];

const OWNER = "kysboyd@gmail.com"; // adminAllowlist.ts's default
const ORIGIN = "https://pueblofoodmap.com";
const CLIENT = { "cf-connecting-ip": "203.0.113.9", "user-agent": "Mozilla/5.0 (Macintosh) Safari/605.1.15" };

/** D1's `prepare().bind().run()` surface over better-sqlite3 — the only one authEvents.ts uses. */
function wrapAsD1(db: Database.Database): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          const info = db.prepare(sql).run(...args);
          return { meta: { changes: info.changes } };
        },
      }),
    }),
  } as unknown as D1Database;
}

interface EventRow {
  event: string;
  email: string | null;
  user_id: string | null;
  session_id: string | null;
  method: string | null;
  ip: string | null;
  user_agent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  detail_json: string | null;
}

function setup(deps?: (db: Database.Database) => AuthEventDeps) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(readFileSync(join(process.cwd(), "migrations", m), "utf-8"));
  const auth = betterAuth(
    buildAuthOptions(
      db,
      undefined,
      deps
        ? deps(db)
        : {
            db: wrapAsD1(db),
            getGeo: async () => ({ city: "Pueblo", region: "Colorado", country: "US" }),
          },
    ),
  );
  const events = () => db.prepare("SELECT * FROM auth_events ORDER BY id").all() as EventRow[];
  return { db, auth, events };
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  process.env.RESEND_API_KEY = "test-resend-key";
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

async function requestCode(auth: ReturnType<typeof setup>["auth"], email: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/email-otp/send-verification-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...CLIENT },
      body: JSON.stringify({ email, type: "sign-in" }),
    }),
  );
}

async function submitCode(auth: ReturnType<typeof setup>["auth"], email: string, otp: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email-otp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...CLIENT },
      body: JSON.stringify({ email, otp }),
    }),
  );
}

/** Requests a code for the owner, signs in with it (as a browser would, through auth.handler). */
async function signIn(auth: ReturnType<typeof setup>["auth"]) {
  await requestCode(auth, OWNER);
  const res = await submitCode(auth, OWNER, lastEmailedCode());
  const cookie = (res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { res, cookie };
}

describe("auth_events — sign-in record (#679, email code #684)", () => {
  test("a sign-in code for a non-allowlisted email logs one failed attempt, response unchanged", async () => {
    const { auth, events } = setup();

    const res = await requestCode(auth, "attacker@evil.com");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true }); // anti-enumeration shape untouched
    expect(fetchSpy).not.toHaveBeenCalled();
    const rows = events();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: "sign_in_failed",
      email: "attacker@evil.com",
      method: "email_code",
      ip: "203.0.113.9",
      country: "US",
    });
    expect(JSON.parse(rows[0].detail_json!)).toEqual({ reason: "not_allowlisted" });
  });

  test("requesting a code for an allowlisted email logs nothing (only the sign-in itself is an event)", async () => {
    const { auth, events } = setup();
    await requestCode(auth, OWNER);
    expect(events()).toHaveLength(0);
  });

  test("signing in with a code writes exactly one sign_in row with method, IP, device and location", async () => {
    const { db, auth, events } = setup();

    const { res } = await signIn(auth);

    expect(res.status).toBe(200);
    const rows = events();
    expect(rows).toHaveLength(1);
    const session = db.prepare('SELECT id, "ipAddress" FROM "session"').get() as { id: string; ipAddress: string };
    expect(rows[0]).toMatchObject({
      event: "sign_in",
      email: OWNER,
      session_id: session.id,
      method: "email_code",
      ip: "203.0.113.9",
      user_agent: CLIENT["user-agent"],
      city: "Pueblo",
      region: "Colorado",
      country: "US",
    });
    // The comment on #679: Better Auth itself now records the Cloudflare client IP.
    expect(session.ipAddress).toBe("203.0.113.9");
    // Neither the code nor a token is stored.
    expect(JSON.stringify(rows[0])).not.toMatch(/token|otp/i);
  });

  test("a wrong code logs one failed attempt with the reason and the typed email", async () => {
    const { auth, events } = setup();
    await requestCode(auth, OWNER);
    const wrong = lastEmailedCode() === "000000" ? "111111" : "000000";

    const res = await submitCode(auth, OWNER, wrong);

    expect(res.status).toBe(400);
    const rows = events();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "sign_in_failed", method: "email_code", email: OWNER, ip: "203.0.113.9" });
    expect(JSON.parse(rows[0].detail_json!)).toEqual({ reason: "INVALID_OTP" });
    expect(rows[0].detail_json).not.toContain(wrong);
  });

  test("a used code can't be reused, and the reuse is logged as a failure", async () => {
    const { auth, events } = setup();
    await requestCode(auth, OWNER);
    const otp = lastEmailedCode();
    await submitCode(auth, OWNER, otp);
    await submitCode(auth, OWNER, otp);

    expect(events().map((r) => r.event)).toEqual(["sign_in", "sign_in_failed"]);
  });

  test("signing out writes one sign_out row tied to the same session", async () => {
    const { auth, events } = setup();
    const { cookie } = await signIn(auth);

    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...CLIENT },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    const [signInRow, signOutRow] = events();
    expect(signOutRow).toMatchObject({ event: "sign_out", email: OWNER, session_id: signInRow.session_id });
  });

  test("removing a passkey writes one passkey_removed row", async () => {
    const { db, auth, events } = setup();
    const { cookie } = await signIn(auth);
    const userId = (db.prepare('SELECT id FROM "user"').get() as { id: string }).id;
    db.prepare(
      `INSERT INTO passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", "createdAt")
       VALUES ('pk-1', 'Laptop', 'pub', ?, 'cred-1', 0, 'singleDevice', 0, '2026-09-27T00:00:00.000Z')`,
    ).run(userId);

    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/delete-passkey`, {
        method: "POST",
        headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...CLIENT },
        body: JSON.stringify({ id: "pk-1" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(events().map((r) => r.event)).toEqual(["sign_in", "passkey_removed"]);
    expect(events()[1]).toMatchObject({ email: OWNER, session_id: events()[0].session_id });
  });

  test("a failed passkey sign-in logs one failed attempt", async () => {
    const { auth, events } = setup();

    const res = await auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/verify-authentication`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json", ...CLIENT },
        body: JSON.stringify({ response: { id: "cred-unknown", rawId: "cred-unknown", type: "public-key", response: {} } }),
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    const rows = events();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: "sign_in_failed", method: "passkey", ip: "203.0.113.9" });
  });

  test("a failing auth_events write never blocks a sign-in", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, auth } = setup(() => ({
      db: {
        prepare: () => {
          throw new Error("D1 down");
        },
      } as unknown as D1Database,
    }));

    const { res, cookie } = await signIn(auth);

    expect(res.status).toBe(200);
    expect(cookie).toContain("__Host-session_token=");
    expect((db.prepare('SELECT COUNT(*) AS n FROM "session"').get() as { n: number }).n).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("recording is off when no events db is configured (schema CLI, config-only tests)", async () => {
    const { auth, events } = setup(() => ({ db: undefined }));
    await requestCode(auth, "attacker@evil.com");
    await signIn(auth);
    expect(events()).toHaveLength(0);
  });
});

describe("signInMethodForPath", () => {
  test.each([
    ["/magic-link/verify", "email_link"],
    ["/passkey/verify-authentication", "passkey"],
    ["/sign-in/email-otp", "email_code"],
    ["/something-else", null],
    [undefined, null],
  ])("%s → %s", (path, method) => {
    expect(signInMethodForPath(path)).toBe(method);
  });
});
