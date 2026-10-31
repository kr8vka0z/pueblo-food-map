// @vitest-environment node
// websiteIo.test.ts — the D1 write token never reaches agy or the browser (Venue Data Rebuild step 3, reviewer blocker).
import { describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { makeFetchPage, makePinnedLookup, readAndRemoveSecretsFile, untrustedChildEnv, type Resolver } from "./websiteIo";

/** A resolver that answers every name with `addresses`. */
const resolvesTo = (...addresses: string[]): Resolver => (_host, _opts, cb) =>
  cb(null, addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));

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

describe("page fetches only reach public addresses (review of PR #845)", () => {
  test.each([["127.0.0.1"], ["10.1.2.3"], ["192.168.0.10"], ["100.104.48.90"], ["169.254.169.254"], ["::1"], ["::ffff:127.0.0.1"], ["fd12::1"]])(
    "a public-looking name resolving to %s is refused before connecting",
    async (address) => {
      const err = await new Promise<NodeJS.ErrnoException | null>((resolve) =>
        makePinnedLookup(resolvesTo(address))("evil.example.com", { all: true }, (e) => resolve(e)),
      );
      expect(err?.code).toBe("ENONPUBLIC");
    },
  );

  test("one bad answer among good ones is enough to refuse", async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) =>
      makePinnedLookup(resolvesTo("93.184.215.14", "127.0.0.1"))("mixed.example.com", {}, (e) => resolve(e)),
    );
    expect(err?.code).toBe("ENONPUBLIC");
  });

  test("a public answer is passed through, pinned to the checked address", async () => {
    const got = await new Promise<string>((resolve) =>
      makePinnedLookup(resolvesTo("93.184.215.14"))("ok.example.com", {}, (_e, address) => resolve(String(address))),
    );
    expect(got).toBe("93.184.215.14");
  });

  test("end to end: a server on this machine never receives the request", async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end("<html>" + "secret ".repeat(100) + "</html>");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      const page = await makeFetchPage(resolvesTo("127.0.0.1"))(`http://pantry.example.com:${port}/`);
      expect(page.ok).toBe(false);
      const literal = await makeFetchPage(resolvesTo("93.184.215.14"))(`http://127.0.0.1:${port}/`);
      expect(literal.ok).toBe(false);
      expect(hits).toBe(0);
    } finally {
      server.close();
    }
  });
});
