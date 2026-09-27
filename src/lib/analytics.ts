/**
 * analytics.ts — PostHog core (#485). Named `track()` calls inside
 * components ship in a later PR ("PR 2 - Admin", per the issue's final
 * comment) — this file only provides the init entry point, the event
 * allowlist, and the sanitizer those calls will use.
 *
 * WHY persistence: "memory" + person_profiles: "never", not cookieless_mode
 * (Kyle, 2026-09-26, "option B"): the issue originally chose
 * cookieless_mode: "always", but posthog-js creates no session manager in
 * that mode, so Session Replay never records (verified in iOS Simulator
 * Safari: only /ingest/e/ uploads, never replay snapshots). Memory
 * persistence keeps the privacy page's promises (no cookie, nothing stored
 * on the device) and lets replay work. Cost: every page load is a new
 * anonymous PostHog visitor, so **unique-visitor counts always come from
 * Cloudflare Web Analytics, never PostHog** (Kyle's condition for option B;
 * see #680/#681).
 *
 * WHY api_host: "/ingest": PostHog's own SDK bytes and API calls are proxied
 * same-origin through custom-worker.ts's /ingest handler (src/lib/
 * ingestTarget.ts + src/lib/ipMatch.ts) so ad-blockers that block third-party
 * analytics domains don't hide a large share of visits, and so Kyle's home
 * IP can be dropped before it ever reaches PostHog (PostHog's own "Discard
 * client IP data" project setting means PostHog itself can't filter by IP —
 * see #485 comment, 2026-09-26).
 *
 * WHY the /admin/* and internal-device checks live HERE (not just in the
 * mount point): initAnalytics() is the one place every future caller goes
 * through, so the "never track Kyle, never track admin" guarantee holds
 * regardless of where it's eventually called from.
 */

const INTERNAL_DEVICE_STORAGE_KEY = "pfm_internal";

type PostHogClient = {
  init: (key: string, config: Record<string, unknown>) => void;
  capture: (name: string, props?: Record<string, unknown>) => void;
};

// Set once initAnalytics() passes every gate and posthog-js has loaded.
// track() checks this rather than re-deriving the gates itself, so a
// caller that fires before/without init (or on a gated device) is a silent,
// zero-cost no-op — never a network call to an uninitialized SDK.
let client: PostHogClient | null = null;

/**
 * True if this browser is flagged as one of Kyle's own — set by the admin
 * sign-in success path (AdminLoginForm.tsx) via markInternalDevice(), since
 * memory-only persistence leaves no other durable, cross-network way to recognize
 * "this is Kyle's phone on cellular" (#485 comment, 2026-09-26).
 */
export function isInternalDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INTERNAL_DEVICE_STORAGE_KEY) === "1";
  } catch {
    // Storage can throw in a locked-down/private-browsing context — treat
    // as "not internal" rather than crash the caller.
    return false;
  }
}

/** Flags this browser as Kyle's own device. See isInternalDevice() WHY. */
export function markInternalDevice(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTERNAL_DEVICE_STORAGE_KEY, "1");
  } catch {
    // Best-effort — see isInternalDevice()'s try/catch.
  }
}

/** Clears the flag — the documented `/?internal=off` escape hatch. */
export function clearInternalDeviceFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(INTERNAL_DEVICE_STORAGE_KEY);
  } catch {
    // Best-effort — see isInternalDevice()'s try/catch.
  }
}

export { INTERNAL_DEVICE_STORAGE_KEY };

/**
 * The full named-event allowlist (#485 + its 2026-09-26 amendment comment,
 * "add these so the admin dashboard (#681) can show them"). Autocapture
 * covers raw clicks; these give them meaning. Exported so PR 2's component
 * code imports the constants rather than retyping event-name strings.
 */
export const EVENTS = {
  NEAR_ME_CLICKED: "near_me_clicked",
  LOCATION_PERMISSION: "location_permission",
  VENUE_OPENED: "venue_opened",
  DIRECTIONS_CLICKED: "directions_clicked",
  CALL_CLICKED: "call_clicked",
  WEBSITE_CLICKED: "website_clicked",
  SHARE_CLICKED: "share_clicked",
  FAVORITE_ADDED: "favorite_added",
  REPORT_OPENED: "report_opened",
  FILTER_TOGGLED: "filter_toggled",
  LOCALE_SWITCHED: "locale_switched",
  SEARCH_USED: "search_used",
  FORM_SUBMITTED: "form_submitted",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

const ALLOWED_EVENTS: ReadonlySet<string> = new Set(Object.values(EVENTS));

/**
 * Sanitizes a search box's raw text down to a `term` property, or omits it
 * entirely (#485 comment, 2026-09-26): kept only when, after lowercasing
 * and trimming, it is <=40 chars and contains no digit and no "@" — the
 * realistic shapes an address, phone number, or email take in a search box.
 * Never throws on odd input; anything that doesn't clearly qualify is
 * dropped rather than guessed at.
 */
export function sanitizeSearchTerm(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const term = raw.trim().toLowerCase();
  if (term.length === 0 || term.length > 40) return undefined;
  if (/[0-9@]/.test(term)) return undefined;
  return term;
}

/**
 * The one funnel every analytics event goes through. Unknown event names
 * are dropped (never forwarded to PostHog) so the allowlist above is the
 * single source of truth for what this app ever sends — #485's own
 * requirement ("a unit test asserting unknown event names are dropped").
 */
export async function track(
  name: EventName,
  props: Record<string, unknown> = {},
): Promise<void> {
  if (!ALLOWED_EVENTS.has(name)) return;
  if (!client) return;

  let finalProps = props;
  if (name === EVENTS.SEARCH_USED) {
    const { term, ...rest } = props as { term?: string; [key: string]: unknown };
    const sanitized = sanitizeSearchTerm(term);
    finalProps = sanitized === undefined ? rest : { ...rest, term: sanitized };
  }

  client.capture(name, finalProps);
}

/**
 * Test-only reset of the module-level `client` singleton. In production
 * initAnalytics() runs exactly once per page load, so nothing else ever
 * needs this — it exists purely so analytics.test.ts's gating cases (missing
 * key / admin path / internal device) don't inherit a `client` set by an
 * earlier test in the same file (ES modules are singletons per test file).
 */
export function _resetAnalyticsStateForTest(): void {
  client = null;
}

export type InitAnalyticsOptions = {
  /** Overrides NEXT_PUBLIC_POSTHOG_KEY — test-only escape hatch. */
  key?: string;
  /** Overrides window.location.pathname — test-only escape hatch. */
  pathname?: string;
  /** Overrides window.location.search — test-only escape hatch. */
  search?: string;
};

/**
 * Session replay sample rate — 1.0 (every session) for now. Named so a
 * future dial-down doesn't require re-reading posthog-js docs to find the
 * right field again (Kyle, 2026-09-26: reversed the issue's original
 * "replay OFF" decision after seeing the #681 dashboard mockup).
 */
export const SESSION_REPLAY_SAMPLE_RATE = 1.0;

/**
 * Loads and initializes posthog-js, or does nothing at all (no import, no
 * network call) if any gate fails: no key, an /admin/* path, or this
 * browser is flagged internal. Call once, after the caller's own deferred-
 * load trigger fires (e.g. useDeferredMapLoad) — this function does no
 * deferral of its own, so it stays a plain, testable async function rather
 * than duplicating that hook's timer/interaction logic. The SAME gate that
 * blocks event capture on /admin/* and opted-out devices also blocks
 * session replay: recording only starts inside posthog.init(), which these
 * three checks return before ever reaching.
 */
export async function initAnalytics(options: InitAnalyticsOptions = {}): Promise<void> {
  // `/?internal=off` (#485 comment, 2026-09-26) — the documented escape
  // hatch off Kyle's own opt-out flag. Checked unconditionally, before the
  // key/admin/internal gates below: clearing local state is harmless even
  // with no key configured, and it must work regardless of whether THIS
  // page load goes on to init PostHog.
  const search = options.search ?? (typeof window !== "undefined" ? window.location.search : "");
  if (new URLSearchParams(search).get("internal") === "off") {
    clearInternalDeviceFlag();
  }

  const key = options.key ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // No key configured — total no-op (local dev, tests, Lighthouse CI).

  const pathname =
    options.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return;

  if (isInternalDevice()) return;

  const posthog = (await import("posthog-js")).default as unknown as PostHogClient;
  posthog.init(key, {
    api_host: "/ingest",
    // Memory only: no cookie, no localStorage/sessionStorage (see header).
    persistence: "memory",
    person_profiles: "never",
    autocapture: true,
    capture_pageview: "history_change",
    // Session replay is ON (Kyle, 2026-09-26 — reverses the issue's original
    // "replay OFF" default; see #681, the admin dashboard mockup). Still
    // behind this same deferred initAnalytics() call, so it costs nothing
    // on first paint — the recorder's own JS loads inside posthog-js's
    // lazy-recorder chunk, fetched only once init() runs post-idle.
    disable_session_recording: false,
    session_recording: {
      // maskAllInputs (posthog-js default: true) already masks the typed
      // VALUE of every input/textarea, including the search box — kept
      // explicit here rather than relying on the library default, so a
      // future posthog-js major that flips its own default can't silently
      // start recording keystrokes. No maskTextSelector needed on top of
      // it: that option masks rendered non-input TEXT NODES (e.g. a card
      // number shown on the page), a different surface from input values.
      maskAllInputs: true,
      sampleRate: SESSION_REPLAY_SAMPLE_RATE,
    },
  });
  client = posthog;
}
