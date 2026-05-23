/**
 * ReportForm tests — #70
 *
 * Covers:
 *   1. Renders all form fields (issue type, description, email, submit).
 *   2. Client validation: shows error if issueType missing on submit.
 *   3. Client validation: shows error if description < 10 chars on submit.
 *   4. Client validation: shows error for invalid email format.
 *   5. Valid email passes (no error).
 *   6. Empty email passes (field is optional).
 *   7. Submit sends correct JSON payload (venueId, issueType, description, etc.).
 *   8. Success state rendered after successful submit.
 *   9. Error state rendered after failed submit.
 *  10. "Try again" button resets error state (form re-appears).
 *  11. Honeypot field is present in DOM but hidden from real users.
 *  12. ES locale: submit button shows "Enviar reporte".
 *  13. Rate-limit error from server shows inline error on description.
 *  14. Turnstile widget div is present in DOM.
 *  15. turnstile_failed error from server shows inline error + resets widget.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportForm from "@/components/ReportForm";

// ─── Turnstile mock ───────────────────────────────────────────────────────────
// window.turnstile is injected by the CF script at runtime. In tests we stub
// it with a synchronous implementation that immediately invokes the callback,
// which sets the token and enables the submit button.

let capturedCallback: ((token: string) => void) | undefined;

const mockTurnstile = {
  render: vi.fn((container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    capturedCallback = opts.callback;
    // Immediately resolve with a fake token so the submit button is enabled
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

// ─── fetch mock ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  // Reset turnstile mock state
  mockTurnstile.render.mockClear();
  mockTurnstile.reset.mockClear();
  mockTurnstile.remove.mockClear();
  capturedCallback = undefined;
  // Mount turnstile global before each render so useEffect sees it
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(locale: "en" | "es" = "en") {
  return render(
    <ReportForm
      venueId="garden-rmser"
      venueName="RMSER Community Garden"
      venueAddress="330 Lake Ave, Pueblo, CO 81004"
      locale={locale}
    />,
  );
}

/**
 * Wait for the Turnstile widget mock to fire its callback and enable the
 * submit button. Required before any test that clicks the submit button.
 */
async function waitForSubmitEnabled() {
  await waitFor(() => {
    const btn = screen.getByRole("button", { name: /Submit report/i });
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
}

function mockSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true }),
  });
}

function mockError(error = "send_failed") {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ ok: false, error }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReportForm — rendering", () => {
  test("renders issue type select", () => {
    renderForm();
    expect(screen.getByLabelText(/What's wrong/i)).toBeDefined();
  });

  test("renders description textarea", () => {
    renderForm();
    expect(screen.getByLabelText(/Description/i)).toBeDefined();
  });

  test("renders optional email input", () => {
    renderForm();
    expect(screen.getByLabelText(/Your email/i)).toBeDefined();
  });

  test("renders submit button (enabled after Turnstile resolves)", async () => {
    renderForm();
    // After useEffect fires, turnstile mock resolves synchronously,
    // enabling the submit button with the normal label.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit report/i })).toBeDefined();
    });
  });

  test("Turnstile widget div is present in DOM", () => {
    renderForm();
    expect(screen.getByTestId("turnstile-widget")).toBeDefined();
  });

  test("honeypot input is present in DOM (hidden with aria-hidden wrapper)", () => {
    renderForm();
    // The honeypot input should exist in DOM but its wrapper is aria-hidden
    const honeypot = document.getElementById("report-website");
    expect(honeypot).not.toBeNull();
    const wrapper = honeypot!.closest("[aria-hidden]");
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  test("ES locale: submit button shows Spanish label after Turnstile resolves", async () => {
    renderForm("es");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar reporte/i })).toBeDefined();
    });
  });
});

describe("ReportForm — client validation", () => {
  test("shows issueType error when issue type not selected", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please select an issue type/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows description error when description is too short", async () => {
    const user = userEvent.setup();
    renderForm();

    // Select issue type
    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "hours");

    // Type short description
    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "short");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/at least 10 characters/i),
      ).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows email error for invalid email format", async () => {
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "hours");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This is a long enough description for testing.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "not-an-email");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email address/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("valid email passes validation and submits", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "hours");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This is a long enough description.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.queryByText(/valid email address/i)).toBeNull();
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  test("empty email passes validation (field is optional)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "hours");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This is a long enough description.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });
});

describe("ReportForm — submit flow", () => {
  test("sends correct JSON payload on submit (includes turnstileToken)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "location");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "The pin is in the wrong spot entirely.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/report/submit");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(body.venueId).toBe("garden-rmser");
    expect(body.venueName).toBe("RMSER Community Garden");
    expect(body.issueType).toBe("location");
    expect(body.description).toBe("The pin is in the wrong spot entirely.");
    // Honeypot should be empty string (real user)
    expect(body.website).toBe("");
    // Turnstile token from our mock
    expect(body.turnstileToken).toBe("test-turnstile-token");
  });

  test("renders success state after successful submit", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "closed");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This place closed down last month.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Thank you!/i)).toBeDefined();
    });
    expect(screen.getByRole("link", { name: /Back to map/i })).toBeDefined();
  });

  test("renders error state after failed submit", async () => {
    mockError("send_failed");
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "closed");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This place closed down last month.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeDefined();
    });
  });

  test("'Try again' button resets error state and shows form again", async () => {
    mockError("send_failed");
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "closed");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This place closed down last month.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeDefined();
    });

    // Click "Try again"
    await user.click(screen.getByRole("button", { name: /Try again/i }));

    // Error banner should be gone; submit button should be visible again
    await waitFor(() => {
      expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    });
    // Token is still set (widget not destroyed), so Submit label shows
    expect(screen.getByRole("button", { name: /Submit report/i })).toBeDefined();
  });

  test("rate_limit error from server shows inline message", async () => {
    mockError("rate_limit");
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "closed");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This place closed down last month.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Too many submissions/i),
      ).toBeDefined();
    });
    // Should NOT show global error banner (returns to idle with inline error)
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
  });

  test("turnstile_failed error from server shows Turnstile error message", async () => {
    mockError("turnstile_failed");
    const user = userEvent.setup();
    renderForm();

    const select = screen.getByLabelText(/What's wrong/i) as HTMLSelectElement;
    await user.selectOptions(select, "closed");

    const textarea = screen.getByLabelText(/Description/i);
    await user.type(textarea, "This place closed down last month.");

    await waitForSubmitEnabled();
    await user.click(screen.getByRole("button", { name: /Submit report/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert", { hidden: false })).toBeDefined();
      const alerts = screen.getAllByRole("alert");
      const turnstileAlert = alerts.find((el) =>
        el.textContent?.includes("verify") && el.textContent?.includes("human"),
      );
      expect(turnstileAlert).toBeDefined();
    });
    // Should NOT show global error banner
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    // Widget reset should have been called
    expect(mockTurnstile.reset).toHaveBeenCalled();
  });
});
