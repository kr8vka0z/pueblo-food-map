"use client";

/**
 * AdminLoginForm — the whole admin login experience: email → a 6-digit code
 * typed on this same page (#684, replacing the emailed magic link, which
 * always opened a second tab), "use a passkey instead" for returning
 * admins, and a first-time "set up a passkey" prompt — all as ONE page
 * component, driven by real session state rather than separate routes.
 *
 * Two signed-out steps, no navigation between them:
 * 1. Email → "Email me a code" (authClient.emailOtp.sendVerificationOtp).
 * 2. "We sent a 6-digit code to {email}" + the code field
 *    (`inputmode="numeric"`, `autocomplete="one-time-code"` so iOS/Android
 *    can fill it from the email) → "Sign in" (authClient.signIn.emailOtp).
 *    Six digits submit on their own, so an autofilled code signs straight
 *    in. "Resend code" is disabled for 30 s after each send.
 * A successful sign-in flips `authClient.useSession()` (Better Auth's
 * client refetches the session after a /sign-in call), which renders the
 * signed-in view below — exactly what a link sign-in used to land on.
 *
 * Once signed in, an admin who ALREADY has a passkey is redirected straight
 * to /admin. The "set up a passkey" prompt is shown ONLY to an admin with
 * zero passkeys (`useListPasskeys()`, auto-derived by better-auth's react
 * client from the passkey plugin's `listPasskeys` atom), and it too
 * redirects into /admin on success. (Kyle feedback: don't tell someone to
 * "save a passkey" that's already saved, and don't add an extra screen
 * after a passkey logs them in.)
 *
 * Anti-enumeration in the UI, not just the API (#315 CRITICAL): step 2 is
 * shown for EVERY submitted email, allowlisted or not, and a non-admin
 * email's code attempt fails with the same "didn't match" message as a
 * wrong code (mirrors adminAuthAllowlistPlugin.ts's identical responses).
 *
 * No route gating here — this page renders for anyone, pre-auth.
 * "Continue to admin" links to /admin, which getAdminDb() gates on the
 * Better Auth session this form creates (AGENTS.md "Admin authentication").
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/authClient";
import { markInternalDevice } from "@/lib/analytics";

type FormStatus = "idle" | "sending" | "sent" | "error";
type CodeStatus = "idle" | "verifying" | "error";
type PasskeySignInStatus = "idle" | "authenticating" | "error";
type PasskeyRegisterStatus = "idle" | "registering" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;
/** Seconds "Resend code" stays disabled after each send (#684). */
export const RESEND_COOLDOWN_SECONDS = 30;

/** Maps Better Auth's error to the copy #684 asks for — never reveals whether an email is an admin. */
function codeErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.status === 429) return "Too many tries. Wait a few minutes and try again.";
  switch (error?.code) {
    case "INVALID_OTP":
      return "That code didn't match. Try again.";
    case "OTP_EXPIRED":
      return "That code expired. Send a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many tries. Send a new code.";
    default:
      return "Something went wrong. Try again.";
  }
}

// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
const inputBase =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
  // #534: --color-ink-300 undefined — DESIGN.md documents ink-400 as the
  // placeholder-text token.
  "bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";
const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";
const errorClass = "mt-1 text-xs text-[var(--color-danger)]";
const primaryButtonClass =
  "w-full h-11 rounded-[var(--radius-md)] bg-[var(--color-sage-600)] text-[var(--color-bone-50)] " +
  "text-base font-semibold transition-colors duration-150 hover:bg-[var(--color-sage-700)] " +
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
  // Must be called unconditionally alongside useSession() above (React hook
  // rules) even though its result is only read in the signed-in branch below.
  const { data: passkeys, isPending: passkeysPending } =
    authClient.useListPasskeys();

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [passkeySignIn, setPasskeySignIn] = useState<PasskeySignInStatus>("idle");
  const [passkeyRegister, setPasskeyRegister] =
    useState<PasskeyRegisterStatus>("idle");

  const router = useRouter();
  const hasPasskey = (passkeys?.length ?? 0) > 0;

  // Signed in AND this account already has a passkey → nothing to do on this
  // page, go straight into the admin app. Covers both a passkey sign-in and
  // an email-code login for an admin who set a passkey up before. Guarded on
  // `!passkeysPending` so we never redirect (or show the setup prompt) before
  // the list has actually loaded.
  useEffect(() => {
    if (!sessionPending && session && !passkeysPending && hasPasskey) {
      router.replace("/admin");
    }
  }, [sessionPending, session, passkeysPending, hasPasskey, router]);

  // "Resend code" cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // #485 (analytics admin opt-out): flag this browser as Kyle's own the
  // instant a real admin session exists — covers every sign-in path (email
  // code, passkey, and the first-time passkey-register redirect below,
  // which itself lands here on the next render since it also flips
  // `session` truthy). analytics.ts's initAnalytics() checks this flag
  // before it ever calls posthog.init(), so it's set as early as possible,
  // independent of whether this device already has a passkey.
  useEffect(() => {
    if (!sessionPending && session) {
      markInternalDevice();
    }
  }, [sessionPending, session]);

  /** Sends a sign-in code; true when the request went through. */
  async function sendCode(address: string): Promise<boolean> {
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" });
      // better-auth's client resolves { data, error } on a non-2xx response
      // rather than throwing — checking result.error is required, or a real
      // server error (e.g. Resend down) would look like a successful send.
      return !result?.error;
    } catch {
      return false;
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    setFormStatus("sending");
    if (await sendCode(trimmed)) {
      // Same step 2 for every address, allowlisted or not (anti-enumeration).
      setCode("");
      setCodeStatus("idle");
      setCodeError(null);
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setFormStatus("sent");
    } else {
      setFormStatus("error");
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setResendIn(RESEND_COOLDOWN_SECONDS);
    setCode("");
    setCodeError(null);
    setCodeStatus("idle");
    if (!(await sendCode(email.trim()))) {
      setCodeStatus("error");
      setCodeError("Couldn't send a new code. Try again.");
    }
  }

  async function verifyCode(value: string) {
    if (codeStatus === "verifying") return;
    if (value.length !== CODE_LENGTH) {
      setCodeStatus("error");
      setCodeError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }
    setCodeStatus("verifying");
    setCodeError(null);
    try {
      const result = await authClient.signIn.emailOtp({ email: email.trim(), otp: value });
      if (result?.error) {
        setCodeStatus("error");
        setCodeError(codeErrorMessage(result.error));
        return;
      }
      // Signed in: useSession() flips and the signed-in view takes over.
      setCodeStatus("idle");
    } catch {
      setCodeStatus("error");
      setCodeError(codeErrorMessage(null));
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (codeStatus === "error") {
      setCodeStatus("idle");
      setCodeError(null);
    }
    // A full code (typed or autofilled from the email) signs straight in.
    if (digits.length === CODE_LENGTH) void verifyCode(digits);
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
    // Registered — log them straight into the app rather than showing another
    // screen (same "a passkey should just log you in" intent as the effect).
    router.replace("/admin");
  }

  // ─── Signed-in view ─────────────────────────────────────────────────────
  if (!sessionPending && session) {
    // Already has a passkey (or the list is still loading): the effect above
    // is redirecting into /admin — show a neutral interstitial, never the
    // setup prompt or an "already saved" message.
    if (passkeysPending || hasPasskey) {
      return (
        <div
          data-testid="admin-login-passkey-prompt"
          className="elevation-2 rounded-[var(--radius-lg)] bg-white p-6 sm:p-8"
        >
          <p className="text-sm text-[var(--color-ink-500)]">Signing you in…</p>
        </div>
      );
    }

    // First-time visitor with no passkey yet: offer to set one up (which then
    // logs them in), but let them continue into the app without one.
    return (
      <div
        data-testid="admin-login-passkey-prompt"
        className="elevation-2 rounded-[var(--radius-lg)] bg-white p-6 sm:p-8"
      >
        <p className="text-sm text-[var(--color-ink-500)]">Signed in as</p>
        <p className="mb-4 text-lg font-medium text-[var(--color-sage-700)]">
          {session.user.email}
        </p>
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
          {passkeyRegister === "registering" ? "Setting up…" : "Set up a passkey"}
        </button>
        {passkeyRegister === "error" && (
          <p className={errorClass}>
            Couldn&apos;t set up a passkey. You can try again anytime.
          </p>
        )}
        <Link
          href="/admin"
          className="mt-4 block text-center text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
        >
          Continue to admin without a passkey
        </Link>
      </div>
    );
  }

  // ─── Signed-out view: email code + passkey sign-in ──────────────────────
  return (
    <div className="elevation-2 rounded-[var(--radius-lg)] bg-white p-6 sm:p-8">
      {formStatus === "sent" ? (
        <div data-testid="admin-login-sent">
          <p role="status" className="text-sm text-[var(--color-ink-700)]">
            We sent a {CODE_LENGTH}-digit code to{" "}
            <span className="font-medium">{email.trim()}</span>. It expires in 10 minutes.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode(code);
            }}
            noValidate
            className="mt-4"
          >
            <label htmlFor="admin-login-code" className={labelClass}>
              Sign-in code
            </label>
            <input
              id="admin-login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              enterKeyHint="go"
              autoFocus
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              aria-invalid={codeError ? "true" : undefined}
              aria-describedby={codeError ? "admin-login-code-error" : undefined}
              className={`${inputBase} ${
                codeError ? "border-[var(--color-danger)]" : "border-[var(--color-bone-300)]"
              } tracking-[0.4em] tabular-nums`}
              placeholder="123456"
            />
            {codeError && (
              <p id="admin-login-code-error" className={errorClass} role="alert">
                {codeError}
              </p>
            )}
            <button type="submit" disabled={codeStatus === "verifying"} className={`${primaryButtonClass} mt-4`}>
              {codeStatus === "verifying" ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0}
              className="min-h-11 text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            >
              {resendIn > 0 ? `Resend code (${resendIn}s)` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormStatus("idle");
                setEmail("");
                setCode("");
                setCodeError(null);
                setCodeStatus("idle");
                setResendIn(0);
              }}
              className="min-h-11 text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleEmailSubmit} noValidate>
          <label htmlFor="admin-login-email" className={labelClass}>
            Email
          </label>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="email webauthn"
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
            // Only field, so also the last one before submit.
            enterKeyHint="go"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldError ? "true" : undefined}
            aria-describedby={fieldError ? "admin-login-email-error" : undefined}
            className={`${inputBase} ${
              fieldError
                ? "border-[var(--color-danger)]"
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
            {formStatus === "sending" ? "Sending…" : "Email me a code"}
          </button>
          {formStatus === "error" && (
            <p className={errorClass} role="alert">
              Something went wrong sending the code. Try again.
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
              Passkey sign-in didn&apos;t work. Use an email code instead.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
