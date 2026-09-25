/* global self, caches, fetch */
/**
 * Pueblo Food Map service worker (#130) — basic offline support.
 *
 * Hand-written on purpose (no Workbox/next-pwa): the whole job is four
 * decisions, and every dependency here would ship to low-end phones.
 * Registered by src/components/ServiceWorkerRegister.tsx in production builds
 * only, after the page has loaded. Served as a plain static file from
 * public/ (never bundled); public/_headers keeps it uncached so a new deploy's
 * copy is picked up on the next visit.
 *
 * What it does (see ARCHITECTURE.md "Offline / installable app" for the full
 * picture, including how to bust or disable it):
 *   - install: precache the app shell — the /, /venues and /resources HTML
 *     plus every hashed /_next/static asset those pages reference. Venue data
 *     is compiled into those pages/JS (src/data/published-venues.ts), so this
 *     is also the venue dataset. Precaching at install matters because the
 *     first visit's requests all happen BEFORE this worker controls the page.
 *   - static assets: stale-while-revalidate.
 *   - the three shell pages: network-first, cache fallback when offline.
 *   - everything else (API, admin, auth, alert tokens, live boxes, Mapbox,
 *     analytics, any other page) passes straight through, never cached.
 *
 * Bust every cache: bump CACHE_VERSION. Disable the worker for everyone:
 * set KILL_SWITCH = true and deploy (it clears its caches and unregisters).
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `pfm-${CACHE_VERSION}`;
const KILL_SWITCH = false;

const SHELL_PAGES = ["/", "/venues", "/resources"];

// Pages that must never come out of a cache: /api (live data, auth), /admin,
// /alerts (a subscription token rides in ?t=), /box (live D1 boxes).
const NEVER_CACHE_PREFIXES = ["/api", "/admin", "/alerts", "/box/"];
const STATIC_PREFIXES = ["/_next/static/", "/fonts/", "/icons/"];

// Matches /_next/static/... and /fonts/... in HTML attributes and in the RSC
// payload Next inlines as escaped JSON strings (stops at the escaping
// backslash). /fonts/ catches layout.tsx's Public Sans preload — without it
// the offline page falls back to a system font.
const STATIC_ASSET_RE = /\/(?:_next\/static|fonts)\/[^"'\s)\\<>]+/g;

/**
 * Decide how a request is handled. Pure, so it's unit-tested
 * (src/__tests__/serviceWorker.test.ts).
 * @param {{url: string, method: string, mode: string}} request
 * @param {string} origin this site's origin
 * @returns {"static" | "page" | "bypass"}
 */
function classifyRequest(request, origin) {
  if (request.method !== "GET") return "bypass";
  const url = new URL(request.url);
  if (url.origin !== origin) return "bypass"; // Mapbox, analytics, Turnstile
  const path = url.pathname;
  if (NEVER_CACHE_PREFIXES.some((p) => path === p || path.startsWith(p))) return "bypass";
  if (STATIC_PREFIXES.some((p) => path.startsWith(p))) return "static";
  if (path === "/manifest.webmanifest") return "static";
  // Navigations only: client-side route changes fetch `?_rsc=` payloads for
  // the same paths, which vary by request header and must not be stored.
  if (request.mode === "navigate" && SHELL_PAGES.includes(path)) return "page";
  return "bypass";
}

/** Every /_next/static and /fonts URL referenced by a page's HTML, deduped. */
function extractStaticAssets(html) {
  return new Set(html.match(STATIC_ASSET_RE) || []);
}

/** Cache names this worker owns but no longer uses. */
function staleCacheNames(keys, current) {
  return keys.filter((k) => k.startsWith("pfm-") && k !== current);
}

// A redirected response can't answer a navigation later, and an opaque or
// error response would be served forever — store only plain same-origin 200s.
function isCacheable(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const assets = new Set();
  await Promise.all(
    SHELL_PAGES.map(async (page) => {
      try {
        const res = await fetch(page);
        if (!isCacheable(res)) return;
        const html = await res.clone().text();
        await cache.put(page, res);
        for (const a of extractStaticAssets(html)) assets.add(a);
      } catch {
        // One page failing (offline mid-install) shouldn't block the rest.
      }
    }),
  );
  await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  const network = fetch(event.request).then((res) => {
    if (isCacheable(res)) cache.put(event.request, res.clone());
    return res;
  });
  if (cached) {
    // Hashed /_next/static files are `immutable` in the HTTP cache, so this
    // revalidation is normally answered from disk, not the network.
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

// ponytail: no network timeout — on a connection that hangs rather than
// fails, the page waits for the browser's own timeout before falling back.
// Upgrade path: race fetch() against a ~4s timer and serve the cache first.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  // Keyed by pathname so /?venue=x and / share one entry (bounded cache).
  const key = new URL(request.url).pathname;
  try {
    const res = await fetch(request);
    if (isCacheable(res)) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (!KILL_SWITCH) event.waitUntil(precacheShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const doomed = KILL_SWITCH ? keys.filter((k) => k.startsWith("pfm-")) : staleCacheNames(keys, CACHE_NAME);
      await Promise.all(doomed.map((k) => caches.delete(k)));
      if (KILL_SWITCH) {
        await self.registration.unregister();
        return;
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (KILL_SWITCH) return;
  const kind = classifyRequest(event.request, self.location.origin);
  if (kind === "static") event.respondWith(staleWhileRevalidate(event));
  else if (kind === "page") event.respondWith(networkFirst(event.request));
});
