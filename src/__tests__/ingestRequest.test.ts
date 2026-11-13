// @vitest-environment node
/**
 * Regression tests for the /ingest analytics relay's outgoing headers.
 *
 * #858: the relay passed every incoming header on to PostHog, the site's
 * sign-in cookie included. ingestRequest (src/lib/ingestTarget.ts) now builds
 * the outgoing request; custom-worker.ts can't be unit-tested (see its header).
 *
 * #919 (incident 2026-10-27): the #858 allowlist also dropped `Origin` and the
 * visitor IP, so PostHog turned session replay off (its recording-domain check
 * needs Origin) and looked up every city from Cloudflare's own IP. The relay
 * now sends our own Origin and the visitor IP from CF-Connecting-IP as
 * X-Forwarded-For, never a client-supplied X-Forwarded-For.
 *
 * WHY the node environment: jsdom's Request drops the headers of a POST built
 * from another Request, so it can't stand in for the Workers runtime here.
 */
import { describe, test, expect } from "vitest";
import { ingestRequest, ingestTarget } from "@/lib/ingestTarget";

const VISITOR_IP = "198.51.100.9";

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
  // A spoofed chain: must never reach PostHog in place of the real visitor IP.
  "x-forwarded-for": "203.0.113.7, 10.0.0.1",
  "cf-ray": "abc123",
  "x-made-up-header": "anything",
};

// What PostHog receives: the allowlist, our own Origin and the visitor IP.
const EXPECTED = { ...ALLOWED, origin: "https://pueblofoodmap.com", "x-forwarded-for": VISITOR_IP };

function relay(path: string, init: RequestInit, extra: Record<string, string> = { "cf-connecting-ip": VISITOR_IP }): Request {
  const url = new URL(path, "https://pueblofoodmap.com");
  const incoming = new Request(url, { ...init, headers: { ...ALLOWED, ...DROPPED, ...extra } });
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
    expect(Object.fromEntries(out.headers)).toEqual(EXPECTED);
    expect(out.method).toBe("POST");
    expect(await out.text()).toBe(body);
  });

  test("static asset GET: allowlisted headers only, method unchanged, no body", () => {
    const out = relay("/ingest/static/array.js", { method: "GET" });

    expect(out.url).toBe("https://us-assets.i.posthog.com/static/array.js");
    expect(Object.fromEntries(out.headers)).toEqual(EXPECTED);
    expect(out.method).toBe("GET");
    expect(out.body).toBeNull();
  });
});

describe("incident-2026-10-27-ingest-origin-and-ip: replay and city need Origin and the visitor IP (#919)", () => {
  test("the remote-config GET carries our Origin even though the browser sent none (same-origin GET)", () => {
    const out = relay("/ingest/array/phc_test/config", { method: "GET" });
    expect(out.headers.get("origin")).toBe("https://pueblofoodmap.com");
  });

  test("a client-sent Origin is replaced by our own", () => {
    const out = relay("/ingest/s/", { method: "POST", body: "{}" }, { "cf-connecting-ip": VISITOR_IP, origin: "https://evil.example" });
    expect(out.headers.get("origin")).toBe("https://pueblofoodmap.com");
  });

  test("X-Forwarded-For is the CF-Connecting-IP value alone, never the client's chain", () => {
    const out = relay("/ingest/i/v0/e/", { method: "POST", body: "{}" });
    expect(out.headers.get("x-forwarded-for")).toBe(VISITOR_IP);
  });

  test("no CF-Connecting-IP: no X-Forwarded-For at all, so a spoofed one can't slip through", () => {
    const out = relay("/ingest/i/v0/e/", { method: "POST", body: "{}" }, {});
    expect(out.headers.has("x-forwarded-for")).toBe(false);
  });
});
