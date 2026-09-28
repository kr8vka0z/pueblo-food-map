/**
 * AdminLoginForm tests (#315 Phase 2).
 *
 * Covers the client-side half of the login experience: email validation,
 * the email-code flow (#684: send → type the code on the same page →
 * sign in, resend cooldown, "use a different email", the error copy), the
 * error branch when the API call itself fails, passkey sign-in, and the
 * signed-in "set up a passkey" prompt driven by authClient.useSession().
 *
 * `@/lib/authClient` is mocked module-wide (same pattern
 * ArchiveVenueButton.test.tsx uses for next/navigation) — this is a pure UI
 * test of AdminLoginForm's own state machine, not of Better Auth itself
 * (that's adminAuthAllowlistPlugin.test.ts's job, against the real engine).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseSession = vi.fn();
const mockUseListPasskeys = vi.fn();
const mockSendCode = vi.fn();
const mockSignInEmailOtp = vi.fn();
const mockSignInPasskey = vi.fn();
const mockAddPasskey = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/authClient", () => ({
  authClient: {
    useSession: () => mockUseSession(),
    useListPasskeys: () => mockUseListPasskeys(),
    emailOtp: {
      sendVerificationOtp: (...args: unknown[]) => mockSendCode(...args),
    },
    signIn: {
      emailOtp: (...args: unknown[]) => mockSignInEmailOtp(...args),
      passkey: (...args: unknown[]) => mockSignInPasskey(...args),
    },
    passkey: {
      addPasskey: (...args: unknown[]) => mockAddPasskey(...args),
    },
  },
}));

import AdminLoginForm from "@/components/AdminLoginForm";

beforeEach(() => {
  mockUseSession.mockReset();
  mockUseListPasskeys.mockReset();
  mockSendCode.mockReset();
  mockSignInEmailOtp.mockReset();
  mockSignInPasskey.mockReset();
  mockAddPasskey.mockReset();
  mockReplace.mockReset();
  mockUseSession.mockReturnValue({ data: null, isPending: false });
  // Default: no passkeys yet — matches the pre-existing "first-time" tests
  // below, which expect the setup prompt unless a test overrides this.
  mockUseListPasskeys.mockReturnValue({ data: [], isPending: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminLoginForm — signed-out: email code (#684)", () => {
  async function reachCodeStep(email = "kysboyd@gmail.com") {
    mockSendCode.mockResolvedValue({ data: { success: true }, error: null });
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/^email$/i), email);
    await user.click(screen.getByRole("button", { name: /email me a code/i }));
    await screen.findByTestId("admin-login-sent");
    return user;
  }

  test("rejects an invalid email client-side without calling the API", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/^email$/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /email me a code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(mockSendCode).not.toHaveBeenCalled();
  });

  test("a send shows the same code step for any address (anti-enumeration), on the same page", async () => {
    await reachCodeStep("attacker@evil.com");

    expect(screen.getByTestId("admin-login-sent")).toHaveTextContent("We sent a 6-digit code to attacker@evil.com");
    expect(mockSendCode).toHaveBeenCalledWith({ email: "attacker@evil.com", type: "sign-in" });
    const codeField = screen.getByLabelText(/sign-in code/i);
    expect(codeField.getAttribute("inputmode")).toBe("numeric");
    expect(codeField.getAttribute("autocomplete")).toBe("one-time-code");
  });

  test("typing the 6-digit code signs in with it (no button press needed, digits only)", async () => {
    mockSignInEmailOtp.mockResolvedValue({ data: { token: "t" }, error: null });
    const user = await reachCodeStep();

    await user.type(screen.getByLabelText(/sign-in code/i), "12a3 456");

    await waitFor(() => expect(mockSignInEmailOtp).toHaveBeenCalledWith({ email: "kysboyd@gmail.com", otp: "123456" }));
    expect(mockSignInEmailOtp).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["INVALID_OTP", "That code didn't match. Try again."],
    ["OTP_EXPIRED", "That code expired. Send a new one."],
    ["TOO_MANY_ATTEMPTS", "Too many tries. Send a new code."],
  ])("%s shows its own message", async (code, message) => {
    mockSignInEmailOtp.mockResolvedValue({ data: null, error: { code, status: 400 } });
    const user = await reachCodeStep();

    await user.type(screen.getByLabelText(/sign-in code/i), "123456");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  test("a short code isn't sent; the Sign in button explains", async () => {
    const user = await reachCodeStep();

    await user.type(screen.getByLabelText(/sign-in code/i), "123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/6-digit code/i);
    expect(mockSignInEmailOtp).not.toHaveBeenCalled();
  });

  test("Resend code is disabled for 30 seconds after a send, then sends a new code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = await reachCodeStep();
      const resend = screen.getByRole("button", { name: /resend code/i });
      expect(resend).toBeDisabled();
      expect(resend).toHaveTextContent("Resend code (30s)");

      // One tick per second, each flushed through React (the ticker chains timeouts).
      for (let i = 0; i < 31; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      await waitFor(() => expect(screen.getByRole("button", { name: /resend code/i })).not.toBeDisabled());
      await user.click(screen.getByRole("button", { name: /resend code/i }));

      expect(mockSendCode).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: /resend code/i })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  test("Use a different email goes back to the email step", async () => {
    const user = await reachCodeStep();

    await user.click(screen.getByRole("button", { name: /use a different email/i }));

    expect(screen.queryByTestId("admin-login-sent")).toBeNull();
    expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).value).toBe("");
  });

  test("an API-level error sending the code (result.error, no thrown exception) shows the error state", async () => {
    // Regression guard: better-auth's client resolves { data, error } on a
    // non-2xx response rather than throwing.
    mockSendCode.mockResolvedValue({ data: null, error: { message: "Resend API error 401" } });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/^email$/i), "kysboyd@gmail.com");
    await user.click(screen.getByRole("button", { name: /email me a code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByTestId("admin-login-sent")).toBeNull();
  });

  test("a thrown network-level failure also shows the error state", async () => {
    mockSendCode.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/^email$/i), "kysboyd@gmail.com");
    await user.click(screen.getByRole("button", { name: /email me a code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  test("never mentions a sign-in link", () => {
    render(<AdminLoginForm />);
    expect(document.body.textContent).not.toMatch(/link/i);
  });
});

describe("AdminLoginForm — signed-out: passkey sign-in", () => {
  test("a successful passkey sign-in calls authClient.signIn.passkey", async () => {
    mockSignInPasskey.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.click(screen.getByRole("button", { name: /use a passkey/i }));

    await waitFor(() => expect(mockSignInPasskey).toHaveBeenCalledTimes(1));
  });

  test("a failed passkey sign-in shows an error, doesn't crash", async () => {
    mockSignInPasskey.mockResolvedValue({ data: null, error: { message: "no credential" } });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.click(screen.getByRole("button", { name: /use a passkey/i }));

    expect(await screen.findByText(/didn.t work/i)).toBeDefined();
  });
});

describe("AdminLoginForm — signed-in: passkey registration prompt", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { user: { email: "kysboyd@gmail.com" } },
      isPending: false,
    });
  });

  test("renders the signed-in email and a 'set up a passkey' prompt", () => {
    render(<AdminLoginForm />);

    expect(screen.getByTestId("admin-login-passkey-prompt")).toHaveTextContent(
      "kysboyd@gmail.com",
    );
    expect(screen.getByRole("button", { name: /set up a passkey/i })).toBeDefined();
  });

  test("a successful registration logs them straight into /admin (no extra screen)", async () => {
    mockAddPasskey.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.click(screen.getByRole("button", { name: /set up a passkey/i }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin"));
  });

  test("a failed registration shows an error and offers to retry", async () => {
    mockAddPasskey.mockResolvedValue({ data: null, error: { message: "denied" } });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.click(screen.getByRole("button", { name: /set up a passkey/i }));

    expect(await screen.findByText(/couldn.t set up a passkey/i)).toBeDefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test("offers a way into admin without a passkey", () => {
    render(<AdminLoginForm />);

    const link = screen.getByRole("link", { name: /continue to admin/i });
    expect(link.getAttribute("href")).toBe("/admin");
  });
});

describe("AdminLoginForm — signed-in: returning admin who already has a passkey", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { user: { email: "kysboyd@gmail.com" } },
      isPending: false,
    });
    mockUseListPasskeys.mockReturnValue({
      data: [{ id: "cred-1" }],
      isPending: false,
      error: null,
    });
  });

  test("does not render the 'set up a passkey' prompt when the user already has one", () => {
    render(<AdminLoginForm />);

    expect(
      screen.queryByRole("button", { name: /set up a passkey/i }),
    ).toBeNull();
    expect(screen.getByTestId("admin-login-passkey-prompt")).toBeDefined();
  });

  test("redirects straight into /admin without a 'Continue' click", async () => {
    render(<AdminLoginForm />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin"));
    // No intermediate "Continue to admin" screen when a passkey already exists.
    expect(
      screen.queryByRole("link", { name: /continue to admin/i }),
    ).toBeNull();
  });

  // #485 core: the admin sign-in success path is the one place every
  // sign-in route (email code, passkey, first-time register) converges,
  // so it's what marks this browser opted out of analytics.
  test("flags this device internal for analytics (pfm_internal) once signed in", async () => {
    window.localStorage.clear();
    render(<AdminLoginForm />);

    await waitFor(() =>
      expect(window.localStorage.getItem("pfm_internal")).toBe("1"),
    );
  });
});

describe("AdminLoginForm — signed-in: passkey list still pending", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { user: { email: "kysboyd@gmail.com" } },
      isPending: false,
    });
    mockUseListPasskeys.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });
  });

  test("does not flash the 'set up a passkey' prompt (or redirect) while the list is pending", () => {
    render(<AdminLoginForm />);

    expect(
      screen.queryByRole("button", { name: /set up a passkey/i }),
    ).toBeNull();
    expect(screen.getByTestId("admin-login-passkey-prompt")).toBeDefined();
    // Must not redirect before the passkey list has loaded.
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
