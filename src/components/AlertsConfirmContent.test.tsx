/**
 * AlertsConfirmContent tests (Blessing Boxes slice 6). `next/navigation` is
 * re-mocked locally the same way BoxesActivityContent.test.tsx already
 * does (usePathname + useSearchParams + useRouter, all needed by the
 * PageNav this component renders) — no real router context in jsdom.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts/confirm",
  useSearchParams: () => searchParamsValue,
}));

import AlertsConfirmContent from "@/components/AlertsConfirmContent";
import { t } from "@/lib/i18n";

const mockFetch = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  searchParamsValue = new URLSearchParams({ t: "real-token" });
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlertsConfirmContent", () => {
  test("no token in the URL -> shows invalid state immediately, no fetch", () => {
    searchParamsValue = new URLSearchParams();
    render(<AlertsConfirmContent />);
    expect(screen.getByText(t("alerts.confirm.invalid", "en"))).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("with a token, shows the Confirm button and posts the token on click", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<AlertsConfirmContent />);

    expect(screen.getByText(t("alerts.confirm.body", "en"))).toBeDefined();
    await user.click(screen.getByRole("button", { name: t("alerts.confirm.button", "en") }));

    await waitFor(() => expect(screen.getByText(t("alerts.confirm.success", "en"))).toBeDefined());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/alerts/confirm");
    expect(JSON.parse(init.body as string)).toEqual({ token: "real-token" });
  });

  test("a false/invalid API response shows the invalid message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "invalid_token" }) });
    render(<AlertsConfirmContent />);

    await user.click(screen.getByRole("button", { name: t("alerts.confirm.button", "en") }));
    await waitFor(() => expect(screen.getByText(t("alerts.confirm.invalid", "en"))).toBeDefined());
  });

  test("a network failure shows the generic error message", async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<AlertsConfirmContent />);

    await user.click(screen.getByRole("button", { name: t("alerts.confirm.button", "en") }));
    await waitFor(() => expect(screen.getByText(t("alerts.confirm.error", "en"))).toBeDefined());
  });
});
