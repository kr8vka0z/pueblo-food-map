"use client";

/**
 * AdminLoginForm — the whole login experience for the admin (#315 Phase 2):
 * email → magic link, "use a passkey instead" for returning admins, and a
 * post-verification "set up a passkey" prompt — all as ONE page component,
 * driven by real session state rather than separate routes.
 *
 * WHY one component instead of separate /login, /verify, /register-passkey
 * routes: the task calls for "a single clean login page." `authClient.
 * useSession()` (Better Auth's React hook) already reacts to the session
 * cookie set when a clicked magic-link redirects back here (`callbackURL:
 * "/admin/login"` below) — reading that hook to switch between the
 * "sign in" and "you're in, want a passkey?" views is simpler and more
 * robust than juggling separate pages/redirects for what is really one
 * continuous flow for the one legitimate admin.
 *
 * Anti-enumeration in the UI, not just the API (#315 CRITICAL): the
 * "link sent" confirmation is shown for EVERY submitted email, allowlisted
 * or not — copy never confirms or denies whether an address is registered
 * (mirrors adminAuthAllowlistPlugin.ts's identical-response guarantee on
 * the server side).
 *
 * No route gating here — this page renders for anyone, pre-auth (Phase
 * 2 scope; see AGENTS.md's Better Auth section for the phase breakdown).
 * "Continue to admin" links to /admin, which Cloudflare Access still
 * fully gates on its own, unrelated to anything on this page.
 */

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/authClient";

type FormStatus = "idle" | "sending" | "sent" | "error";
type PasskeySignInStatus = "idle" | "authenticating" | "error";
type PasskeyRegisterStatus = "idle" | "registering" | "registered" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBase =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 text-sm text-[var(--color-ink-900)] " +
  "bg-white placeholder:text-[var(--color-ink-300)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";
const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";
const errorClass = "mt-1 text-xs text-red-600";
const primaryButtonClass =
  "w-full h-11 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
  "text-base font-semibold transition-colors duration-150 hover:bg-[var(--color-sage-600)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
const secondaryButtonClass =
  "w-full h-11 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-sage-500)] " +
  "text-sm font-medium text-[var(--color-sage-600)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-sage-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export default function AdminLoginForm() {
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [passkeySignIn, setPasskeySignIn] = useState<PasskeySignInStatus>("idle");
  const [passkeyRegister, setPasskeyRegister] =
    useState<PasskeyRegisterStatus>("idle");

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    setFormStatus("sending");
    try {
      const result = await authClient.signIn.magicLink({
        email: trimmed,
        callbackURL: "/admin/login",
      });
      // better-auth's client resolves with { data, error } rather than
      // throwing on a non-2xx response (verified against
      // @better-fetch/fetch's default throw:false behavior) — checking
      // result.error here is required, not optional, or a real server
      // error (e.g. Resend down) would silently render the same "sent"
      // confirmation as a real send.
      if (result?.error) {
        setFormStatus("error");
        return;
      }
      // Always show the same confirmation, allowlisted or not — see file
      // header WHY (anti-enumeration).
      setFormStatus("sent");
    } catch {
      setFormStatus("error");
    }
  }

  async function handlePasskeySignIn() {
    setPasskeySignIn("authenticating");
    const result = await authClient.signIn.passkey({});
    if (result?.error) {
      setPasskeySignIn("error");
      return;
    }
    setPasskeySignIn("idle");
  }

  async function handlePasskeyRegister() {
    setPasskeyRegister("registering");
    const result = await authClient.passkey.addPasskey({});
    if (result?.error) {
      setPasskeyRegister("error");
      return;
    }
    setPasskeyRegister("registered");
  }

  // ─── Signed-in view: offer a passkey for next time ──────────────────────
  if (!sessionPending && session) {
    return (
      <div
        data-testid="admin-login-passkey-prompt"
        className="elevation-2 rounded-[var(--radius-lg)] bg-white p-6 sm:p-8"
      >
        <p className="text-sm text-[var(--color-ink-500)]">Signed in as</p>
        <p className="mb-4 text-lg font-medium text-[var(--color-sage-700)]">
          {session.user.email}
        </p>

        {passkeyRegister === "registered" ? (
          <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-sage-50)] px-3 py-2 text-sm text-[var(--color-sage-700)]">
            Passkey saved. Next time you can sign in with it instead of a
            magic link.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-[var(--color-ink-700)]">
              Set up a passkey for faster sign-in next time? Your device will
              ask for a fingerprint, face, or PIN.
            </p>
            <button
              type="button"
              onClick={handlePasskeyRegister}
              disabled={passkeyRegister === "registering"}
              className={primaryButtonClass}
            >
              {passkeyRegister === "registering"
                ? "Setting up…"
                : "Set up a passkey"}
            </button>
            {passkeyRegister === "error" && (
              <p className={errorClass}>
                Couldn&apos;t set up a passkey. You can try again anytime.
              </p>
            )}
          </>
        )}

        <Link
          href="/admin"
          className="mt-4 block text-center text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
        >
          Continue to admin
        </Link>
      </div>
    );
  }

  // ─── Signed-out view: email magic link + passkey sign-in ────────────────
  return (
    <div className="elevation-2 rounded-[var(--radius-lg)] bg-white p-6 sm:p-8">
      {formStatus === "sent" ? (
        <div data-testid="admin-login-sent" role="status">
          <p className="text-sm text-[var(--color-ink-700)]">
            If <span className="font-medium">{email.trim()}</span> is
            registered for admin access, a sign-in link is on its way. Check
            your inbox.
          </p>
          <button
            type="button"
            onClick={() => {
              setFormStatus("idle");
              setEmail("");
            }}
            className="mt-4 text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} noValidate>
          <label htmlFor="admin-login-email" className={labelClass}>
            Email
          </label>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="email webauthn"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldError ? "true" : undefined}
            aria-describedby={fieldError ? "admin-login-email-error" : undefined}
            className={`${inputBase} ${
              fieldError
                ? "border-red-500"
                : "border-[var(--color-bone-300)]"
            } mb-1`}
            placeholder="you@example.com"
          />
          {fieldError && (
            <p id="admin-login-email-error" className={errorClass} role="alert">
              {fieldError}
            </p>
          )}

          <button
            type="submit"
            disabled={formStatus === "sending"}
            className={`${primaryButtonClass} mt-4`}
          >
            {formStatus === "sending" ? "Sending…" : "Send me a sign-in link"}
          </button>
          {formStatus === "error" && (
            <p className={errorClass} role="alert">
              Something went wrong sending the link. Try again.
            </p>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-[var(--color-ink-400)]">
            <span className="h-px flex-1 bg-[var(--color-bone-200)]" />
            or
            <span className="h-px flex-1 bg-[var(--color-bone-200)]" />
          </div>

          <button
            type="button"
            onClick={handlePasskeySignIn}
            disabled={passkeySignIn === "authenticating"}
            className={secondaryButtonClass}
          >
            {passkeySignIn === "authenticating"
              ? "Waiting for passkey…"
              : "Use a passkey"}
          </button>
          {passkeySignIn === "error" && (
            <p className={errorClass} role="alert">
              Passkey sign-in didn&apos;t work. Use a sign-in link instead.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
