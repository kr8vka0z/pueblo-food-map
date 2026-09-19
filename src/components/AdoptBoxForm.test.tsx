/**
 * AdoptBoxForm tests (Blessing Boxes slice 6). Same Turnstile/fetch
 * mocking convention as BoxCheckinPanel.test.tsx: window.turnstile is
 * stubbed to resolve synchronously so the form's submit button is enabled
 * immediately in the common case.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import AdoptBoxForm from "@/components/AdoptBoxForm";

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
      <AdoptBoxForm boxId="box-1" />
    </LocaleProvider>,
  );
}

describe("AdoptBoxForm", () => {
  test("starts collapsed as a plain link", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Apply to adopt this box" })).toBeDefined();
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
  });

  test("expands to the full form on tap", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    expect(screen.getByLabelText(/your name/i)).toBeDefined();
    expect(screen.getByLabelText(/your email/i)).toBeDefined();
    // Privacy disclosure link, same convention as the three canonical public forms
    expect(screen.getByRole("link", { name: "Privacy" })).toBeDefined();
  });

  test("submits with a token already available and shows success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));

    await user.type(screen.getByLabelText(/your name/i), "The Martinez Family");
    await user.type(screen.getByLabelText(/your email/i), "family@example.com");
    await user.click(screen.getByRole("button", { name: "Send application" }));

    await waitFor(() => expect(screen.getByText("Check your email to confirm.")).toBeDefined());
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/blessing-boxes/box-1/adopt");
    const body = JSON.parse(init.body as string);
    expect(body.displayName).toBe("The Martinez Family");
    expect(body.email).toBe("family@example.com");
    expect(body.turnstileToken).toBe("test-turnstile-token");
    expect(body.lang).toBe("en"); // single-language alert emails: sends the page's own current locale
  });

  // Regression — Kyle's phone, 2026-09-19: the server saved the application
  // (200) but the button stayed on "Sending…" forever, because
  // window.turnstile.reset() threw before the success state was ever set.
  test("still shows success when turnstile.reset() throws", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    // A live widget (iframe in the container), so reset() really is called —
    // and the throw is consumed here rather than leaking into a later test.
    mockTurnstile.render.mockImplementationOnce((container: HTMLElement, opts: { callback?: (t: string) => void }) => {
      container.appendChild(document.createElement("iframe"));
      opts.callback?.("test-turnstile-token");
      return "widget-id-1";
    });
    mockTurnstile.reset.mockImplementationOnce(() => {
      throw new Error("widget container is gone");
    });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    await user.type(screen.getByLabelText(/your name/i), "The Martinez Family");
    await user.type(screen.getByLabelText(/your email/i), "family@example.com");
    await user.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(screen.getByText("Check your email to confirm.")).toBeDefined());
  });

  test("keeps the SAME Turnstile container across closed → open → success", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderForm();
    const closed = screen.getByTestId("adopt-turnstile-widget");
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    expect(screen.getByTestId("adopt-turnstile-widget")).toBe(closed);
    await user.type(screen.getByLabelText(/your name/i), "The Martinez Family");
    await user.type(screen.getByLabelText(/your email/i), "family@example.com");
    await user.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(screen.getByText("Check your email to confirm.")).toBeDefined());
    expect(screen.getByTestId("adopt-turnstile-widget")).toBe(closed);
  });

  test("sends 'es' when the page's own locale is Spanish", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderForm("es");
    await user.click(screen.getByRole("button", { name: "Solicitar adoptar esta caja" }));
    await user.type(screen.getByLabelText(/tu nombre/i), "La Familia Martínez");
    await user.type(screen.getByLabelText(/tu correo/i), "family@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.lang).toBe("es");
  });

  test("a rate-limit error response shows the rate-limit message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "rate_limit_box" }) });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    await user.type(screen.getByLabelText(/your name/i), "Name");
    await user.type(screen.getByLabelText(/your email/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Send application" }));

    await waitFor(() => expect(screen.getByText("Too many attempts right now. Please try again later.")).toBeDefined());
  });

  test("any other error response shows the generic error message", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "send_failed" }) });
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    await user.type(screen.getByLabelText(/your name/i), "Name");
    await user.type(screen.getByLabelText(/your email/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Send application" }));

    await waitFor(() => expect(screen.getByText("That didn't go through. Please try again.")).toBeDefined());
  });

  test("Cancel collapses the form back to the plain link", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText(/your name/i)).toBeNull();
  });

  test("no token available yet — the tap queues and fires once the widget calls back", async () => {
    // Simulate the invisible check not resolving synchronously.
    let capturedCallback: ((t: string) => void) | undefined;
    mockTurnstile.render.mockImplementationOnce((container: HTMLElement, opts: { callback?: (t: string) => void }) => {
      // A live widget has its iframe in the container — so the submit-time
      // reset() restarts THIS widget rather than rebuilding a new one.
      container.appendChild(document.createElement("iframe"));
      capturedCallback = opts.callback;
      return "widget-id-1";
    });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Apply to adopt this box" }));
    await user.type(screen.getByLabelText(/your name/i), "Name");
    await user.type(screen.getByLabelText(/your email/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Send application" }));

    // Queued — no fetch yet.
    expect(mockFetch).not.toHaveBeenCalled();

    // Token arrives.
    capturedCallback?.("late-token");

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).turnstileToken).toBe("late-token");
  });
});
