// cloudflareContext.test.ts — the two call forms and the per-request `cf` store. Every route test mocks this module,
// so without these nothing proves the real helper hands sync callers an object (not a Promise) or that request.cf
// reaches code awaited inside the request.
import { describe, expect, test } from "vitest";
import { env } from "cloudflare:workers";
import { getCloudflareContext, runWithRequestCf } from "./cloudflareContext";

describe("getCloudflareContext", () => {
  test("sync form returns the bindings directly; async form resolves to the same", async () => {
    const sync = getCloudflareContext();
    expect(sync).not.toBeInstanceOf(Promise);
    expect(sync.env).toBe(env);
    const viaAsync = await getCloudflareContext({ async: true });
    expect(viaAsync.env).toBe(env);
  });

  test("request.cf is visible inside runWithRequestCf, across awaits, and only there", async () => {
    const cf = { city: "Pueblo" };
    const seen = await runWithRequestCf(cf, async () => {
      await Promise.resolve();
      return (await getCloudflareContext({ async: true })).cf;
    });
    expect(seen).toBe(cf);
    expect(getCloudflareContext().cf).toBeUndefined();
  });
});
