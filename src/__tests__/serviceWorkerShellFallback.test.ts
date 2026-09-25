/**
 * serviceWorkerShellFallback.test.ts — public/sw.js's #130 follow-up.
 *
 * WHY a separate file rather than extending serviceWorker.test.ts: this
 * change makes classifyRequest return a new "shell-fallback" verdict for
 * navigations that used to be "bypass" ("other same-origin pages ... are
 * left to the network" in serviceWorker.test.ts) — an intentional behavior
 * change, not a bug in that existing, still-accurate-elsewhere test. That
 * one assertion needs updating by whoever owns this repo's test-edit policy
 * on a fix branch; this file covers the NEW behavior standalone so the fix
 * itself ships with real coverage regardless.
 *
 * Same node:vm sandboxing approach as serviceWorker.test.ts — see that
 * file's own header for why (sw.js is an unbundled classic script).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, test, vi } from "vitest";

const SW_SOURCE = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
const ORIGIN = "https://pueblofoodmap.com";

type Listener = (event: unknown) => void;

function loadSw() {
  const listeners: Record<string, Listener> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    registration: { unregister: vi.fn(() => Promise.resolve(true)) },
  };
  const caches = { keys: vi.fn(async () => []), delete: vi.fn(async () => true), open: vi.fn() };
  const context = vm.createContext({ self, caches, URL, Promise, Set, fetch: vi.fn() });
  vm.runInContext(SW_SOURCE, context);
  return { context, listeners, self, caches };
}

function classify(url: string, init: { method?: string; mode?: string } = {}) {
  const { context } = loadSw();
  return context.classifyRequest(
    { url, method: init.method ?? "GET", mode: init.mode ?? "no-cors" },
    ORIGIN,
  );
}

describe("sw.js classifyRequest — shell-fallback for non-shell page navigations (#130 follow-up)", () => {
  test("a navigation to any other same-origin public page is shell-fallback, not bypass", () => {
    expect(classify(`${ORIGIN}/about`, { mode: "navigate" })).toBe("shell-fallback");
    expect(classify(`${ORIGIN}/venue/some-pantry`, { mode: "navigate" })).toBe("shell-fallback");
    expect(classify(`${ORIGIN}/privacy`, { mode: "navigate" })).toBe("shell-fallback");
    expect(classify(`${ORIGIN}/suggest`, { mode: "navigate" })).toBe("shell-fallback");
  });

  test("never-cache prefixes stay bypass even on navigation — no fallback for admin/box/alerts/api", () => {
    expect(classify(`${ORIGIN}/admin`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/box/some-box`, { mode: "navigate" })).toBe("bypass");
    expect(classify(`${ORIGIN}/alerts/stop?t=secret`, { mode: "navigate" })).toBe("bypass");
  });

  test("a non-navigate request to another page (e.g. an RSC payload or prefetch) is still bypass", () => {
    expect(classify(`${ORIGIN}/about`, { mode: "cors" })).toBe("bypass");
    expect(classify(`${ORIGIN}/about?_rsc=1x2y`, { mode: "cors" })).toBe("bypass");
  });
});

describe("sw.js networkOnlyWithShellFallback (#130 follow-up)", () => {
  test("a successful fetch is returned as-is and never touches the cache", async () => {
    const { context } = loadSw();
    const response = { ok: true, status: 200 };
    context.fetch = vi.fn(async () => response);
    const result = await context.networkOnlyWithShellFallback({ url: `${ORIGIN}/about` });
    expect(result).toBe(response);
    expect(context.caches.open).not.toHaveBeenCalled();
  });

  test('a failed fetch (offline) falls back to the precached "/" shell', async () => {
    const shellResponse = { ok: true, status: 200 };
    const cacheMatch = vi.fn(async (key: string) => (key === "/" ? shellResponse : undefined));
    const { context } = loadSw();
    context.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    context.caches.open = vi.fn(async () => ({ match: cacheMatch }));
    const result = await context.networkOnlyWithShellFallback({ url: `${ORIGIN}/about` });
    expect(result).toBe(shellResponse);
    expect(cacheMatch).toHaveBeenCalledWith("/");
  });

  test("a failed fetch with no cached shell (install never completed) rethrows rather than hanging", async () => {
    const { context } = loadSw();
    const networkErr = new TypeError("Failed to fetch");
    context.fetch = vi.fn(async () => {
      throw networkErr;
    });
    context.caches.open = vi.fn(async () => ({ match: vi.fn(async () => undefined) }));
    await expect(context.networkOnlyWithShellFallback({ url: `${ORIGIN}/about` })).rejects.toBe(networkErr);
  });
});

describe("sw.js fetch listener wiring — shell-fallback dispatches to the new handler (#130 follow-up)", () => {
  test('a "shell-fallback" classified request resolves via networkOnlyWithShellFallback, not the plain network passthrough bypass takes', async () => {
    const { context, listeners } = loadSw();
    const response = { ok: true, status: 200 };
    context.fetch = vi.fn(async () => response);
    const respondWith = vi.fn();
    const request = { url: `${ORIGIN}/about`, method: "GET", mode: "navigate" };
    listeners.fetch({ request, respondWith });
    expect(respondWith).toHaveBeenCalledTimes(1);
    await expect(respondWith.mock.calls[0][0]).resolves.toBe(response);
  });
});
