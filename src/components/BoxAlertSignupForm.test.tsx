/**
 * BoxAlertSignupForm tests (Blessing Boxes slice 6). Mirrors
 * AdoptBoxForm.test.tsx's mocking convention exactly — the two components
 * share the same Turnstile/queued-submit shape.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxAlertSignupForm from "@/components/BoxAlertSignupForm";

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
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  mockTurnstile.render.mockClear();
  mockTurnstile.reset.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderForm(locale: "en" | "es" = "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <BoxAlertSignupForm boxId="box-1" />
    </LocaleProvider>,
  );
}

describe("BoxAlertSignupForm", () => {
  test("starts collapsed as a plain link", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Email me when it needs filling" })).toBeDefined();
    expect(screen.queryByLabelText(/your email/i)).toBeNull();
  });

  test("expands to the email field on tap", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Email me when it needs filling" }));
    expect(screen.getByLabelText(/your email/i)).toBeDefined();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeDefined();
  });

  test("submits and shows the generic success confirmation (never reveals new/resend/noop/reactivate)", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Email me when it needs filling" }));
    await user.type(screen.getByLabelText(/your email/i), "giver@example.com");
    await user.click(screen.getByRole("button", { name: "Sign me up" }));

    await waitFor(() => expect(screen.getByText("Check your email to confirm.")).toBeDefined());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/blessing-boxes/box-1/alerts");
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("giver@example.com");
    expect(body.lang).toBe("en"); // single-language alert emails: sends the page's own current locale
  });

  test("sends 'es' when the page's own locale is Spanish", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderForm("es");
    await user.click(screen.getByRole("button", { name: "Avísame cuando necesite surtido" }));
    await user.type(screen.getByLabelText(/tu correo/i), "giver@example.com");
    await user.click(screen.getByRole("button", { name: "Suscribirme" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.lang).toBe("es");
  });

  test("a rate-limit error response shows the rate-limit message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "rate_limit_email" }) });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Email me when it needs filling" }));
    await user.type(screen.getByLabelText(/your email/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Sign me up" }));

    await waitFor(() => expect(screen.getByText("Too many attempts right now. Please try again later.")).toBeDefined());
  });

  test("any other error response shows the generic error message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "send_failed" }) });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Email me when it needs filling" }));
    await user.type(screen.getByLabelText(/your email/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Sign me up" }));

    await waitFor(() => expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined());
  });

  test("Cancel collapses the form back to the plain link", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Email me when it needs filling" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText(/your email/i)).toBeNull();
  });
});
