// @vitest-environment node
/**
 * Tests for requireAdminSession() (Phase 3 dual-auth, src/lib/adminSession.ts).
 *
 * getAuth() (src/lib/auth.ts) is mocked wholesale — it internally requires
 * getCloudflareContext()'s live Worker request context (see that file's own
 * header), which doesn't exist in a plain vitest run. Mocking at the
 * getAuth() boundary lets these tests drive auth.api.getSession() directly
 * without needing a real Better Auth instance or D1 binding, matching the
 * existing "mock the one true I/O boundary" pattern documented in
 * adminDb.test.ts's own header.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { AccessDeniedError, type HeaderSource } from "@/lib/cfAccess";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({ api: { getSession: mockGetSession } }),
}));

import { requireAdminSession } from "@/lib/adminSession";

// WHY a real `host` is included by default (fixed post-cutover — live 403
// bug, admin/session-dynamic-baseurl-host): auth-options.ts's `baseURL` is a
// dynamic multi-host config, and requireAdminSession() now forwards `host`
// alongside `cookie` on every getSession() call — a helper that omitted it
// would no longer represent a real caller (see adminSession.ts's header).
function headersWithCookie(
  cookie: string | null,
  host = "dev.pueblofoodmap.com",
): HeaderSource {
  return {
    get: (name: string) => {
      if (name === "cookie") return cookie;
      if (name === "host") return host;
      return null;
    },
  };
}

describe("requireAdminSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockGetSession.mockReset();
  });

  test("throws AccessDeniedError(\"no_session\") when getSession returns null", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(
      requireAdminSession(headersWithCookie("__Host-session_token=abc")),
    ).rejects.toMatchObject(
      new AccessDeniedError("no_session"),
    );
  });

  test("throws AccessDeniedError(\"not_allowlisted\") for a non-allowlisted session email", async () => {
    vi.stubEnv("ADMIN_ALLOWLIST", "kysboyd@gmail.com");
    mockGetSession.mockResolvedValue({
      session: { id: "s1" },
      user: { email: "attacker@evil.com" },
    });

    await expect(
      requireAdminSession(headersWithCookie("__Host-session_token=abc")),
    ).rejects.toMatchObject(
      new AccessDeniedError("not_allowlisted"),
    );
  });

  test("returns the identity for an allowlisted session", async () => {
    vi.stubEnv("ADMIN_ALLOWLIST", "kysboyd@gmail.com");
    mockGetSession.mockResolvedValue({
      session: { id: "s1" },
      user: { email: "kysboyd@gmail.com" },
    });

    await expect(
      requireAdminSession(headersWithCookie("__Host-session_token=abc")),
    ).resolves.toEqual({ email: "kysboyd@gmail.com" });
  });

  // Was "forwards only the cookie header" — updated because
  // requireAdminSession() now ALSO forwards `host` (and, when present,
  // `x-forwarded-host`) so Better Auth's dynamic baseURL can resolve a
  // per-request base URL on this direct auth.api.getSession() call, matching
  // the real HTTP endpoint's behavior. See adminSession.ts's header WHY.
  test("forwards cookie and host to getSession, as a real Headers object", async () => {
    vi.stubEnv("ADMIN_ALLOWLIST", "kysboyd@gmail.com");
    mockGetSession.mockResolvedValue({
      session: { id: "s1" },
      user: { email: "kysboyd@gmail.com" },
    });

    await requireAdminSession(
      headersWithCookie("__Host-session_token=abc", "dev.pueblofoodmap.com"),
    );

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    const call = mockGetSession.mock.calls[0][0] as { headers: Headers };
    expect(call.headers).toBeInstanceOf(Headers);
    expect(call.headers.get("cookie")).toBe("__Host-session_token=abc");
    expect(call.headers.get("host")).toBe("dev.pueblofoodmap.com");
  });

  test("still yields no_session for a cookieless call with no host header (fallback path)", async () => {
    mockGetSession.mockResolvedValue(null);

    // A caller with neither cookie nor host still reaches getSession() —
    // requireAdminSession() only conditionally sets each header, never
    // throws building the Headers object — and getSession()'s own
    // no-session result maps to AccessDeniedError("no_session"), never
    // "not_allowlisted" or an unhandled throw.
    await expect(
      requireAdminSession(headersWithCookie(null, "")),
    ).rejects.toMatchObject(new AccessDeniedError("no_session"));

    const call = mockGetSession.mock.calls[0][0] as { headers: Headers };
    expect(call.headers.has("cookie")).toBe(false);
    expect(call.headers.has("host")).toBe(false);
  });
});
