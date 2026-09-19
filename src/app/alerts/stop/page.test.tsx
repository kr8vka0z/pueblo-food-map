/**
 * /alerts/stop Server Component page tests (Blessing Boxes slice 6).
 * AlertsStopContent is mocked to a stub echoing its received props as
 * data-attributes — its own rendering/undo behavior is covered by
 * AlertsStopContent.test.tsx; this file only proves the page's own
 * GET-time stopSubscriptionByToken() call and result mapping.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockStopSubscriptionByToken = vi.fn();
vi.mock("@/lib/boxAlerts", () => ({
  stopSubscriptionByToken: (...args: unknown[]) => mockStopSubscriptionByToken(...args),
}));

vi.mock("@/lib/logger", () => ({
  logBlessingBoxesReadFailure: vi.fn(),
}));

vi.mock("@/components/AlertsStopContent", () => ({
  default: (props: { result: string; token: string }) => (
    <div data-testid="alerts-stop-content-stub" data-result={props.result} data-token={props.token} />
  ),
}));

import AlertsStopPage from "@/app/alerts/stop/page";

describe("/alerts/stop page", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} as D1Database } });
    mockStopSubscriptionByToken.mockReset();
    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("no token in the URL -> 'invalid', never calls stopSubscriptionByToken", async () => {
    render(await AlertsStopPage({ searchParams: Promise.resolve({}) }));
    const el = screen.getByTestId("alerts-stop-content-stub");
    expect(el.dataset.result).toBe("invalid");
    expect(el.dataset.token).toBe("");
    expect(mockStopSubscriptionByToken).not.toHaveBeenCalled();
  });

  test("'stopped' result -> passes the token through for the undo button", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("stopped");
    render(await AlertsStopPage({ searchParams: Promise.resolve({ t: "real-token" }) }));
    const el = screen.getByTestId("alerts-stop-content-stub");
    expect(el.dataset.result).toBe("stopped");
    expect(el.dataset.token).toBe("real-token");
    expect(mockStopSubscriptionByToken).toHaveBeenCalledWith({}, "real-token", "test-secret");
  });

  test("'not_found' -> 'invalid'", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("not_found");
    render(await AlertsStopPage({ searchParams: Promise.resolve({ t: "unknown-token" }) }));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.result).toBe("invalid");
  });

  test("'rate_limited' -> 'rateLimited' (the page itself keeps this distinct from 'invalid' — only the JSON API routes fold them together)", async () => {
    mockStopSubscriptionByToken.mockResolvedValue("rate_limited");
    render(await AlertsStopPage({ searchParams: Promise.resolve({ t: "spammed-token" }) }));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.result).toBe("rateLimited");
  });

  test("missing CHECKIN_RATE_LIMIT_SECRET -> 'unavailable', never calls stopSubscriptionByToken", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    render(await AlertsStopPage({ searchParams: Promise.resolve({ t: "real-token" }) }));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.result).toBe("unavailable");
    expect(mockStopSubscriptionByToken).not.toHaveBeenCalled();
  });

  test("no live Cloudflare context -> 'unavailable', never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no context");
    });
    render(await AlertsStopPage({ searchParams: Promise.resolve({ t: "real-token" }) }));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.result).toBe("unavailable");
  });
});
