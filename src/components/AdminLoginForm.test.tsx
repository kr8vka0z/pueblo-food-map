/**
 * AdminLoginForm tests (#315 Phase 2).
 *
 * Covers the client-side half of the login experience: email validation,
 * the magic-link submit -> "sent" confirmation (and, critically, the error
 * branch when the API call itself fails — see the fix WHY comment in
 * AdminLoginForm.tsx's handleMagicLinkSubmit), passkey sign-in, and the
 * signed-in "set up a passkey" prompt driven by authClient.useSession().
 *
 * `@/lib/authClient` is mocked module-wide (same pattern
 * ArchiveVenueButton.test.tsx uses for next/navigation) — this is a pure UI
 * test of AdminLoginForm's own state machine, not of Better Auth itself
 * (that's adminAuthAllowlistPlugin.test.ts's job, against the real engine).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseSession = vi.fn();
const mockUseListPasskeys = vi.fn();
const mockSignInMagicLink = vi.fn();
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
    signIn: {
      magicLink: (...args: unknown[]) => mockSignInMagicLink(...args),
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
  mockSignInMagicLink.mockReset();
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

describe("AdminLoginForm — signed-out: magic-link email form", () => {
  test("rejects an invalid email client-side without calling the API", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send me a sign-in link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  test("a successful call shows the same 'link sent' confirmation for any address (anti-enumeration)", async () => {
    mockSignInMagicLink.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/email/i), "attacker@evil.com");
    await user.click(screen.getByRole("button", { name: /send me a sign-in link/i }));

    expect(await screen.findByTestId("admin-login-sent")).toHaveTextContent(
      "attacker@evil.com",
    );
    expect(mockSignInMagicLink).toHaveBeenCalledWith({
      email: "attacker@evil.com",
      callbackURL: "/admin/login",
    });
  });

  test("an API-level error (result.error, no thrown exception) shows the error state, not 'sent'", async () => {
    // Regression guard: better-auth's client resolves { data, error } on a
    // non-2xx response rather than throwing — a naive try/catch-only check
    // would miss this and always show the success confirmation.
    mockSignInMagicLink.mockResolvedValue({
      data: null,
      error: { message: "Resend API error 401" },
    });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/email/i), "kysboyd@gmail.com");
    await user.click(screen.getByRole("button", { name: /send me a sign-in link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByTestId("admin-login-sent")).toBeNull();
  });

  test("a thrown network-level failure also shows the error state", async () => {
    mockSignInMagicLink.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText(/email/i), "kysboyd@gmail.com");
    await user.click(screen.getByRole("button", { name: /send me a sign-in link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
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
