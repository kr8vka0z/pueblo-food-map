// @vitest-environment node
/**
 * Tests for requireAccessIdentity() — Cloudflare Access JWT verification
 * (#237 checkpoint c).
 *
 * Zero network: the "valid token" and "invalid claims" cases sign a real JWT
 * with an in-memory RSA keypair generated in this file, then inject its
 * public key as a local JWKS via _setJwksGetterForTest() — this is the test
 * seam cfAccess.ts was structured around (see its "WHY lazy" comment). No
 * test in this file talks to Cloudflare's real /cdn-cgi/access/certs
 * endpoint or requires Kyle's live Access application, which does not exist
 * in this environment.
 *
 * WHY `node` environment, not the project default `jsdom` (vitest.config.mts):
 * jose's WebAPI build cross-realm-checks `instanceof Uint8Array` while
 * signing; jsdom's vm-sandboxed realm has its own Uint8Array distinct from
 * Node's, so signing here under jsdom throws "payload must be an instance of
 * Uint8Array". cfAccess.ts is a pure server module with no DOM dependency,
 * so `node` is also the more semantically correct environment for it, not
 * just a workaround.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWTVerifyGetKey,
} from "jose";
import {
  requireAccessIdentity,
  AccessDeniedError,
  _setJwksGetterForTest,
  type AccessDeniedReason,
  type HeaderSource,
} from "@/lib/cfAccess";

const TEAM_DOMAIN = "https://pfm-test.cloudflareaccess.com";
const AUD = "test-audience-tag";
const KID = "test-key";

function headersWith(token: string | null): HeaderSource {
  return {
    get: (name: string) => (name === "Cf-Access-Jwt-Assertion" ? token : null),
  };
}

/**
 * Asserts a requireAccessIdentity() call rejects with an AccessDeniedError
 * carrying the expected `reason` — not just any rejection that happens to
 * have a matching `.reason` field.
 */
async function expectDenied(
  promise: ReturnType<typeof requireAccessIdentity>,
  reason: AccessDeniedReason,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AccessDeniedError);
  await expect(promise).rejects.toMatchObject({ reason });
}

/** Generates a throwaway RSA keypair and wraps its public half in a local JWKS. */
async function buildTestJwks(): Promise<{
  privateKey: CryptoKey;
  jwks: JWTVerifyGetKey;
}> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = KID;
  jwk.alg = "RS256";
  jwk.use = "sig";
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

interface SignOptions {
  issuer?: string;
  audience?: string;
  /** Omit the email claim entirely by passing undefined. */
  email?: string;
  includeEmailClaim?: boolean;
  expiredSecondsAgo?: number;
}

async function signTestToken(
  privateKey: CryptoKey,
  opts: SignOptions = {},
): Promise<string> {
  const {
    issuer = TEAM_DOMAIN,
    audience = AUD,
    email = "admin@pueblofoodmap.com",
    includeEmailClaim = true,
    expiredSecondsAgo,
  } = opts;

  let builder = new SignJWT(includeEmailClaim ? { email } : {})
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience);

  builder =
    expiredSecondsAgo !== undefined
      ? builder.setExpirationTime(
          Math.floor(Date.now() / 1000) - expiredSecondsAgo,
        )
      : builder.setExpirationTime("5m");

  return builder.sign(privateKey);
}

describe("requireAccessIdentity", () => {
  beforeEach(() => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    process.env.CF_ACCESS_AUD = AUD;
  });

  afterEach(() => {
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
    _setJwksGetterForTest(null);
  });

  test("rejects a missing Cf-Access-Jwt-Assertion header", async () => {
    await expectDenied(
      requireAccessIdentity(headersWith(null)),
      "missing_assertion",
    );
  });

  test("fails closed when CF_ACCESS_TEAM_DOMAIN is unset", async () => {
    delete process.env.CF_ACCESS_TEAM_DOMAIN;

    await expectDenied(
      requireAccessIdentity(headersWith("irrelevant.token.value")),
      "misconfigured",
    );
  });

  test("fails closed when CF_ACCESS_AUD is unset", async () => {
    delete process.env.CF_ACCESS_AUD;

    await expectDenied(
      requireAccessIdentity(headersWith("irrelevant.token.value")),
      "misconfigured",
    );
  });

  test("accepts a valid token and extracts the email claim", async () => {
    const { privateKey, jwks } = await buildTestJwks();
    _setJwksGetterForTest(() => jwks);
    const token = await signTestToken(privateKey, {
      email: "admin@pueblofoodmap.com",
    });

    await expect(requireAccessIdentity(headersWith(token))).resolves.toEqual({
      email: "admin@pueblofoodmap.com",
    });
  });

  test("rejects a token with the wrong issuer", async () => {
    const { privateKey, jwks } = await buildTestJwks();
    _setJwksGetterForTest(() => jwks);
    const token = await signTestToken(privateKey, {
      issuer: "https://not-the-real-team.cloudflareaccess.com",
    });

    await expectDenied(
      requireAccessIdentity(headersWith(token)),
      "invalid_token",
    );
  });

  test("rejects a token with the wrong audience", async () => {
    const { privateKey, jwks } = await buildTestJwks();
    _setJwksGetterForTest(() => jwks);
    const token = await signTestToken(privateKey, {
      audience: "some-other-cf-access-app",
    });

    await expectDenied(
      requireAccessIdentity(headersWith(token)),
      "invalid_token",
    );
  });

  test("rejects an expired token", async () => {
    const { privateKey, jwks } = await buildTestJwks();
    _setJwksGetterForTest(() => jwks);
    const token = await signTestToken(privateKey, { expiredSecondsAgo: 3600 });

    await expectDenied(
      requireAccessIdentity(headersWith(token)),
      "invalid_token",
    );
  });

  test("rejects a token with no email claim", async () => {
    const { privateKey, jwks } = await buildTestJwks();
    _setJwksGetterForTest(() => jwks);
    const token = await signTestToken(privateKey, { includeEmailClaim: false });

    await expectDenied(
      requireAccessIdentity(headersWith(token)),
      "no_email_claim",
    );
  });

  test("rejects a garbage/forged token", async () => {
    const { jwks } = await buildTestJwks();
    _setJwksGetterForTest(() => jwks);

    await expectDenied(
      requireAccessIdentity(headersWith("garbage.forged.token")),
      "invalid_token",
    );
  });

  test("rejects a token with perfect claims signed by the WRONG key", async () => {
    // Signature-verification regression guard. Every OTHER rejection test
    // fails at a claim check (issuer/audience/expiry/email) or at parse — none
    // of them would fail against a hypothetical claims-only decoder that
    // skipped the cryptographic signature check. This one would: the token has
    // a correct issuer, audience, email, and even the trusted `kid`, so a
    // claims-only path would ACCEPT it. It must be rejected because the
    // signature was produced by an attacker keypair, not the key in the JWKS —
    // the single property defending all three bypass hostnames (spec §3.1/§8).
    const { jwks } = await buildTestJwks(); // trusted public key
    const { privateKey: attackerKey } = await buildTestJwks(); // attacker's key
    _setJwksGetterForTest(() => jwks);
    const token = await signTestToken(attackerKey, {
      email: "admin@pueblofoodmap.com",
    });

    await expectDenied(
      requireAccessIdentity(headersWith(token)),
      "invalid_token",
    );
  });
});
