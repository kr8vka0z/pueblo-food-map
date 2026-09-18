/**
 * BoxCheckinPanel tests (Blessing Boxes slice 2). Same Turnstile/fetch
 * mocking convention as ReportForm.test.tsx: window.turnstile is stubbed to
 * resolve synchronously so the panel's buttons are enabled immediately.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxCheckinPanel from "@/components/BoxCheckinPanel";

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

function mockError(error: string) {
  mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error }) });
}

describe("BoxCheckinPanel — rendering", () => {
  test("renders all five check-in buttons", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "I took something" })).toBeDefined();
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
    await waitFor(() => expect(screen.getByRole("button", { name: "I took something" })).toBeDefined());
    expect(screen.queryByText(/Verifying/i)).toBeNull();
  });

  test("buttons are tappable immediately, before any token exists", async () => {
    vi.stubGlobal("turnstile", { render: vi.fn(() => "widget-id-1"), reset: vi.fn(), remove: vi.fn() });
    renderPanel();
    const button = await screen.findByRole("button", { name: "I took something" });
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
    const button = await screen.findByRole("button", { name: "I took something" });

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
// token never comes — Turnstile's error-callback, or nothing calling back
// at all within PENDING_SUBMIT_TIMEOUT_MS.
describe("BoxCheckinPanel — a queued tap that never resolves is not stuck forever", () => {
  function renderPanelCapturingCallbacks() {
    let fireError: (() => void) | null = null;
    vi.stubGlobal("turnstile", {
      render: vi.fn(
        (_container: HTMLElement, opts: { "error-callback"?: () => void }) => {
          // The token callback is never delivered in this describe block — every
          // test here is about a tap that's still queued when it fails.
          fireError = opts["error-callback"] ?? null;
          return "widget-id-1";
        },
      ),
      reset: vi.fn(),
      remove: vi.fn(),
    });
    renderPanel();
    return {
      fireError: () => {
        if (!fireError) throw new Error("Turnstile error-callback never captured");
        fireError();
      },
    };
  }

  test("Turnstile error-callback while a tap is queued clears it — buttons re-enabled, error shown", async () => {
    const user = userEvent.setup();
    const { fireError } = renderPanelCapturingCallbacks();

    await user.click(await screen.findByRole("button", { name: "I took something" }));
    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDefined();

    fireError();

    await waitFor(() => expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined());
    expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("no token within the time limit clears the queued tap the same way", () => {
    // Real userEvent/waitFor polling relies on real setTimeout ticks, which
    // freeze under fake timers — fireEvent + a synchronous act() advance
    // avoids that trap entirely (both are already act-aware).
    vi.useFakeTimers();
    renderPanelCapturingCallbacks();

    fireEvent.click(screen.getByRole("button", { name: "I took something" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined();
    expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("note text survives a failed queued submit — the note form reopens with it intact", async () => {
    const user = userEvent.setup();
    const { fireError } = renderPanelCapturingCallbacks();

    await user.click(await screen.findByRole("button", { name: "I filled it" }));
    await user.type(screen.getByLabelText(/Add a short note/i), "Topped it off");
    await user.click(screen.getByRole("button", { name: "Send" }));

    // Queued (no token yet) — the form closes at queue time, same as the
    // happy path in "a tap before the token exists is queued" above.
    expect(screen.queryByLabelText(/Add a short note/i)).toBeNull();

    fireError();

    await waitFor(() => expect(screen.getByLabelText(/Add a short note/i)).toBeDefined());
    expect(screen.getByLabelText(/Add a short note/i)).toHaveValue("Topped it off");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("BoxCheckinPanel — one-tap kinds (took/low/empty)", () => {
  test("tapping 'I took something' submits immediately, no note field ever shown", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I took something" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText(/Add a short note/i)).toBeNull();

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/blessing-boxes/box-1/checkins");
    const body = JSON.parse(opts.body as string);
    expect(body.kind).toBe("took");
    expect(body.note).toBeUndefined();
    expect(body.turnstileToken).toBe("test-turnstile-token");
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
    await waitFor(() => expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I took something" }));

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
    await waitFor(() => expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I took something" }));

    await waitFor(() => {
      expect(screen.getByText(/Too many check-ins/i)).toBeDefined();
    });
    expect(screen.queryByText("That didn't go through. Please try again.")).toBeNull();
  });

  test("rate_limit_box error shows the box-scoped inline message, not the visitor one", async () => {
    mockError("rate_limit_box");
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I took something" }));

    await waitFor(() => {
      expect(screen.getByText(/unusual number of check-ins/i)).toBeDefined();
    });
    expect(screen.queryByText(/Too many check-ins from this device/i)).toBeNull();
  });

  test("a generic server error shows the fallback message", async () => {
    mockError("Not found");
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("button", { name: "I took something" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "I took something" }));

    await waitFor(() => {
      expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined();
    });
  });

  test("ES locale renders Spanish button labels", async () => {
    renderPanel("es");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tomé algo" })).toBeDefined();
    });
  });
});
