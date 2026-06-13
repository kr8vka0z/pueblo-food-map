/**
 * SuggestForm tests — #71
 *
 * Covers:
 *   1. Renders all required fields (name, address, category, submit).
 *   2. Renders all optional fields (hours, contact, snap, wic, notes, email).
 *   3. Client validation: error when venue name missing.
 *   4. Client validation: error when address missing.
 *   5. Client validation: error when category not selected.
 *   6. Client validation: error for invalid submitter email.
 *   7. Valid email passes (no error).
 *   8. Empty email passes (optional field).
 *   9. Submit sends correct JSON payload (includes turnstileToken).
 *  10. Success state rendered after successful submit.
 *  11. Error state rendered after failed submit.
 *  12. "Try again" button resets error state.
 *  13. Honeypot field is present in DOM but hidden.
 *  14. ES locale: submit button shows Spanish label.
 *  15. Rate-limit error shows inline message.
 *  16. Turnstile widget div is present in DOM.
 *  17. turnstile_failed error from server shows Turnstile error message.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SuggestForm from "@/components/SuggestForm";
import {
  expectTurnstileError,
  getSubmitButtonName,
  waitForSubmitEnabled,
} from "@/__tests__/helpers/formTestHelpers";

// ─── Turnstile mock ───────────────────────────────────────────────────────────

const mockTurnstile = {
  render: vi.fn((container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-2";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

// ─── fetch mock ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  mockTurnstile.render.mockClear();
  mockTurnstile.reset.mockClear();
  mockTurnstile.remove.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(locale: "en" | "es" = "en") {
  return render(<SuggestForm locale={locale} />);
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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  const nameInput = screen.getByLabelText(/Venue name/i);
  await user.type(nameInput, "Test Food Pantry");

  const addressInput = screen.getByLabelText(/Address/i);
  await user.type(addressInput, "123 Main St, Pueblo, CO");

  const categorySelect = screen.getByLabelText(/Category/i) as HTMLSelectElement;
  await user.selectOptions(categorySelect, "pantry");
}

async function fillRequiredFieldsEs(user: ReturnType<typeof userEvent.setup>) {
  const nameInput = screen.getByLabelText(/Nombre del lugar/i);
  await user.type(nameInput, "Despensa Test");

  const addressInput = screen.getByLabelText(/Dirección/i);
  await user.type(addressInput, "123 Main St, Pueblo, CO");

  const categorySelect = screen.getByLabelText(/Categoría/i) as HTMLSelectElement;
  await user.selectOptions(categorySelect, "pantry");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SuggestForm — rendering", () => {
  test("renders venue name input", () => {
    renderForm();
    expect(screen.getByLabelText(/Venue name/i)).toBeDefined();
  });

  test("renders address input", () => {
    renderForm();
    expect(screen.getByLabelText(/Address/i)).toBeDefined();
  });

  test("renders category select", () => {
    renderForm();
    expect(screen.getByLabelText(/Category/i)).toBeDefined();
  });

  test("renders hours input", () => {
    renderForm();
    expect(screen.getByLabelText(/Hours/i)).toBeDefined();
  });

  test("renders contact input", () => {
    renderForm();
    expect(screen.getByLabelText(/Contact info/i)).toBeDefined();
  });

  test("renders SNAP checkbox", () => {
    renderForm();
    expect(screen.getByLabelText(/Accepts SNAP/i)).toBeDefined();
  });

  test("renders WIC checkbox", () => {
    renderForm();
    expect(screen.getByLabelText(/Accepts WIC/i)).toBeDefined();
  });

  test("renders notes textarea", () => {
    renderForm();
    expect(screen.getByLabelText(/Additional notes/i)).toBeDefined();
  });

  test("renders submitter email input", () => {
    renderForm();
    expect(screen.getByLabelText(/Your email/i)).toBeDefined();
  });

  test("renders submit button (enabled after Turnstile resolves)", async () => {
    renderForm();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit suggestion/i })).toBeDefined();
    });
  });

  test("Turnstile widget div is present in DOM", () => {
    renderForm();
    expect(screen.getByTestId("turnstile-widget")).toBeDefined();
  });

  test("honeypot input is present in DOM but hidden (aria-hidden wrapper)", () => {
    renderForm();
    const honeypot = document.getElementById("suggest-website");
    expect(honeypot).not.toBeNull();
    const wrapper = honeypot!.closest("[aria-hidden]");
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  test("ES locale: submit button shows Spanish label after Turnstile resolves", async () => {
    renderForm("es");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar sugerencia/i })).toBeDefined();
    });
  });
});

describe("SuggestForm — client validation", () => {
  test("shows name error when venue name is empty", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please enter a venue name/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows address error when address is empty", async () => {
    const user = userEvent.setup();
    renderForm();
    // Fill name only
    await user.type(screen.getByLabelText(/Venue name/i), "Test Pantry");
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please enter an address/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows category error when category not selected", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/Venue name/i), "Test Pantry");
    await user.type(screen.getByLabelText(/Address/i), "123 Main St");
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please select a category/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows email error for invalid email format", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "not-an-email");

    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email address/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("valid email passes validation and submits", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.queryByText(/valid email address/i)).toBeNull();
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  test("empty email passes validation (optional)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });
});

describe("SuggestForm — submit flow", () => {
  test("sends correct JSON payload on submit (includes turnstileToken)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Venue name/i), "Eastside Pantry");
    await user.type(screen.getByLabelText(/Address/i), "456 Oak Ave, Pueblo, CO");
    const categorySelect = screen.getByLabelText(/Category/i) as HTMLSelectElement;
    await user.selectOptions(categorySelect, "pantry");

    await user.type(screen.getByLabelText(/Hours/i), "Mon-Fri 9am-5pm");
    await user.click(screen.getByLabelText(/Accepts SNAP/i));

    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/suggest/submit");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(body.venueName).toBe("Eastside Pantry");
    expect(body.address).toBe("456 Oak Ave, Pueblo, CO");
    expect(body.category).toBe("pantry");
    expect(body.hours).toBe("Mon-Fri 9am-5pm");
    expect(body.acceptsSnap).toBe(true);
    expect(body.acceptsWic).toBe(false);
    // Honeypot should be empty string (real user)
    expect(body.website).toBe("");
    // Turnstile token from our mock
    expect(body.turnstileToken).toBe("test-turnstile-token");
  });

  test("renders success state after successful submit", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Thank you!/i)).toBeDefined();
    });
    expect(screen.getByRole("link", { name: /Back to map/i })).toBeDefined();
  });

  test("renders error state after failed submit", async () => {
    mockError("send_failed");
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeDefined();
    });
  });

  test("'Try again' button resets error state and shows form again", async () => {
    mockError("send_failed");
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeDefined();
    });

    await user.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    });
    expect(screen.getByRole("button", { name: /Submit suggestion/i })).toBeDefined();
  });

  test("rate_limit error shows inline message on name field", async () => {
    mockError("rate_limit");
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await waitFor(() => {
      expect(screen.getByText(/Too many submissions/i)).toBeDefined();
    });
    // Should NOT show global error banner
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
  });

  test("turnstile_failed error from server shows Turnstile error message", async () => {
    mockError("turnstile_failed");
    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await waitForSubmitEnabled("suggest");
    await user.click(screen.getByRole("button", { name: /Submit suggestion/i }));
    await expectTurnstileError("en");
    // Should NOT show global error banner
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    // Widget reset should have been called
    expect(mockTurnstile.reset).toHaveBeenCalled();
  });

  test("ES locale: turnstile_failed shows Spanish error message", async () => {
    mockError("turnstile_failed");
    const user = userEvent.setup();
    renderForm("es");
    await fillRequiredFieldsEs(user);
    await waitForSubmitEnabled("suggest", "es");
    await user.click(
      screen.getByRole("button", { name: getSubmitButtonName("suggest", "es") }),
    );
    await expectTurnstileError("es");
  });
});
