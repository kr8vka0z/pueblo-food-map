/**
 * AlertsStopContent tests (Blessing Boxes slice 6).
 *
 * 2026-09-18 security review (item 6): this component now OWNS the stop
 * mutation (a client-side auto-POST on mount) rather than rendering a
 * result the server already computed — see the component's own header for
 * why. mockFetch is shared by two different endpoints (the auto-POST to
 * .../alerts/stop and the undo button's POST to .../alerts/resubscribe);
 * tests that need both distinguish by the requested URL.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts/stop",
  useSearchParams: () => new URLSearchParams(),
}));

import AlertsStopContent from "@/components/AlertsStopContent";
import { t } from "@/lib/i18n";

const mockFetch = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlertsStopContent", () => {
  test("no token -> shows the invalid message immediately, never calls fetch", () => {
    render(<AlertsStopContent token="" />);
    expect(screen.getByText(t("alerts.stop.invalid", "en"))).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("token present -> auto-POSTs to /api/public/alerts/stop with a JSON body on mount, no button needed", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<AlertsStopContent token="real-token" />);

    expect(screen.getByText(t("alerts.stop.stopping", "en"))).toBeDefined();
    await waitFor(() => expect(screen.getByText(t("alerts.stop.body", "en"))).toBeDefined());

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/alerts/stop");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ token: "real-token" });
  });

  test("stop response ok:false -> shows the invalid message", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "invalid_token" }) });
    render(<AlertsStopContent token="unknown-token" />);
    await waitFor(() => expect(screen.getByText(t("alerts.stop.invalid", "en"))).toBeDefined());
  });

  test("stop request throws -> shows the generic unavailable message", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<AlertsStopContent token="real-token" />);
    await waitFor(() => expect(screen.getByText(t("alerts.confirm.error", "en"))).toBeDefined());
  });

  test("non-OK HTTP status -> shows the generic unavailable message", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    render(<AlertsStopContent token="real-token" />);
    await waitFor(() => expect(screen.getByText(t("alerts.confirm.error", "en"))).toBeDefined());
  });

  test("<noscript> fallback form posts to the API route with the token in the query string", () => {
    // jsdom (like a real script-enabled browser) refuses to keep DOM
    // children under a client-rendered <noscript> at all — a JS-disabled
    // visitor never runs any client-side render in the first place, so
    // what actually matters is the SERVER-RENDERED HTML string a
    // JS-disabled browser receives and parses as real markup. Asserting on
    // that string (not a jsdom-rendered DOM tree) is the only way to prove
    // this fallback actually works.
    const html = renderToStaticMarkup(<AlertsStopContent token="real-token" />);
    expect(html).toContain("<noscript>");
    expect(html).toContain("/api/public/alerts/stop?t=real-token");
    expect(html).toContain('method="post"');
  });

  test("no token -> no <noscript> fallback form (nothing to submit)", () => {
    const { container } = render(<AlertsStopContent token="" />);
    expect(container.querySelector("noscript")).toBeNull();
  });

  test("undo button posts the token to /api/public/alerts/resubscribe and shows the undone message", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/public/alerts/stop") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => ({ ok: true }) };
    });
    render(<AlertsStopContent token="real-token" />);

    await waitFor(() => expect(screen.getByText(t("alerts.stop.body", "en"))).toBeDefined());
    await user.click(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") }));

    await waitFor(() => expect(screen.getByText(t("alerts.stop.undone", "en"))).toBeDefined());
    const resubscribeCall = mockFetch.mock.calls.find(([url]) => url === "/api/public/alerts/resubscribe");
    expect(resubscribeCall).toBeDefined();
    expect(JSON.parse((resubscribeCall![1] as RequestInit).body as string)).toEqual({ token: "real-token" });
  });

  test("undo failure shows the undo-error message and keeps the button", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(async (url: string) => {
      if (url === "/api/public/alerts/stop") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => ({ ok: false, error: "invalid_token" }) };
    });
    render(<AlertsStopContent token="real-token" />);

    await waitFor(() => expect(screen.getByText(t("alerts.stop.body", "en"))).toBeDefined());
    await user.click(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") }));

    await waitFor(() => expect(screen.getByText(t("alerts.stop.undoError", "en"))).toBeDefined());
    expect(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") })).toBeDefined();
  });
});
