/**
 * /alerts/stop Server Component page tests (Blessing Boxes slice 6).
 *
 * 2026-09-18 security review (item 6): this page no longer mutates on its
 * own GET — it neither touches D1 nor calls stopSubscriptionByToken; it
 * only extracts `?t=` and hands it to AlertsStopContent, which owns the
 * mutation itself (a client-side auto-POST — see that component's own
 * header). These tests only prove the page's own token extraction; every
 * outcome/rendering path is AlertsStopContent.test.tsx's job.
 */

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/AlertsStopContent", () => ({
  default: (props: { token: string }) => <div data-testid="alerts-stop-content-stub" data-token={props.token} />,
}));

import AlertsStopPage from "@/app/alerts/stop/page";

describe("/alerts/stop page", () => {
  test("no token in the URL -> passes an empty token through", async () => {
    render(await AlertsStopPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.token).toBe("");
  });

  test("token in the URL -> passed through untouched (trimmed)", async () => {
    render(await AlertsStopPage({ searchParams: Promise.resolve({ t: "  real-token  " }) }));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.token).toBe("real-token");
  });

  test("no searchParams promise at all -> empty token, never throws", async () => {
    render(await AlertsStopPage({}));
    expect(screen.getByTestId("alerts-stop-content-stub").dataset.token).toBe("");
  });
});
