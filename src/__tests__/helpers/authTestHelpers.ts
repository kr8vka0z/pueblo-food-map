/**
 * Shared bootstrap for tests that need a REAL Better Auth session (#684):
 * the admin signs in with a 6-digit email code, so a test requests a code
 * (the mocked Resend `fetch` captures the email), reads the code from the
 * email's subject, and signs in with it — proving the code actually
 * delivered is the one that works, not one read back out of the database
 * (it's stored hashed, so it couldn't be anyway).
 *
 * Callers must have `globalThis.fetch` mocked (vi.spyOn) before calling.
 */

import { vi } from "vitest";

/** Minimum headers every direct auth.api call needs (auth-options.ts's baseURL is dynamic). */
export function authRequestHeaders(extra?: Record<string, string>): Headers {
  return new Headers({ host: "pueblofoodmap.com", ...extra });
}

/** The 6-digit code from the most recent (mocked) Resend send. */
export function lastEmailedCode(): string {
  const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined;
  if (!call) throw new Error("no email was sent");
  const subject = JSON.parse(call[1].body as string).subject as string;
  const match = /(\d{6})/.exec(subject);
  if (!match) throw new Error(`no code in the email subject: ${subject}`);
  return match[1];
}

/** Cookie request header (name=value pairs only) from a response's Set-Cookie. */
export function cookieHeaderFrom(response: Response): string {
  const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const header = setCookie
    .filter(Boolean)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
  if (!header) throw new Error("the sign-in did not set a session cookie");
  return header;
}

// Structural type: just the two endpoints this helper calls, so any
// betterAuth(buildAuthOptions(...)) instance fits.
interface CodeSignInApi {
  api: {
    sendVerificationOTP: (input: { body: { email: string; type: "sign-in" }; headers: Headers }) => Promise<unknown>;
    signInEmailOTP: (input: { body: { email: string; otp: string }; headers: Headers; asResponse: true }) => Promise<Response>;
  };
}

/** Signs in with an emailed code and returns a usable session Cookie header. */
export async function signInWithEmailCode(auth: CodeSignInApi, email: string): Promise<string> {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers: authRequestHeaders() });
  const response = await auth.api.signInEmailOTP({
    body: { email, otp: lastEmailedCode() },
    headers: authRequestHeaders(),
    asResponse: true,
  });
  return cookieHeaderFrom(response);
}
