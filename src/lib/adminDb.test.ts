// @vitest-environment node
/**
 * Tests for getAdminDb() — the single choke point for the ADMIN_DB D1
 * binding (#237 checkpoint c; Better Auth sole-gate cutover,
 * auth/betterauth-sole-gate).
 *
 * Only @opennextjs/cloudflare's getCloudflareContext() and
 * requireAdminSession() (src/lib/adminSession.ts) are mocked — the two I/O
 * boundaries this file's own logic sits between. requireAdminSession()'s own
 * session/allowlist logic is covered on its own by adminSession.test.ts;
 * what this file proves is the WIRING: no session -> D1 never touched,
 * a valid session -> the D1 binding and that session's identity come back.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { AccessDeniedError } from "@/lib/cfAccess";

// Vitest hoists vi.mock() calls above other top-level code (including this
// module's own imports below), so getAdminDb() below picks up the mocked
// @opennextjs/cloudflare without any dynamic-import dance. Referencing a
// variable inside the factory requires the "mock" name prefix so Vitest's
// hoisting-safety check allows it.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { getAdminDb } from "@/lib/adminDb";

function headersWith(cookie: string | null) {
  return {
    get: (name: string) => (name === "cookie" ? cookie : null),
  };
}

describe("getAdminDb", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
  });

  test("no Better Auth session -> AccessDeniedError, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));

    await expect(getAdminDb(headersWith(null))).rejects.toMatchObject(
      new AccessDeniedError("no_session"),
    );
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("a Better Auth session for a non-allowlisted email -> AccessDeniedError, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(getAdminDb(headersWith("session=abc"))).rejects.toMatchObject(
      new AccessDeniedError("not_allowlisted"),
    );
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("returns the ADMIN_DB binding and the session's identity once requireAdminSession succeeds", async () => {
    const fakeDb = { __fake: "d1-binding" };
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: fakeDb } });
    mockRequireAdminSession.mockResolvedValue({ email: "admin@pueblofoodmap.com" });

    const result = await getAdminDb(headersWith("session=abc"));

    expect(result.identity).toEqual({ email: "admin@pueblofoodmap.com" });
    expect(result.db).toBe(fakeDb);
    expect(mockGetCloudflareContext).toHaveBeenCalledWith({ async: true });
    expect(mockRequireAdminSession).toHaveBeenCalledTimes(1);
  });
});
