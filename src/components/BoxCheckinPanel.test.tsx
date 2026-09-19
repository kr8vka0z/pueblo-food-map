/**
 * BoxCheckinPanel tests (Blessing Boxes slice 2). Same Turnstile/fetch
 * mocking convention as ReportForm.test.tsx: window.turnstile is stubbed to
 * resolve synchronously so the panel's buttons are enabled immediately.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";

// Slice 5 photo tests mock the shrink step — jsdom has no real
// canvas/createImageBitmap, and this component's own responsibility is the
// UI wiring around it, not re-proving imageResize.ts's own tested behavior
// (see that file's own test for the real shrink/HEIC-rejection coverage).
const mockShrinkImageToJpeg = vi.fn();
vi.mock("@/lib/imageResize", async () => {
  const actual = await vi.importActual<typeof import("@/lib/imageResize")>("@/lib/imageResize");
  return {
    ...actual,
    shrinkImageToJpeg: (...args: unknown[]) => mockShrinkImageToJpeg(...args),
  };
});

import BoxCheckinPanel from "@/components/BoxCheckinPanel";
import { UnsupportedImageError } from "@/lib/imageResize";

const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  mockTurnstile.render.mockClear();
  mockTurnstile.reset.mockClear();
  mockTurnstile.remove.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
  window.localStorage.clear();

  mockShrinkImageToJpeg.mockReset();
  mockShrinkImageToJpeg.mockResolvedValue(new Blob(["shrunk-jpeg-bytes"], { type: "image/jpeg" }));
  // jsdom implements neither — usePhotoAttach() calls both on every select/clear.
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake-url"), revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers(); // safety net for the fake-timer test below — a no-op when already real
});

const onCheckinSuccess = vi.fn();

function renderPanel(locale: "en" | "es" = "en") {
  onCheckinSuccess.mockClear();
  return render(
    <LocaleProvider initialLocale={locale}>
      <BoxCheckinPanel boxId="box-1" onCheckinSuccess={onCheckinSuccess} />
    </LocaleProvider>,
  );
}

function mockSuccess(status = "stocked", lastFilledAt: string | null = "2026-09-17T09:00:00.000Z") {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status, lastFilledAt }) });
}

/** A 'took' success carrying checkinId/needsToken — the only response shape that opens the needs ask. */
function mockSuccessWithNeedsToken(checkinId = 42, needsToken = "needs-token-abc") {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true, status: "unknown", lastFilledAt: null, checkinId, needsToken }),
  });
}

/**
 * The default `mockTurnstile` stub (module scope, above) hands back exactly
 * one token at mount and never re-fires on `reset()` — fine for every test
 * that submits once, wrong for a needs-ask Send, which submits a SECOND
 * request (the checkin, then the needs POST) after `submitCheckin` resets
 * the widget for its single-use-token rule. Mirrors the real widget's
 * `execution: "render"` auto-re-challenge the same way the "filled +
 * attached photo" chained-upload test (above) already does: `reset()`
 * asynchronously fires the SAME callback again with a fresh token, so a
 * queued (or direct) second submit has something to fire on.
 */
function stubTurnstileReExecutingOnReset() {
  let savedCallback: ((t: string) => void) | undefined;
  let calls = 0;
  vi.stubGlobal("turnstile", {
    render: vi.fn((_c: HTMLElement, opts: { callback?: (t: string) => void }) => {
      savedCallback = opts.callback;
      opts.callback?.("test-turnstile-token");
      return "widget-id-1";
    }),
    reset: vi.fn(() => {
      calls += 1;
      setTimeout(() => savedCallback?.(`test-turnstile-token-${calls + 1}`), 0);
    }),
    remove: vi.fn(),
  });
}

function mockError(error: string) {
  mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error }) });
}

describe("BoxCheckinPanel — rendering", () => {
  test("renders all five check-in buttons", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "I used this box" })).toBeDefined();
    });
    expect(screen.getByRole("button", { name: "I filled it" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Running low" })).toBeDefined();
    expect(screen.getByRole("button", { name: "It's empty" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeDefined();
  });

  test("Turnstile widget div is present in DOM", () => {
    renderPanel();
    expect(screen.getByTestId("turnstile-widget")).toBeDefined();
  });

  test("honeypot input is present but hidden", () => {
    renderPanel();
    const honeypot = document.getElementById("box-checkin-website");
    expect(honeypot).not.toBeNull();
    expect(honeypot!.closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ─── Widget visibility (card-polish follow-up, 2026-09-18, then a same-day
// fix once Kyle tested on a real phone) ────────────────────────────────────
// Kyle: "Do we need to show the Cloudflare check?" — first fixed with
// appearance: "interaction-only", then Kyle found the managed-mode widget
// still popped its checkbox on his phone even under that setting, so the
// panel now mounts a SEPARATE, dedicated invisible-mode Turnstile site key
// (NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY) instead — invisible mode never
// renders a checkbox at all, so `appearance` no longer matters and is
// dropped from the render call. The old "Verifying…" line is still gone
// since buttons are usable immediately regardless of token state.

describe("BoxCheckinPanel — Turnstile widget stays invisible by default", () => {
  test("render() uses the dedicated invisible-mode box site key, not the managed one", () => {
    const originalBoxKey = process.env.NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY = "invisible-box-key";
    try {
      renderPanel();
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ sitekey: "invisible-box-key" }),
      );
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ appearance: expect.anything() }),
      );
    } finally {
      process.env.NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY = originalBoxKey;
    }
  });

  test("no 'Verifying…' text anywhere, even before a token exists", async () => {
    // Turnstile that never calls back — token stays null for the whole test.
    vi.stubGlobal("turnstile", { render: vi.fn(() => "widget-id-1"), reset: vi.fn(), remove: vi.fn() });
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I used this box" })).toBeDefined());
    expect(screen.queryByText(/Verifying/i)).toBeNull();
  });

  test("buttons are tappable immediately, before any token exists", async () => {
    vi.stubGlobal("turnstile", { render: vi.fn(() => "widget-id-1"), reset: vi.fn(), remove: vi.fn() });
    renderPanel();
    const button = await screen.findByRole("button", { name: "I used this box" });
    expect(button).not.toBeDisabled();
  });
});

describe("BoxCheckinPanel — a tap before the token exists is queued, not dropped", () => {
  function renderPanelWithDelayedToken() {
    let deliverToken: ((token: string) => void) | null = null;
    vi.stubGlobal("turnstile", {
      render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
        deliverToken = opts.callback ?? null; // token withheld until the test delivers it
        return "widget-id-1";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    });
    renderPanel();
    return {
      deliver: (token: string) => {
        if (!deliverToken) throw new Error("Turnstile callback never captured");
        deliverToken(token);
      },
    };
  }

  test("a one-tap kind ('took') submits exactly once, the moment the token arrives", async () => {
    mockSuccess();
    const user = userEvent.setup();
    const { deliver } = renderPanelWithDelayedToken();
    const button = await screen.findByRole("button", { name: "I used this box" });

    await user.click(button);
    // Queued, not submitted yet — no token, and no dropped tap either.
    expect(mockFetch).not.toHaveBeenCalled();
    // A clear pending state on the tapped button, not a page-wide "Verifying…" line.
    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDefined();

    deliver("test-turnstile-token");

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.kind).toBe("took");
    expect(body.turnstileToken).toBe("test-turnstile-token");
  });

  test("a note-kind ('filled') submit is queued and fires once, with the typed note intact", async () => {
    mockSuccess();
    const user = userEvent.setup();
    const { deliver } = renderPanelWithDelayedToken();

    await user.click(await screen.findByRole("button", { name: "I filled it" }));
    await user.type(screen.getByLabelText(/Add a short note/i), "Topped it off");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mockFetch).not.toHaveBeenCalled();
    deliver("test-turnstile-token");

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.kind).toBe("filled");
    expect(body.note).toBe("Topped it off");
  });
});

// ─── Queued-tap recovery (bug fix follow-up, 2026-09-18) ──────────────────
// A tap queued while waiting on a token must not be stuck forever if the
// token never comes — the box widget's error-callback, or nothing calling
// back at all within PENDING_SUBMIT_TIMEOUT_MS. Since the fallback-widget
// follow-up (below), NEITHER of those failure modes fails the queued tap
// directly anymore — both now switch to the fallback widget first, and the
// tap only actually fails if the FALLBACK widget also errors. Captures
// every render() call's callbacks by index (0 = box widget, 1 = the
// fallback widget mounted on top of it) so a test can drive either stage.
describe("BoxCheckinPanel — a queued tap that never resolves is not stuck forever", () => {
  function renderPanelCapturingCallbacks() {
    const errorCallbacks: (() => void)[] = [];
    const tokenCallbacks: ((t: string) => void)[] = [];
    let widgetCount = 0;
    const renderMock = vi.fn(
      (_container: HTMLElement, opts: { "error-callback"?: () => void; callback?: (t: string) => void }) => {
        widgetCount += 1;
        if (opts["error-callback"]) errorCallbacks.push(opts["error-callback"]);
        if (opts.callback) tokenCallbacks.push(opts.callback);
        return `widget-id-${widgetCount}`;
      },
    );
    const removeMock = vi.fn();
    vi.stubGlobal("turnstile", { render: renderMock, reset: vi.fn(), remove: removeMock });
    renderPanel();
    return {
      renderMock,
      removeMock,
      fireBoxError: () => {
        if (!errorCallbacks[0]) throw new Error("box widget error-callback never captured");
        errorCallbacks[0]();
      },
      fireFallbackError: () => {
        if (!errorCallbacks[1]) throw new Error("fallback widget error-callback never captured — did it mount?");
        errorCallbacks[1]();
      },
      deliverFallbackToken: (token: string) => {
        if (!tokenCallbacks[1]) throw new Error("fallback widget callback never captured — did it mount?");
        tokenCallbacks[1](token);
      },
    };
  }

  test("box widget error-callback while a tap is queued switches to the fallback widget instead of failing it", async () => {
    const originalManagedKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "managed-fallback-key";
    try {
      const user = userEvent.setup();
      const { renderMock, removeMock, fireBoxError } = renderPanelCapturingCallbacks();

      await user.click(await screen.findByRole("button", { name: "I used this box" }));
      expect(await screen.findByRole("button", { name: "Sending…" })).toBeDefined();

      fireBoxError();

      // Box widget removed, fallback widget mounted in its place with the
      // shared managed key, default (visible) appearance — no `appearance`
      // override, same as ReportForm/SuggestForm/FeedbackForm's own render.
      await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
      expect(removeMock).toHaveBeenCalledWith("widget-id-1");
      expect(renderMock.mock.calls[1][1]).toEqual(
        expect.objectContaining({ sitekey: "managed-fallback-key" }),
      );
      expect(renderMock.mock.calls[1][1]).toEqual(expect.not.objectContaining({ appearance: expect.anything() }));
      // The tap is still queued (not failed) and the calm prompt replaces
      // the old dead-end error text.
      expect(screen.getByRole("button", { name: "Sending…" })).toBeDefined();
      expect(screen.queryByText("That didn't go through. Please try again.")).toBeNull();
      expect(screen.getByText(/tap the box below/i)).toBeDefined();
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalManagedKey;
    }
  });

  test("a queued tap fires once the fallback widget delivers a token, sending turnstileKey: 'fallback'", async () => {
    mockSuccess();
    const user = userEvent.setup();
    const { fireBoxError, deliverFallbackToken } = renderPanelCapturingCallbacks();

    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    fireBoxError();
    await waitFor(() => expect(screen.getByText(/tap the box below/i)).toBeDefined());
    expect(mockFetch).not.toHaveBeenCalled();

    deliverFallbackToken("fallback-token");

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.kind).toBe("took");
    expect(body.turnstileToken).toBe("fallback-token");
    expect(body.turnstileKey).toBe("fallback");
  });

  test("no token within the time limit also switches to the fallback widget, not a failure", () => {
    // Real userEvent/waitFor polling relies on real setTimeout ticks, which
    // freeze under fake timers — fireEvent + a synchronous act() advance
    // avoids that trap entirely (both are already act-aware).
    vi.useFakeTimers();
    const { renderMock } = renderPanelCapturingCallbacks();

    fireEvent.click(screen.getByRole("button", { name: "I used this box" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDefined();
    expect(screen.queryByText("That didn't go through. Please try again.")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("window.turnstile never having loaded at all — the 15s timeout fails the queued tap (no widget to fall back to)", () => {
    vi.stubGlobal("turnstile", undefined);
    vi.useFakeTimers();
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "I used this box" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined();
    expect(screen.getByRole("button", { name: "I used this box" })).not.toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("note text survives a failed queued submit once the FALLBACK widget also errors — the note form reopens with it intact", async () => {
    const user = userEvent.setup();
    const { fireBoxError, fireFallbackError } = renderPanelCapturingCallbacks();

    await user.click(await screen.findByRole("button", { name: "I filled it" }));
    await user.type(screen.getByLabelText(/Add a short note/i), "Topped it off");
    await user.click(screen.getByRole("button", { name: "Send" }));

    // Queued (no token yet) — the form closes at queue time, same as the
    // happy path in "a tap before the token exists is queued" above.
    expect(screen.queryByLabelText(/Add a short note/i)).toBeNull();

    fireBoxError(); // switches to fallback — tap stays queued, note stays lost-for-now
    await waitFor(() => expect(screen.getByText(/tap the box below/i)).toBeDefined());
    expect(screen.queryByLabelText(/Add a short note/i)).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();

    fireFallbackError(); // NOW it actually fails

    await waitFor(() => expect(screen.getByLabelText(/Add a short note/i)).toBeDefined());
    expect(screen.getByLabelText(/Add a short note/i)).toHaveValue("Topped it off");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("BoxCheckinPanel — one-tap kinds (took/low/empty)", () => {
  test("tapping 'I used this box' submits immediately, no note field ever shown", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I used this box" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I used this box" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText(/Add a short note/i)).toBeNull();

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/blessing-boxes/box-1/checkins");
    const body = JSON.parse(opts.body as string);
    expect(body.kind).toBe("took");
    expect(body.note).toBeUndefined();
    expect(body.turnstileToken).toBe("test-turnstile-token");
    expect(body.turnstileKey).toBe("box");
  });

  // `kind` was added to onCheckinSuccess's payload for the map-first card
  // rework (2026-09-18 scope addition) — the in-map card shows the single
  // most recent check-in inline, and needs to know WHICH kind just
  // succeeded (the POST response never echoes it back) to update that line
  // without a refetch.
  test("success calls onCheckinSuccess with the response's status/lastFilledAt and the submitted kind", async () => {
    mockSuccess("empty", null);
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "It's empty" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "It's empty" }));

    await waitFor(() =>
      expect(onCheckinSuccess).toHaveBeenCalledWith({ status: "empty", lastFilledAt: null, kind: "empty" }),
    );
  });

  test("resets the Turnstile widget after a successful submit (token is single-use)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "Running low" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "Running low" }));

    await waitFor(() => expect(mockTurnstile.reset).toHaveBeenCalledWith("widget-id-1"));
  });

  test("a client token is included from localStorage (non-identifying anti-abuse key)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I used this box" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I used this box" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.clientToken).toBe("string");
    expect(body.clientToken.length).toBeGreaterThan(0);
  });
});

describe("BoxCheckinPanel — note kinds (filled/problem)", () => {
  test("tapping 'I filled it' opens an optional note form instead of submitting immediately", async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I filled it" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I filled it" }));

    expect(screen.getByLabelText(/Add a short note/i)).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("submitting the note form with no text still succeeds (note is optional)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I filled it" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "I filled it" }));

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.kind).toBe("filled");
    expect(body.note).toBeUndefined();
  });

  test("a typed note is sent with a 'problem' report", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "Report a problem" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Report a problem" }));

    await user.type(screen.getByLabelText(/Add a short note/i), "Door is broken");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.kind).toBe("problem");
    expect(body.note).toBe("Door is broken");
  });

  test("Cancel closes the note form without submitting", async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I filled it" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "I filled it" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/Add a short note/i)).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("success shows the kind-specific success message", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I filled it" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "I filled it" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Thanks for filling it!")).toBeDefined();
    });
  });
});

describe("BoxCheckinPanel — error states", () => {
  test("rate_limit_visitor error shows the device-scoped inline message, not the generic error", async () => {
    mockError("rate_limit_visitor");
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I used this box" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I used this box" }));

    await waitFor(() => {
      expect(screen.getByText(/Too many check-ins/i)).toBeDefined();
    });
    expect(screen.queryByText("That didn't go through. Please try again.")).toBeNull();
  });

  test("rate_limit_box error shows the box-scoped inline message, not the visitor one", async () => {
    mockError("rate_limit_box");
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I used this box" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I used this box" }));

    await waitFor(() => {
      expect(screen.getByText(/unusual number of check-ins/i)).toBeDefined();
    });
    expect(screen.queryByText(/Too many check-ins from this device/i)).toBeNull();
  });

  test("a generic server error shows the fallback message", async () => {
    mockError("Not found");
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I used this box" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I used this box" }));

    await waitFor(() => {
      expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined();
    });
  });

  test("ES locale renders Spanish button labels", async () => {
    renderPanel("es");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Usé esta caja" })).toBeDefined();
    });
  });
});

// ─── Slice 5 — "Add a photo" (standalone) ──────────────────────────────────

describe("BoxCheckinPanel — Add a photo (standalone)", () => {
  test("renders a 6th 'Add a photo' button alongside the five check-in kinds", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add a photo" })).toBeDefined());
  });

  test("tapping it opens the picker with the disclosure line, closed by default", async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add a photo" })).toBeDefined());
    expect(screen.queryByText(/Photos are reviewed/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add a photo" }));
    expect(screen.getByText(/Photos are reviewed before they're shown publicly/i)).toBeDefined();
  });

  test("selecting a file shrinks it, shows a preview, and enables Send", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Add a photo" }));

    const input = document.getElementById("box-photo-standalone-input") as HTMLInputElement;
    const file = new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(input, file);

    await waitFor(() => expect(mockShrinkImageToJpeg).toHaveBeenCalledWith(file));
    await waitFor(() => expect(screen.getByAltText("Preview of the photo you selected")).toBeDefined());
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });

  test("an unsupported format shows a friendly error, never a raw exception, and no preview", async () => {
    mockShrinkImageToJpeg.mockRejectedValueOnce(new UnsupportedImageError());
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Add a photo" }));

    const input = document.getElementById("box-photo-standalone-input") as HTMLInputElement;
    const file = new File(["heic-bytes"], "photo.heic", { type: "image/heic" });
    await user.upload(input, file);

    await waitFor(() => expect(screen.getByText(/isn't supported/i)).toBeDefined());
    expect(screen.queryByAltText("Preview of the photo you selected")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("Remove clears the selection and disables Send again", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Add a photo" }));
    const input = document.getElementById("box-photo-standalone-input") as HTMLInputElement;
    await user.upload(input, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByAltText("Preview of the photo you selected")).toBeDefined());

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByAltText("Preview of the photo you selected")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  test("Send POSTs multipart form data with no checkinId, shows success, and resets the form", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Add a photo" }));
    const input = document.getElementById("box-photo-standalone-input") as HTMLInputElement;
    await user.upload(input, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText(/submitted for review/i)).toBeDefined());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/blessing-boxes/box-1/photos");
    const body = init.body as FormData;
    expect(body.get("checkinId")).toBeNull();
    expect(body.get("photo")).toBeInstanceOf(Blob);
    // Form closes after a successful send — the "Add a photo" toggle is available again, the disclosure text is gone.
    await waitFor(() => expect(screen.queryByText(/Photos are reviewed/i)).toBeNull());
  });
});

// ─── Slice 5 — photo attach on the "filled" note form ──────────────────────

describe("BoxCheckinPanel — photo attach on the 'filled' note form", () => {
  test("the 'filled' note form shows a photo-attach field; 'problem' does not", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I filled it" }));
    expect(screen.getByText("Add a photo (optional)")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(screen.queryByText("Add a photo (optional)")).toBeNull();
  });

  test("submitting 'filled' with an attached photo sends the checkin first, then chains the photo upload onto the NEXT Turnstile token", async () => {
    // Simulate Turnstile's real re-execution-on-reset behavior: render()
    // hands back token-1 immediately (matches every other test's default
    // mock); reset() — called right after the checkin POST resolves —
    // stands in for Turnstile's own automatic re-challenge and hands back
    // token-2, which is what the queued photo upload is waiting on.
    let savedCallback: ((t: string) => void) | undefined;
    vi.stubGlobal("turnstile", {
      render: vi.fn((_c: HTMLElement, opts: { callback?: (t: string) => void }) => {
        savedCallback = opts.callback;
        opts.callback?.("token-1");
        return "widget-id-1";
      }),
      // Fired asynchronously — the real widget's callback is never
      // synchronous (it follows a network round trip). A synchronous fire
      // here would race the component's own `setTurnstileToken(null)` call
      // that immediately follows `reset()` in submitCheckin, since both
      // would land in the same render batch and the null would win.
      reset: vi.fn(() => {
        setTimeout(() => savedCallback?.("token-2"), 0);
      }),
      remove: vi.fn(),
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: "stocked", lastFilledAt: null, checkinId: 42 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I filled it" }));

    const fileInput = document.getElementById("box-checkin-note-photo-input") as HTMLInputElement;
    await user.upload(fileInput, new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(mockShrinkImageToJpeg).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [checkinUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(checkinUrl).toBe("/api/public/blessing-boxes/box-1/checkins");
    const [photoUrl, photoInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(photoUrl).toBe("/api/public/blessing-boxes/box-1/photos");
    const body = photoInit.body as FormData;
    expect(body.get("checkinId")).toBe("42");
    expect(body.get("photo")).toBeInstanceOf(Blob);
  });
});

// ─── "What would help you next time?" ask (migration 0012) ────────────────

describe("BoxCheckinPanel — needs ask after 'took'", () => {
  test("a 'took' success carrying checkinId+needsToken replaces the button grid with the ask", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));

    expect(await screen.findByText("What would help you next time?")).toBeDefined();
    expect(screen.getByText("Tap any. This tells givers what to bring.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "I filled it" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Report a problem" })).toBeNull();
    // The thanks line still shows alongside the ask — success state is unconditional.
    expect(screen.getByText("Thanks — enjoy!")).toBeDefined();
  });

  test("renders all nine need chips as toggle buttons", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    for (const label of [
      "Canned food",
      "Fresh food",
      "Bread",
      "Baby items",
      "Diapers",
      "Hygiene items",
      "Pet food",
      "Water / drinks",
      "Warm clothing",
    ]) {
      const chip = screen.getByRole("button", { name: label });
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    }
  });

  test("tapping a chip toggles aria-pressed", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    const chip = screen.getByRole("button", { name: "Diapers" });
    await user.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    await user.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });

  test("Skip closes the ask, sends no request, and returns to the normal button grid", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.queryByText("What would help you next time?")).toBeNull();
    expect(await screen.findByRole("button", { name: "I filled it" })).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1); // only the original checkin POST
  });

  test("Send with nothing picked and nothing typed behaves like Skip — no request sent", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.queryByText("What would help you next time?")).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("Send with picks selected POSTs checkinId/needsToken/needs to the needs route and shows the thank-you message", async () => {
    stubTurnstileReExecutingOnReset();
    mockSuccessWithNeedsToken(42, "needs-token-abc");
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // the needs POST
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    await user.click(screen.getByRole("button", { name: "Diapers" }));
    await user.click(screen.getByRole("button", { name: "Canned food" }));
    await user.type(screen.getByLabelText(/Something else/i), "Extra formula too");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [url, init] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/public/blessing-boxes/box-1/needs");
    const body = JSON.parse(init.body as string);
    expect(body.checkinId).toBe(42);
    expect(body.needsToken).toBe("needs-token-abc");
    expect(body.needs.sort()).toEqual(["canned_food", "diapers"]);
    expect(body.note).toBe("Extra formula too");
    // The SECOND token this render — submitCheckin resets the single-use
    // widget right after the checkin POST, and stubTurnstileReExecutingOnReset
    // mirrors Turnstile's real auto-re-challenge with a fresh value.
    expect(body.turnstileToken).toBe("test-turnstile-token-2");

    expect(await screen.findByText("Got it — thank you.")).toBeDefined();
    expect(await screen.findByRole("button", { name: "I filled it" })).toBeDefined();
  });

  test("Send with only typed text (no chips picked) still submits", async () => {
    stubTurnstileReExecutingOnReset();
    mockSuccessWithNeedsToken();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    await user.type(screen.getByLabelText(/Something else/i), "Just diapers please");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const body = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
    expect(body.needs).toEqual([]);
    expect(body.note).toBe("Just diapers please");
  });

  test("a 'took' success with no checkinId (D1 didn't hand one back) never opens the ask", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, status: "unknown", lastFilledAt: null, checkinId: null }),
    });
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));

    await waitFor(() => expect(screen.getByText("Thanks — enjoy!")).toBeDefined());
    expect(screen.queryByText("What would help you next time?")).toBeNull();
  });

  test("'filled' never opens the ask, even with a checkinId in the response (only 'took' shows it)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, status: "stocked", lastFilledAt: null, checkinId: 7 }),
    });
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I filled it" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Thanks for filling it!")).toBeDefined());
    expect(screen.queryByText("What would help you next time?")).toBeNull();
  });

  test("focus moves to the ask's own heading when it appears", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));

    const heading = await screen.findByText("What would help you next time?");
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  test("a failed needs Send shows the generic error message and returns to the normal button grid", async () => {
    stubTurnstileReExecutingOnReset();
    mockSuccessWithNeedsToken();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, error: "not_found_or_expired" }) });
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "I used this box" }));
    await screen.findByText("What would help you next time?");

    await user.click(screen.getByRole("button", { name: "Diapers" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined());
    expect(await screen.findByRole("button", { name: "I filled it" })).toBeDefined();
  });

  test("ES locale renders the Spanish ask heading and chip labels", async () => {
    mockSuccessWithNeedsToken();
    const user = userEvent.setup();
    renderPanel("es");
    await user.click(await screen.findByRole("button", { name: "Usé esta caja" }));

    expect(await screen.findByText("¿Qué te ayudaría la próxima vez?")).toBeDefined();
    expect(screen.getByRole("button", { name: "Pañales" })).toBeDefined();
  });
});
