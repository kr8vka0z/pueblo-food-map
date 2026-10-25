// @vitest-environment node
// websiteIo.test.ts — the D1 write token never reaches agy or the browser (Venue Data Rebuild step 3, reviewer blocker).
import { describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAndRemoveSecretsFile, untrustedChildEnv } from "./websiteIo";

describe("keeping the token from untrusted children", () => {
  test("agy's and the browser's environment drop every Cloudflare and 1Password variable", () => {
    const env = untrustedChildEnv({ CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a", OP_CONNECT_TOKEN: "o", OP_CONNECT_HOST: "h", HOME: "/home/atlas", PATH: "/usr/bin" } as unknown as NodeJS.ProcessEnv);
    expect(env).toEqual({ HOME: "/home/atlas", PATH: "/usr/bin" });
  });

  test("the secrets file is parsed (claude-bot-secrets quoting) and deleted at once", () => {
    const file = join(mkdtempSync(join(tmpdir(), "pfm-secrets-")), "secrets.env");
    writeFileSync(file, "CLOUDFLARE_API_TOKEN='abc'\\''def'\nCLOUDFLARE_ACCOUNT_ID='1234'\n");
    expect(readAndRemoveSecretsFile(file)).toEqual({ CLOUDFLARE_API_TOKEN: "abc'def", CLOUDFLARE_ACCOUNT_ID: "1234" });
    expect(existsSync(file)).toBe(false);
  });
});
