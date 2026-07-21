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

function headersWithCookie(cookie: string | null): HeaderSource {
  return {
    get: (name: string) => (name === "cookie" ? cookie : null),
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

  test("forwards only the cookie header to getSession, as a real Headers object", async () => {
    vi.stubEnv("ADMIN_ALLOWLIST", "kysboyd@gmail.com");
    mockGetSession.mockResolvedValue({
      session: { id: "s1" },
      user: { email: "kysboyd@gmail.com" },
    });

    await requireAdminSession(headersWithCookie("__Host-session_token=abc"));

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    const call = mockGetSession.mock.calls[0][0] as { headers: Headers };
    expect(call.headers).toBeInstanceOf(Headers);
    expect(call.headers.get("cookie")).toBe("__Host-session_token=abc");
  });
});
