/**
 * AlertsStopContent tests (Blessing Boxes slice 6). The stop mutation
 * itself already happened server-side before this component ever renders
 * (src/app/alerts/stop/page.tsx) — these tests only cover rendering each
 * `result` state and the undo button's POST to /api/public/alerts/resubscribe.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  test("result 'stopped' -> shows the stopped message and an undo button", () => {
    render(<AlertsStopContent result="stopped" token="real-token" />);
    expect(screen.getByText(t("alerts.stop.body", "en"))).toBeDefined();
    expect(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") })).toBeDefined();
  });

  test("result 'invalid' -> shows the invalid message, no undo button", () => {
    render(<AlertsStopContent result="invalid" token="" />);
    expect(screen.getByText(t("alerts.stop.invalid", "en"))).toBeDefined();
    expect(screen.queryByRole("button", { name: t("alerts.stop.undoButton", "en") })).toBeNull();
  });

  test("result 'rateLimited' -> shows the rate-limited message", () => {
    render(<AlertsStopContent result="rateLimited" token="" />);
    expect(screen.getByText(t("alerts.stop.rateLimited", "en"))).toBeDefined();
  });

  test("result 'unavailable' -> shows the generic error message", () => {
    render(<AlertsStopContent result="unavailable" token="" />);
    expect(screen.getByText(t("alerts.confirm.error", "en"))).toBeDefined();
  });

  test("undo button posts the token and shows the undone message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<AlertsStopContent result="stopped" token="real-token" />);

    await user.click(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") }));

    await waitFor(() => expect(screen.getByText(t("alerts.stop.undone", "en"))).toBeDefined());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/alerts/resubscribe");
    expect(JSON.parse(init.body as string)).toEqual({ token: "real-token" });
  });

  test("undo failure shows the undo-error message and keeps the button", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "invalid_token" }) });
    render(<AlertsStopContent result="stopped" token="real-token" />);

    await user.click(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") }));

    await waitFor(() => expect(screen.getByText(t("alerts.stop.undoError", "en"))).toBeDefined());
    expect(screen.getByRole("button", { name: t("alerts.stop.undoButton", "en") })).toBeDefined();
  });
});
