/**
 * serviceWorker.test.ts — public/sw.js (#130) routing decisions, precache
 * asset extraction, old-cache cleanup, and the kill switch.
 *
 * WHY node:vm instead of an import: sw.js is a plain classic script served
 * as-is from public/ (no bundler step), so it has no exports. Running its
 * source in a sandbox with a fake `self`/`caches` exposes its top-level
 * functions and captures the listeners it registers.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, test, vi } from "vitest";

const SW_SOURCE = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
const ORIGIN = "https://pueblofoodmap.com";

type Listener = (event: unknown) => void;

function loadSw(source = SW_SOURCE, cacheKeys: string[] = []) {
  const listeners: Record<string, Listener> = {};
  const deleted: string[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    registration: { unregister: vi.fn(() => Promise.resolve(true)) },
  };
  const caches = {
    keys: vi.fn(async () => cacheKeys),
    delete: vi.fn(async (k: string) => {
      deleted.push(k);
      return true;
    }),
    open: vi.fn(),
  };
  const context = vm.createContext({ self, caches, URL, Promise, Set, fetch: vi.fn() });
  vm.runInContext(source, context);
  return { context, listeners, self, caches, deleted };
}

function classify(url: string, init: { method?: string; mode?: string } = {}) {
  const { context } = loadSw();
  return context.classifyRequest(
    { url, method: init.method ?? "GET", mode: init.mode ?? "no-cors" },
    ORIGIN,
  );
}

describe("sw.js classifyRequest (#130)", () => {
  test("hashed Next build assets, fonts, icons and the manifest are static (stale-while-revalidate)", () => {
    expect(classify(`${ORIGIN}/_next/static/chunks/app-abc123.js`)).toBe("static");
    expect(classify(`${ORIGIN}/_next/static/css/def456.css`)).toBe("static");
    expect(classify(`${ORIGIN}/fonts/PublicSans-Variable.woff2`)).toBe("static");
    expect(classify(`${ORIGIN}/icons/icon-192.png`)).toBe("static");
    expect(classify(`${ORIGIN}/manifest.webmanifest`)).toBe("static");
  });

  test("navigations to /, /venues and /resources are network-first pages, query string or not", () => {
    expect(classify(`${ORIGIN}/`, { mode: "navigate" })).toBe("page");
    expect(classify(`${ORIGIN}/?venue=abc`, { mode: "navigate" })).toBe("page");
    expect(classify(`${ORIGIN}/venues`, { mode: "navigate" })).toBe("page");
    expect(classify(`${ORIGIN}/resources`, { mode: "navigate" })).toBe("page");
  });

  test("RSC payload fetches for the same paths are NOT cached (only real navigations are)", () => {
    expect(classify(`${ORIGIN}/venues?_rsc=1x2y`, { mode: "cors" })).toBe("bypass");
  });

  test("API, admin, auth, alert-token and live box routes are never touched", () => {
    expect(classify(`${ORIGIN}/api/public/blessing-boxes`, { mode: "cors" })).toBe("bypass");
    expect(classify(`${ORIGIN}/api/auth/get-session`, { mode: "cors" })).toBe("bypass");
    expect(classify(`${ORIGIN}/admin`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/admin/login`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/alerts/stop?t=secret`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/box/some-box`, { mode: "navigate" })).toBe("bypass");
  });

  test("Mapbox tiles/styles and every other cross-origin request are bypassed", () => {
    expect(classify("https://api.mapbox.com/styles/v1/mapbox/streets-v12")).toBe("bypass");
    expect(classify("https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v8/1/0/0.vector.pbf")).toBe("bypass");
    expect(classify("https://static.cloudflareinsights.com/beacon.min.js")).toBe("bypass");
    // A cross-origin URL that happens to share a static-looking path.
    expect(classify("https://evil.example/_next/static/x.js")).toBe("bypass");
  });

  test("non-GET requests are bypassed even on cacheable paths", () => {
    expect(classify(`${ORIGIN}/`, { method: "POST", mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/_next/static/chunks/a.js`, { method: "HEAD" })).toBe("bypass");
  });

  test("other same-origin pages and the worker script itself are left to the network", () => {
    expect(classify(`${ORIGIN}/about`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/venue/some-pantry`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/sw.js`)).toBe("bypass");
  });
});

describe("sw.js extractStaticAssets (#130)", () => {
  test("pulls every /_next/static URL out of page HTML, including RSC-escaped ones, deduped", () => {
    const { context } = loadSw();
    const html = `
      <link rel="stylesheet" href="/_next/static/css/a1.css"/>
      <script src="/_next/static/chunks/main-b2.js" async=""></script>
      <link rel="preload" as="script" href="/_next/static/chunks/main-b2.js"/>
      <script>self.__next_f.push([1,"2:I[\\"/_next/static/chunks/c3.js\\",\\"x\\"]"])</script>
      <img src="https://api.mapbox.com/not-this.png"/>`;
    expect([...context.extractStaticAssets(html)].sort()).toEqual([
      "/_next/static/chunks/c3.js",
      "/_next/static/chunks/main-b2.js",
      "/_next/static/css/a1.css",
    ]);
  });
});

describe("sw.js activate (#130)", () => {
  test("deletes older pfm-* caches, keeps the current one and foreign caches, claims clients", async () => {
    // Top-level `const`s live in the script's lexical scope, not on the
    // context object — evaluate the name in the same context to read it.
    const current = vm.runInContext("CACHE_NAME", loadSw().context) as string;
    expect(current).toMatch(/^pfm-/);
    const env = loadSw(SW_SOURCE, ["pfm-v0", current, "someone-elses-cache"]);
    let done: Promise<unknown> = Promise.resolve();
    env.listeners.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(env.deleted).toEqual(["pfm-v0"]);
    expect(env.self.clients.claim).toHaveBeenCalled();
  });

  test("kill switch: deletes every pfm-* cache, unregisters, and stops answering fetches", async () => {
    const killed = SW_SOURCE.replace("const KILL_SWITCH = false;", "const KILL_SWITCH = true;");
    expect(killed).not.toBe(SW_SOURCE);
    const env = loadSw(killed, ["pfm-v0", "pfm-v1", "someone-elses-cache"]);
    let done: Promise<unknown> = Promise.resolve();
    env.listeners.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(env.deleted.sort()).toEqual(["pfm-v0", "pfm-v1"]);
    expect(env.self.registration.unregister).toHaveBeenCalled();

    const respondWith = vi.fn();
    env.listeners.fetch({
      request: { url: `${ORIGIN}/`, method: "GET", mode: "navigate" },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  });
});
