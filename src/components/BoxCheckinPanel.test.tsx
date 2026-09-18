/**
 * BoxCheckinPanel tests (Blessing Boxes slice 2). Same Turnstile/fetch
 * mocking convention as ReportForm.test.tsx: window.turnstile is stubbed to
 * resolve synchronously so the panel's buttons are enabled immediately.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
