// @vitest-environment node
/**
 * Tests for getAdminDb() — the single choke point for the ADMIN_DB D1
 * binding (#237 checkpoint c).
 *
 * Only @opennextjs/cloudflare's getCloudflareContext() is mocked (the one
 * true I/O boundary here — it reaches Cloudflare's request-context, which
 * doesn't exist outside a deployed/emulated Worker). Identity verification
 * runs for REAL through cfAccess.ts's own JWKS test seam (see
 * cfAccess.test.ts), so "never calls getCloudflareContext when
 * unauthenticated" below proves the actual ordering guarantee — not just
 * that two independently-mocked functions happen to both fire in some order.
 *
 * WHY `node` environment: same jsdom/Uint8Array cross-realm issue as
 * cfAccess.test.ts (see that file's header) — signing a test JWT here hits
 * the same jose code path.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWTVerifyGetKey,
} from "jose";
import {
  AccessDeniedError,
  _setJwksGetterForTest,
  type HeaderSource,
} from "@/lib/cfAccess";

const TEAM_DOMAIN = "https://pfm-test.cloudflareaccess.com";
const AUD = "test-audience-tag";
const KID = "admindb-test-key";

// Vitest hoists vi.mock() calls above other top-level code (including this
// module's own imports below), so getAdminDb() below picks up the mocked
// @opennextjs/cloudflare without any dynamic-import dance. Referencing a
// variable inside the factory requires the "mock" name prefix so Vitest's
// hoisting-safety check allows it.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { getAdminDb } from "@/lib/adminDb";

function headersWith(token: string | null): HeaderSource {
  return {
    get: (name: string) => (name === "Cf-Access-Jwt-Assertion" ? token : null),
  };
}

/** Signs a real, valid JWT and wires its public key as the injected JWKS. */
async function buildValidToken(): Promise<string> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = KID;
  jwk.alg = "RS256";
  jwk.use = "sig";
  _setJwksGetterForTest(
    () => createLocalJWKSet({ keys: [jwk] }) as JWTVerifyGetKey,
  );

  return new SignJWT({ email: "admin@pueblofoodmap.com" })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(TEAM_DOMAIN)
    .setAudience(AUD)
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("getAdminDb", () => {
  beforeEach(() => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    process.env.CF_ACCESS_AUD = AUD;
    mockGetCloudflareContext.mockReset();
  });

  afterEach(() => {
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
    _setJwksGetterForTest(null);
  });

  test("never calls getCloudflareContext when the caller is unauthenticated", async () => {
    await expect(getAdminDb(headersWith(null))).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("returns the ADMIN_DB binding and identity once verified", async () => {
    const fakeDb = { __fake: "d1-binding" };
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: fakeDb } });

    const token = await buildValidToken();
    const result = await getAdminDb(headersWith(token));

    expect(result.identity).toEqual({ email: "admin@pueblofoodmap.com" });
    expect(result.db).toBe(fakeDb);
    expect(mockGetCloudflareContext).toHaveBeenCalledWith({ async: true });
  });
});
