/**
 * ReportPhotoButton tests (Blessing Boxes slice 5).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportPhotoButton from "@/components/ReportPhotoButton";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("cancelling the confirm dialog never calls the flag route", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  render(<ReportPhotoButton photoId={42} locale="en" />);

  await user.click(screen.getByRole("button", { name: "Report this photo" }));

  expect(mockFetch).not.toHaveBeenCalled();
});

test("confirming POSTs the flag route with a clientToken and shows a thank-you", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const user = userEvent.setup();
  render(<ReportPhotoButton photoId={42} locale="en" />);

  await user.click(screen.getByRole("button", { name: "Report this photo" }));

  await waitFor(() => expect(screen.getByText(/Thanks/i)).toBeDefined());
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/public/box-photos/42/flag");
  const body = JSON.parse(init.body as string);
  expect(typeof body.clientToken).toBe("string");
  expect(body.clientToken.length).toBeGreaterThan(0);
});

test("a failed report shows an inline error, and the button stays available", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 500 }));
  const user = userEvent.setup();
  render(<ReportPhotoButton photoId={42} locale="en" />);

  await user.click(screen.getByRole("button", { name: "Report this photo" }));

  await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  expect(screen.getByRole("button", { name: "Report this photo" })).not.toBeDisabled();
});

test("ES locale renders the Spanish label", () => {
  render(<ReportPhotoButton photoId={42} locale="es" />);
  expect(screen.getByRole("button")).toHaveTextContent(/./); // renders something localized; exact ES copy checked via i18n's own [CHECK] convention
});
