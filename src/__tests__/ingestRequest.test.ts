// @vitest-environment node
/**
 * Regression test for the /ingest analytics relay's forwarded headers (#858):
 * the relay passed every incoming header on to PostHog, the site's sign-in
 * cookie included. ingestRequest (src/lib/ingestTarget.ts) now builds the
 * outgoing request; custom-worker.ts can't be unit-tested (see its header).
 *
 * WHY the node environment: jsdom's Request drops the headers of a POST built
 * from another Request, so it can't stand in for the Workers runtime here.
 */
import { describe, test, expect } from "vitest";
import { ingestRequest, ingestTarget } from "@/lib/ingestTarget";

const ALLOWED = {
  "content-type": "application/json",
  "content-encoding": "gzip",
  accept: "*/*",
  "accept-encoding": "gzip, br",
  "user-agent": "Mozilla/5.0 (test)",
};

const DROPPED = {
  cookie: "session=secret-value",
  authorization: "Bearer secret-token",
  referer: "https://pueblofoodmap.com/admin",
  "x-forwarded-for": "203.0.113.7",
  "cf-connecting-ip": "203.0.113.7",
  "x-made-up-header": "anything",
};

function relay(path: string, init: RequestInit): Request {
  const url = new URL(path, "https://pueblofoodmap.com");
  const incoming = new Request(url, { ...init, headers: { ...ALLOWED, ...DROPPED } });
  const target = ingestTarget(url.pathname, url.search);
  if (target === null) throw new Error(`not an /ingest path: ${path}`);
  return ingestRequest(target, incoming);
}

describe("incident-2026-10-26-ingest-header-allowlist: /ingest relay forwards only allowlisted headers (#858)", () => {
  const body = JSON.stringify({ event: "test", distinct_id: "abc" });

  test.each([
    ["event", "/ingest/i/v0/e/?ip=0", "https://us.i.posthog.com/i/v0/e/?ip=0"],
    ["session replay", "/ingest/s/", "https://us.i.posthog.com/s/"],
  ])("%s POST: allowlisted headers only, method and body unchanged", async (_name, path, expected) => {
    const out = relay(path, { method: "POST", body });

    expect(out.url).toBe(expected);
    expect(Object.fromEntries(out.headers)).toEqual(ALLOWED);
    expect(out.method).toBe("POST");
    expect(await out.text()).toBe(body);
  });

  test("static asset GET: allowlisted headers only, method unchanged, no body", () => {
    const out = relay("/ingest/static/array.js", { method: "GET" });

    expect(out.url).toBe("https://us-assets.i.posthog.com/static/array.js");
    expect(Object.fromEntries(out.headers)).toEqual(ALLOWED);
    expect(out.method).toBe("GET");
    expect(out.body).toBeNull();
  });
});
