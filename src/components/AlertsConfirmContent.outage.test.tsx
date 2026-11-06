/**
 * AlertsConfirmContent — a server outage is not an invalid link (#894 item 6).
 *
 * Only the route's explicit "invalid_token" answer may say the link is
 * invalid; a 5xx or an unreadable answer is temporary, so it says try again.
 */

import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/alerts/confirm",
  useSearchParams: () => new URLSearchParams({ t: "real-token" }),
}));

import AlertsConfirmContent from "@/components/AlertsConfirmContent";
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

test.each([
  ["a 502 db_unavailable answer", { ok: false, status: 502, json: async () => ({ ok: false, error: "db_unavailable" }) }, "alerts.confirm.error"],
  ["a 5xx with no JSON body", { ok: false, status: 503, json: async () => { throw new SyntaxError("not json"); } }, "alerts.confirm.error"],
  ["an invalid_token answer", { ok: true, status: 200, json: async () => ({ ok: false, error: "invalid_token" }) }, "alerts.confirm.invalid"],
])("%s shows the matching message", async (_label, response, key) => {
  mockFetch.mockResolvedValue(response);
  render(<AlertsConfirmContent />);
  await userEvent.setup().click(screen.getByRole("button", { name: t("alerts.confirm.button", "en") }));
  await waitFor(() => expect(screen.getByText(t(key, "en"))).toBeDefined());
});
