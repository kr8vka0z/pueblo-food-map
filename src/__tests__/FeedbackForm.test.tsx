/**
 * FeedbackForm tests — #116
 *
 * Covers:
 *   1. Renders feedback type select, message textarea, email input, submit button.
 *   2. Client validation: error when feedback type not selected.
 *   3. Client validation: error when message is empty.
 *   4. Client validation: error for invalid email format.
 *   5. Client validation: error when email is empty (now required).
 *   6. Valid email passes (no error).
 *   7. Submit sends correct JSON payload (includes turnstileToken, feedbackType, message, email).
 *   8. Success state rendered after successful submit.
 *   9. Error state rendered after failed submit.
 *  10. "Try again" button resets error state.
 *  11. Honeypot field is present in DOM but hidden.
 *  12. ES locale: submit button shows Spanish label.
 *  13. Rate-limit error shows inline message on message field.
 *  14. Turnstile widget div is present in DOM.
 *  15. turnstile_failed error from server shows Turnstile error message + resets widget.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeedbackForm from "@/components/FeedbackForm";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import {
  expectTurnstileError,
  getSubmitButtonName,
  waitForSubmitEnabled,
} from "@/__tests__/helpers/formTestHelpers";

// ─── Turnstile mock ───────────────────────────────────────────────────────────
// window.turnstile is injected by the CF script at runtime. In tests we stub
// it with a synchronous implementation that immediately invokes the callback,
// which sets the token and enables the submit button.

const mockTurnstile = {
  render: vi.fn((container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-3";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

// ─── fetch mock ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
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

// FeedbackForm reads locale via useLocale() (#289), not a prop — wrap it in
// a LocaleProvider to exercise the same EN/ES cases the old `locale` prop did.
function renderForm(locale: "en" | "es" = "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <FeedbackForm />
    </LocaleProvider>,
  );
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

async function selectFeedbackType(
  user: ReturnType<typeof userEvent.setup>,
  key: "problem" | "feature" | "positive" | "other",
  locale: "en" | "es" = "en",
) {
  await user.click(screen.getByRole("radio", { name: t(`feedback.type.${key}`, locale) }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FeedbackForm — rendering", () => {
  test("renders feedback type radio group with all 4 options", () => {
    renderForm();
    expect(screen.getByRole("group", { name: /Feedback type/i })).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  test("renders message textarea", () => {
    renderForm();
    expect(screen.getByLabelText(/Message/i)).toBeDefined();
  });

  test("renders required email input", () => {
    renderForm();
    const emailInput = screen.getByLabelText(/Your email/i);
    expect(emailInput).toBeDefined();
    expect((emailInput as HTMLInputElement).required).toBe(true);
  });

  test("renders submit button (enabled after Turnstile resolves)", async () => {
    renderForm();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Send feedback/i })).toBeDefined();
    });
  });

  test("Turnstile widget div is present in DOM", () => {
    renderForm();
    expect(screen.getByTestId("turnstile-widget")).toBeDefined();
  });

  test("honeypot input is present in DOM (hidden with aria-hidden wrapper)", () => {
    renderForm();
    const honeypot = document.getElementById("feedback-website");
    expect(honeypot).not.toBeNull();
    const wrapper = honeypot!.closest("[aria-hidden]");
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  test("ES locale: submit button shows Spanish label after Turnstile resolves", async () => {
    renderForm("es");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Enviar comentario/i })).toBeDefined();
    });
  });
});

describe("FeedbackForm — client validation", () => {
  test("shows feedbackType error when type not selected", async () => {
    const user = userEvent.setup();
    renderForm();
    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please select a feedback type/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows message error when message is empty", async () => {
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "feature");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please enter a message/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("shows email error for invalid email format", async () => {
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "problem");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "The search bar is broken.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "not-an-email");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid email address/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("valid email passes validation and submits", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "positive");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Love the map!");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.queryByText(/valid email address/i)).toBeNull();
    });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  test("empty email is rejected (field is required)", async () => {
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "other");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Just a general note.");

    // Leave email blank (required)
    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please enter your email address/i)).toBeDefined();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("FeedbackForm — submit flow", () => {
  test("sends correct JSON payload on submit (includes turnstileToken and email)", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "feature");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Please add a printer-friendly view.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/feedback/submit");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(body.feedbackType).toBe("feature");
    expect(body.message).toBe("Please add a printer-friendly view.");
    expect(body.contactEmail).toBe("test@example.com");
    // Honeypot should be empty string (real user)
    expect(body.website).toBe("");
    // Turnstile token from our mock
    expect(body.turnstileToken).toBe("test-turnstile-token");
  });

  test("renders success state after successful submit", async () => {
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "positive");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Love the map!");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Thank you!/i)).toBeDefined();
    });
    expect(screen.getByRole("link", { name: /Back to map/i })).toBeDefined();
  });

  test("renders error state after failed submit", async () => {
    mockError("send_failed");
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "problem");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Something is broken.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Couldn't send your feedback/i)).toBeDefined();
    });
  });

  test("'Try again' button resets error state and shows form again", async () => {
    mockError("send_failed");
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "problem");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Something is broken.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Couldn't send your feedback/i)).toBeDefined();
    });

    await user.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Couldn't send your feedback/i)).toBeNull();
    });
    expect(screen.getByRole("button", { name: /Send feedback/i })).toBeDefined();
  });

  test("rate_limit error shows inline message on message field", async () => {
    mockError("rate_limit");
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "other");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "A message.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await waitFor(() => {
      expect(screen.getByText(/Too many submissions/i)).toBeDefined();
    });
    // Should NOT show global error banner
    expect(screen.queryByText(/Couldn't send your feedback/i)).toBeNull();
  });

  test("turnstile_failed error from server shows Turnstile error message + resets widget", async () => {
    mockError("turnstile_failed");
    const user = userEvent.setup();
    renderForm();

    await selectFeedbackType(user, "feature");

    const textarea = screen.getByLabelText(/Message/i);
    await user.type(textarea, "Would love dark mode.");

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback");
    await user.click(screen.getByRole("button", { name: /Send feedback/i }));
    await expectTurnstileError("en");
    // Should NOT show global error banner
    expect(screen.queryByText(/Couldn't send your feedback/i)).toBeNull();
    // Widget reset should have been called
    expect(mockTurnstile.reset).toHaveBeenCalled();
  });

  test("ES locale: turnstile_failed shows Spanish error message", async () => {
    mockError("turnstile_failed");
    const user = userEvent.setup();
    renderForm("es");

    await selectFeedbackType(user, "feature", "es");

    const textarea = screen.getByLabelText(/Mensaje/i);
    await user.type(textarea, "Would love dark mode.");

    const emailInput = screen.getByLabelText(/correo/i);
    await user.type(emailInput, "test@example.com");

    await waitForSubmitEnabled("feedback", "es");
    await user.click(
      screen.getByRole("button", { name: getSubmitButtonName("feedback", "es") }),
    );
    await expectTurnstileError("es");
  });

  test("early onBlur validation flags an invalid email before submit (#959)", async () => {
    const user = userEvent.setup();
    renderForm();

    const emailInput = screen.getByLabelText(/Your email/i);
    await user.type(emailInput, "not-an-email");
    await user.tab();

    expect(screen.getByText(/valid email address/i)).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("submitting before Turnstile resolves queues the submit instead of disabling the button (#959)", async () => {
    let deliverToken: ((tok: string) => void) | undefined;
    vi.stubGlobal("turnstile", {
      render: vi.fn((_c: HTMLElement, opts: { callback?: (tok: string) => void }) => {
        deliverToken = opts.callback;
        return "widget-delayed";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    });
    mockSuccess();
    const user = userEvent.setup();
    renderForm();

    // Button is immediately enabled with its real action label, not disabled with "Verifying…"
    const submitBtn = screen.getByRole("button", { name: /Send feedback/i });
    expect(submitBtn).not.toBeDisabled();

    await selectFeedbackType(user, "positive");
    await user.type(screen.getByLabelText(/Message/i), "Great map!");
    await user.type(screen.getByLabelText(/Your email/i), "test@example.com");
    await user.click(submitBtn);

    expect(mockFetch).not.toHaveBeenCalled();
    deliverToken?.("late-token");

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.turnstileToken).toBe("late-token");
    expect(await screen.findByText(/Thank you!/i)).toBeDefined();
  });
});
