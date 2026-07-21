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
const mockSignInMagicLink = vi.fn();
const mockSignInPasskey = vi.fn();
const mockAddPasskey = vi.fn();

vi.mock("@/lib/authClient", () => ({
  authClient: {
    useSession: () => mockUseSession(),
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
  mockSignInMagicLink.mockReset();
  mockSignInPasskey.mockReset();
  mockAddPasskey.mockReset();
  mockUseSession.mockReturnValue({ data: null, isPending: false });
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

  test("a successful registration shows the 'passkey saved' confirmation", async () => {
    mockAddPasskey.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.click(screen.getByRole("button", { name: /set up a passkey/i }));

    expect(await screen.findByText(/passkey saved/i)).toBeDefined();
  });

  test("a failed registration shows an error and offers to retry", async () => {
    mockAddPasskey.mockResolvedValue({ data: null, error: { message: "denied" } });
    const user = userEvent.setup();
    render(<AdminLoginForm />);

    await user.click(screen.getByRole("button", { name: /set up a passkey/i }));

    expect(await screen.findByText(/couldn.t set up a passkey/i)).toBeDefined();
  });

  test("links to /admin to continue", () => {
    render(<AdminLoginForm />);

    const link = screen.getByRole("link", { name: /continue to admin/i });
    expect(link.getAttribute("href")).toBe("/admin");
  });
});
