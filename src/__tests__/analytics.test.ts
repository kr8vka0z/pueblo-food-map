/**
 * Unit tests for src/lib/analytics.ts's pure pieces — the `track()`
 * allowlist and the search-term sanitizer (#485 core). These run against
 * a stubbed posthog-js module so no real SDK, network call, or dynamic
 * import is exercised — the deferred-load/init wiring itself is a thin
 * effect in <Analytics /> not worth a jsdom timer test (mirrors
 * useDeferredMapLoad.test.ts, already covering the shared hook).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const capture = vi.fn();
const init = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init,
    capture,
    opt_out_capturing: vi.fn(),
  },
}));

import {
  track,
  initAnalytics,
  EVENTS,
  isInternalDevice,
  markInternalDevice,
  clearInternalDeviceFlag,
  INTERNAL_DEVICE_STORAGE_KEY,
  SESSION_REPLAY_SAMPLE_RATE,
  _resetAnalyticsStateForTest,
} from "@/lib/analytics";

describe("track — event allowlist", () => {
  beforeEach(async () => {
    capture.mockClear();
    window.localStorage.clear();
    // A test key + non-admin pathname passed explicitly (rather than via
    // process.env/window.location) puts analytics into the "initialized"
    // state deterministically — see analytics.ts's initAnalytics() header
    // for why the real entry point reads these from the environment
    // instead.
    await initAnalytics({ key: "test-key", pathname: "/" });
  });

  test("known events are forwarded to posthog.capture", async () => {
    await track(EVENTS.VENUE_OPENED, { category: "pantry", venue_id: "abc" });
    expect(capture).toHaveBeenCalledWith(EVENTS.VENUE_OPENED, {
      category: "pantry",
      venue_id: "abc",
    });
  });

  test("an unknown event name is dropped, not forwarded", async () => {
    // @ts-expect-error deliberately calling with a name outside the allowlist
    await track("totally_made_up_event", { foo: "bar" });
    expect(capture).not.toHaveBeenCalled();
  });

  test("every EVENTS constant is itself a known/allowed event", async () => {
    for (const name of Object.values(EVENTS)) {
      await track(name, {});
    }
    expect(capture).toHaveBeenCalledTimes(Object.values(EVENTS).length);
  });
});

describe("track — search_used term sanitizer", () => {
  beforeEach(async () => {
    capture.mockClear();
    window.localStorage.clear();
    await initAnalytics({ key: "test-key", pathname: "/" });
  });

  test("a short, plain term is kept (lowercased and trimmed)", async () => {
    await track(EVENTS.SEARCH_USED, { results: 3, term: "  Free Pantry  " });
    expect(capture).toHaveBeenCalledWith(EVENTS.SEARCH_USED, {
      results: 3,
      term: "free pantry",
    });
  });

  test("a term over 40 characters is omitted", async () => {
    const long = "a".repeat(41);
    await track(EVENTS.SEARCH_USED, { results: 0, term: long });
    expect(capture).toHaveBeenCalledWith(EVENTS.SEARCH_USED, { results: 0 });
  });

  test("a term containing a digit is omitted (likely an address/phone)", async () => {
    await track(EVENTS.SEARCH_USED, { results: 0, term: "123 Main St" });
    expect(capture).toHaveBeenCalledWith(EVENTS.SEARCH_USED, { results: 0 });
  });

  test("a term containing @ is omitted (likely an email)", async () => {
    await track(EVENTS.SEARCH_USED, { results: 0, term: "me@example.com" });
    expect(capture).toHaveBeenCalledWith(EVENTS.SEARCH_USED, { results: 0 });
  });

  test("results is always sent even with no term", async () => {
    await track(EVENTS.SEARCH_USED, { results: 5 });
    expect(capture).toHaveBeenCalledWith(EVENTS.SEARCH_USED, { results: 5 });
  });

  test("a 40-character term (boundary) is kept", async () => {
    const exactly40 = "a".repeat(40);
    await track(EVENTS.SEARCH_USED, { results: 1, term: exactly40 });
    expect(capture).toHaveBeenCalledWith(EVENTS.SEARCH_USED, {
      results: 1,
      term: exactly40,
    });
  });
});

describe("initAnalytics — gating (no-op cases)", () => {
  beforeEach(() => {
    capture.mockClear();
    init.mockClear();
    window.localStorage.clear();
    _resetAnalyticsStateForTest();
  });

  test("missing key is a no-op — never calls posthog.init, track() never reaches posthog", async () => {
    await initAnalytics({ key: undefined, pathname: "/" });
    expect(init).not.toHaveBeenCalled();
    await track(EVENTS.VENUE_OPENED, { category: "pantry", venue_id: "abc" });
    expect(capture).not.toHaveBeenCalled();
  });

  test("/admin/* paths are skipped even with a key — posthog.init never runs (no replay either)", async () => {
    await initAnalytics({ key: "test-key", pathname: "/admin/places" });
    expect(init).not.toHaveBeenCalled();
    await track(EVENTS.VENUE_OPENED, { category: "pantry", venue_id: "abc" });
    expect(capture).not.toHaveBeenCalled();
  });

  test("an internal device (pfm_internal flag) is skipped even with a key — posthog.init never runs", async () => {
    markInternalDevice();
    await initAnalytics({ key: "test-key", pathname: "/" });
    expect(init).not.toHaveBeenCalled();
    await track(EVENTS.VENUE_OPENED, { category: "pantry", venue_id: "abc" });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("initAnalytics — init options (session replay, masking)", () => {
  beforeEach(() => {
    init.mockClear();
    window.localStorage.clear();
    _resetAnalyticsStateForTest();
  });

  test("session replay is ON, masking every input, at the named sample rate", async () => {
    await initAnalytics({ key: "test-key", pathname: "/" });
    expect(init).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({
        disable_session_recording: false,
        session_recording: expect.objectContaining({
          maskAllInputs: true,
          sampleRate: SESSION_REPLAY_SAMPLE_RATE,
        }),
      }),
    );
  });

  test("memory-only persistence (no cookie, nothing stored) and no cookieless_mode, which would disable replay", async () => {
    await initAnalytics({ key: "test-key", pathname: "/" });
    expect(init).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({
        api_host: "/ingest",
        persistence: "memory",
        person_profiles: "never",
      }),
    );
    const [, config] = init.mock.calls[0] as [string, Record<string, unknown>];
    expect(config).not.toHaveProperty("cookieless_mode");
  });

  test("does not override autocapture/heatmaps/web-vitals off — leaves them to PostHog remote config", async () => {
    await initAnalytics({ key: "test-key", pathname: "/" });
    const [, config] = init.mock.calls[0] as [string, Record<string, unknown>];
    expect(config).not.toHaveProperty("enable_heatmaps");
    expect(config).not.toHaveProperty("capture_performance");
    expect(config.autocapture).not.toBe(false);
  });
});

describe("admin device opt-out flag", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("isInternalDevice is false with no flag set", () => {
    expect(isInternalDevice()).toBe(false);
  });

  test("markInternalDevice sets the flag and isInternalDevice reads it", () => {
    markInternalDevice();
    expect(window.localStorage.getItem(INTERNAL_DEVICE_STORAGE_KEY)).toBe("1");
    expect(isInternalDevice()).toBe(true);
  });

  test("clearInternalDeviceFlag removes it", () => {
    markInternalDevice();
    clearInternalDeviceFlag();
    expect(isInternalDevice()).toBe(false);
  });
});

describe("initAnalytics — ?internal=off escape hatch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    _resetAnalyticsStateForTest();
  });

  test("clears the internal-device flag even with no key configured", async () => {
    markInternalDevice();
    await initAnalytics({ key: undefined, pathname: "/", search: "?internal=off" });
    expect(isInternalDevice()).toBe(false);
  });

  test("a plain page load (no ?internal=off) leaves the flag untouched", async () => {
    markInternalDevice();
    await initAnalytics({ key: undefined, pathname: "/", search: "" });
    expect(isInternalDevice()).toBe(true);
  });
});
