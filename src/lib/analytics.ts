/**
 * analytics.ts — PostHog core (#485): the init gate, the event allowlist
 * and the sanitizer. Components call `track(EVENTS.X)`.
 *
 * WHY persistence: "sessionStorage" + person_profiles: "never", not
 * cookieless_mode: posthog-js creates no session manager in cookieless mode,
 * so Session Replay never records (verified in iOS Simulator Safari,
 * 2026-09-26). It was "memory" until #919, which made every page load a new
 * visit; Kyle (2026-11-13) approved a tab-only visit ID instead, so a walk
 * from the homepage to a place page to Spanish is one `$session_id`, and
 * closing the tab ends it. Still no cookie and no person profile, and the ID
 * never outlives the tab, so **unique-visitor counts always come from
 * Cloudflare Web Analytics, never PostHog** (#680/#681). The privacy page's
 * `privacy.analytics` text says exactly this; change both together.
 *
 * WHY the `returning` flag (#919): a bare "1" under RETURNING_STORAGE_KEY in
 * localStorage, no ID and no date, so PostHog can split first visits from
 * repeat ones without anything that tells one browser from another.
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
const RETURNING_STORAGE_KEY = "pfm_returning";

// The build's short commit, set by vite.config.ts's `define`. Undefined under
// vitest, whose config is separate, hence the typeof check.
declare const __SITE_VERSION__: string | undefined;
const SITE_VERSION = typeof __SITE_VERSION__ === "string" ? __SITE_VERSION__ : "dev";

type PostHogClient = {
  init: (key: string, config: Record<string, unknown>) => void;
  capture: (name: string, props?: Record<string, unknown>) => void;
  register: (props: Record<string, unknown>) => void;
  register_once: (props: Record<string, unknown>) => void;
  stopSessionRecording: () => void;
};

// Set once initAnalytics() passes every gate and posthog-js has loaded.
// track() checks this rather than re-deriving the gates itself: a caller
// that fires before init is queued (`pending` below), and one on a gated
// device is a silent no-op, never a network call to an uninitialized SDK.
let client: PostHogClient | null = null;

// Events tracked before posthog-js has loaded (#919 review: the splash's tour
// tap and nearest_food can fire before the deferred init). Flushed once init
// succeeds; set to null, dropping them, the moment any gate refuses (no key,
// /admin, internal device), so the gates still win. ponytail: capped at
// MAX_PENDING and anything past it is dropped; nothing tracked before init
// comes close in practice.
const MAX_PENDING = 20;
let pending: [EventName, Record<string, unknown>][] | null = [];

// Set the first time an event would be sent from an /admin page (#861).
// Once set, nothing more is sent for the rest of this page load, public
// pages included: the visitor who walked into /admin is almost always Kyle,
// and markInternalDevice() at sign-in makes it permanent from the next load.
let stoppedForAdmin = false;

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * True if this browser is flagged as one of Kyle's own — set by the admin
 * sign-in success path (AdminLoginForm.tsx) via markInternalDevice(), since
 * PostHog's tab-only persistence leaves no other durable, cross-network way
 * to recognize "this is Kyle's phone on cellular" (#485 comment, 2026-09-26).
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

/** Whether this browser has visited before, then notes that it has. See the header's `returning` WHY. */
function readAndMarkReturning(): boolean {
  try {
    const seen = window.localStorage.getItem(RETURNING_STORAGE_KEY) === "1";
    if (!seen) window.localStorage.setItem(RETURNING_STORAGE_KEY, "1");
    return seen;
  } catch {
    return false; // Private mode can refuse storage — count it as a first visit.
  }
}

/** Facts sent on every event (#919): the build, the connection and the display settings. Nothing about the person. */
function deviceFacts(): Record<string, unknown> {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
    standalone?: boolean; // iOS Safari's home-screen flag
  };
  const media = (query: string) => window.matchMedia?.(query).matches ?? false;
  const facts: Record<string, unknown> = {
    site_version: SITE_VERSION,
    standalone: media("(display-mode: standalone)") || nav.standalone === true,
    dark_mode: media("(prefers-color-scheme: dark)"),
    reduced_motion: media("(prefers-reduced-motion: reduce)"),
  };
  // Chromium only; Safari and Firefox have no navigator.connection.
  if (nav.connection?.effectiveType) facts.effective_type = nav.connection.effectiveType;
  if (typeof nav.connection?.saveData === "boolean") facts.save_data = nav.connection.saveData;
  return facts;
}

/**
 * The full named-event allowlist (#485 + its 2026-09-26 amendment comment,
 * "add these so the admin dashboard (#681) can show them"). Autocapture
 * covers raw clicks; these give them meaning. Components import the
 * constants rather than retyping event-name strings.
 */
export const EVENTS = {
  NEAR_ME_CLICKED: "near_me_clicked",
  LOCATION_PERMISSION: "location_permission",
  VENUE_OPENED: "venue_opened",
  DIRECTIONS_CLICKED: "directions_clicked",
  CALL_CLICKED: "call_clicked",
  WEBSITE_CLICKED: "website_clicked",
  DONATE_CLICKED: "donate_clicked", // #736: Menu Donate card
  SHARE_CLICKED: "share_clicked",
  FAVORITE_ADDED: "favorite_added",
  REPORT_OPENED: "report_opened",
  FILTER_TOGGLED: "filter_toggled",
  LOCALE_SWITCHED: "locale_switched",
  SEARCH_USED: "search_used",
  // #919: the rest of what people do on the site. Taps that also exist off
  // the map (call, directions, website) carry `surface: "map" | "venue_page"`.
  BOX_CHECKIN: "box_checkin",
  BOX_PHOTO_UPLOADED: "box_photo_uploaded",
  BOX_ADOPTED: "box_adopted",
  EVENT_OPENED: "event_opened",
  EVENT_SHARED: "event_shared",
  EVENT_CALENDAR_ADDED: "event_calendar_added",
  SUGGESTION_SENT: "suggestion_sent",
  REPORT_SENT: "report_sent",
  VIEW_SWITCHED: "view_switched",
  NAV_TAB: "nav_tab",
  WELCOME_CLOSED_WITHOUT_NEAR_ME: "welcome_closed_without_near_me",
  MAP_MOVED: "map_moved",
  NEAREST_FOOD: "nearest_food",
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

  let finalProps = props;
  if (name === EVENTS.SEARCH_USED) {
    const { term, ...rest } = props as { term?: string; [key: string]: unknown };
    const sanitized = sanitizeSearchTerm(term);
    finalProps = sanitized === undefined ? rest : { ...rest, term: sanitized };
  }

  if (client) client.capture(name, finalProps);
  else if (pending && pending.length < MAX_PENDING) pending.push([name, finalProps]);
}

/** Probes sessionStorage: posthog-js silently falls back to localStorage and cookies when it can't use it (#919 review). */
function sessionStorageWorks(): boolean {
  try {
    window.sessionStorage.setItem("pfm_probe", "1");
    window.sessionStorage.removeItem("pfm_probe");
    return true;
  } catch {
    return false;
  }
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
  stoppedForAdmin = false;
  pending = [];
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
 * Session replay sample rate: 0.2 records one visit in five (#722). Recording
 * every visit cost CPU and data on the audience's phones; one in five still
 * gives the #681 dashboard plenty to watch. Kyle can change the number here.
 */
export const SESSION_REPLAY_SAMPLE_RATE = 0.2;

/**
 * Never recorded by replay (#722): the map container mapbox-gl marks with
 * this class, which holds the canvas, every pin and the map popups. The
 * recorder otherwise re-records ~130 pins on every pan frame. Replay shows a
 * blank box of the same size; autocapture and the named events still fire.
 */
export const REPLAY_BLOCK_SELECTOR = ".mapboxgl-map, .ph-no-capture";

/**
 * Class for page text that is someone's unsent personal input shown back as
 * ordinary text, which maskAllInputs does not cover (#883: the "Share an
 * event" live preview card, address-check results and the phone preview
 * sheet). posthog-js skips it in autocapture and its recorder blocks it by
 * default; it is also in REPLAY_BLOCK_SELECTOR so that holds even if a
 * posthog-js release changes its own default.
 */
export const NO_CAPTURE_CLASS = "ph-no-capture";

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
  const pathname =
    options.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  // No key (local dev, tests, Lighthouse CI), /admin, or Kyle's own device:
  // a total no-op, and anything queued before now is dropped unsent.
  if (!key || isAdminPath(pathname) || isInternalDevice()) {
    pending = null;
    return;
  }

  const posthog = (await import("posthog-js")).default as unknown as PostHogClient;
  posthog.init(key, {
    api_host: "/ingest",
    // Tab-only: the visit ID lives in sessionStorage, never a cookie (see
    // header). Where sessionStorage is refused, memory, never posthog-js's
    // own fallback to localStorage and cookies, which would outlive the tab.
    persistence: sessionStorageWorks() ? "sessionStorage" : "memory",
    person_profiles: "never",
    autocapture: true,
    // No PostHog surveys exist (project 630731 has zero, checked 2026-09-29) and
    // the site never renders one, yet posthog-js fetched its ~30 KB surveys.js
    // bundle on every page whenever the project's surveys flag was on. Turning
    // it off only skips that download; it changes nothing that is collected.
    disable_surveys: true,
    capture_pageview: "history_change",
    // #861: the gates above only see the FIRST page. A visitor who then
    // follows a link into /admin stays on the same page load, and
    // history_change pageviews, autocapture and replay would keep running.
    // Every one of those (replay's $snapshot batches included) goes through
    // before_send, which reads the address at send time, so the move is
    // caught before any React effect could run: drop the event, stop the
    // recorder, and send nothing more from this page load.
    before_send: (event: unknown) => {
      if (stoppedForAdmin) return null;
      if (!isAdminPath(window.location.pathname)) return event;
      stoppedForAdmin = true;
      client = null;
      pending = null;
      posthog.stopSessionRecording();
      return null;
    },
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
      blockSelector: REPLAY_BLOCK_SELECTOR,
    },
    // Exception and dead-click autocapture are switched on in the PostHog
    // project settings (#919); posthog-js follows the project when these
    // options are left unset, so they are deliberately absent here.
  });
  // Registered straight after init(): posthog-js sends the first pageview on
  // a timer, so these ride on it too.
  posthog.register(deviceFacts());
  // register_once keeps the tab's first answer (it persists in
  // sessionStorage), so a first visit's second page doesn't flip to true.
  posthog.register_once({ returning: readAndMarkReturning() });
  // Location permission as it stands before any prompt; query() never asks.
  // Async, so the first pageview may go without it.
  navigator.permissions
    ?.query({ name: "geolocation" })
    .then((status) => posthog.register({ geo_permission: status.state }))
    .catch(() => {});
  client = posthog;
  for (const [name, props] of pending ?? []) posthog.capture(name, props);
  pending = null;
}
