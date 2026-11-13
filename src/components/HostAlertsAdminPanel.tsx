"use client";

/**
 * HostAlertsAdminPanel — the host alert-recipient list on a blessing box's
 * admin edit screen (Blessing Boxes slice 6). Rendered only when
 * `venue.category === 'blessing_box'`, same gating as BoxCheckinsAdminPanel
 * (this file's sibling on the same edit page).
 *
 * A host row is admin-vouched — added already confirmed, no double opt-in
 * (see src/lib/boxAlerts.ts's insertHostSubscriptionStatement header) — so this panel's
 * job is just add/remove against POST/DELETE
 * /api/admin/blessing-boxes/[id]/host-alerts, which both return the
 * refreshed host list directly in their response body: this component keeps
 * its OWN local copy of the list (unlike most other admin panels in this
 * app, which call router.refresh() and let the Server Component re-fetch) —
 * a host's list is small, per-box, and the route already computes the exact
 * post-write list for free, so a second round trip through the whole page
 * would be pure overhead for no correctness gain.
 *
 * Single-language alert emails: the "Add a host email" form also carries an
 * "Email language" slider (English/Spanish, default English; #926 decision
 * 10: a two-way choice is a slider) — a host is
 * admin-added, not self-signed-up, so there's no page locale to read the
 * way the two public forms (AdoptBoxForm/BoxAlertSignupForm) do; the admin
 * picks it directly. The route stores it and every future alert this host
 * receives renders in ONLY that language.
 */

import { useEffect, useId, useRef, useState } from "react";
import AdminSegmented from "@/components/AdminSegmented";
import { busyButtonProps, errorClass, inputBase, inputBorder, labelClass } from "@/components/formClasses";
import { dangerButtonClass, emptyStateClass, failureLineClass, primaryButtonClass } from "@/lib/adminCardStyles";
import { EMAIL_RE } from "@/lib/email";

interface HostRow {
  id: number;
  email: string;
}

export interface HostAlertsAdminPanelProps {
  venueId: string;
  initialHosts: HostRow[];
}

const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
];

// `removing` names the host being removed, so only that row says
// "Removing…" and the Add button only says "Adding…" while adding. Every
// button is off during any request: the Remove buttons natively disabled,
// Add host marked busy (aria-disabled) so keyboard focus stays on it.
type PanelState =
  | { status: "idle" }
  | { status: "submitting"; removing: string | null }
  | { status: "error"; message: string };

export default function HostAlertsAdminPanel({ venueId, initialHosts }: HostAlertsAdminPanelProps) {
  const idPrefix = useId();
  const [hosts, setHosts] = useState<HostRow[]>(initialHosts);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"en" | "es">("en");
  const [state, setState] = useState<PanelState>({ status: "idle" });
  // The add box's own problem (empty or not an email), shown under the box.
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const removeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // The row index a Remove was pressed on. Its button is disabled while the
  // request runs, which drops focus, so once it settles focus goes to the row
  // now in that place (the next host), or to the add box if none is left.
  const focusAfterRemove = useRef<number | null>(null);
  useEffect(() => {
    if (focusAfterRemove.current === null || state.status === "submitting") return;
    const index = focusAfterRemove.current;
    focusAfterRemove.current = null;
    (removeRefs.current[index] ?? emailRef.current)?.focus();
  }, [hosts, state]);

  // #926 decision 15: an error says what did NOT happen, then what to do.
  const failedMessage = {
    POST: "The host email was not added. Try again.",
    DELETE: "The host email was not removed. Try again.",
  };

  // POST (add) and DELETE (remove) share one request/response shape. The
  // 409 message is POST-only: that is the one route answer it describes.
  async function mutate(method: "POST" | "DELETE", body: { email: string; lang?: "en" | "es" }, onSuccess?: () => void) {
    setState({ status: "submitting", removing: method === "DELETE" ? body.email : null });
    try {
      const res = await fetch(`/api/admin/blessing-boxes/${venueId}/host-alerts`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { hosts?: HostRow[] } | null;
      if (res.status === 200 && data?.hosts) {
        setHosts(data.hosts);
        onSuccess?.();
        setState({ status: "idle" });
        return;
      }
      if (method === "POST" && res.status === 409) {
        setState({ status: "error", message: "That address previously stopped these emails and can't be re-added here." });
        return;
      }
      setState({ status: "error", message: failedMessage[method] });
    } catch {
      setState({ status: "error", message: failedMessage[method] });
    }
  }

  // The browser's own bubble is off (noValidate): the box says what to put
  // in, the settled way (red edge, a line under it, focus in the box).
  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (state.status === "submitting") return;
    const trimmed = email.trim();
    const problem = !trimmed
      ? "Type the host's email address."
      : !EMAIL_RE.test(trimmed)
        ? "Type a full email address, like host@example.com."
        : null;
    setEmailError(problem);
    if (problem) {
      emailRef.current?.focus();
      return;
    }
    // Focus back in the empty box, so a second host can be typed at once.
    void mutate("POST", { email, lang }, () => {
      setEmail("");
      emailRef.current?.focus();
    });
  }

  function handleRemove(hostEmail: string, index: number) {
    focusAfterRemove.current = index;
    void mutate("DELETE", { email: hostEmail });
  }

  return (
    <div>
      {hosts.length === 0 ? (
        <div className={emptyStateClass}>
          <p>No host emails on file yet.</p>
          <p>Add one below to email the host when this box is reported empty, filled or with a problem.</p>
        </div>
      ) : (
        // The same list shape as Check-ins above it (BoxCheckinsAdminPanel):
        // lines between rows, the button full width under the row on a
        // phone and at the right from 640.
        <ul className="divide-y divide-[var(--color-bone-200)]">
          {hosts.map((h, index) => {
            // The button's name is "Remove <that email>" through
            // aria-labelledby on the visible address, never an aria-label.
            const buttonId = `${idPrefix}-${h.id}-remove`;
            const emailId = `${idPrefix}-${h.id}-email`;
            const removingThis = state.status === "submitting" && state.removing === h.email;
            return (
              <li
                key={h.id}
                className="flex flex-col gap-2 py-3 text-sm text-[var(--color-ink-700)] sm:flex-row sm:items-center sm:justify-between"
              >
                <span id={emailId} className="min-w-0 break-words">
                  {h.email}
                </span>
                <button
                  ref={(el) => {
                    removeRefs.current[index] = el;
                  }}
                  id={buttonId}
                  type="button"
                  aria-labelledby={`${buttonId} ${emailId}`}
                  onClick={() => handleRemove(h.email, index)}
                  {...busyButtonProps(state.status === "submitting")}
                  className={`${dangerButtonClass} shrink-0`}
                >
                  {removingThis ? "Removing…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Top-aligned from 640, so a problem line under the email box never
          lifts the box out of line with the slider; the button drops by one
          label line (labelClass: 20 line + 4 under = 24) to sit level with both. */}
      <form onSubmit={handleAdd} noValidate className="mt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <label htmlFor="host-alert-email" className={labelClass}>
              Add a host email
            </label>
            <input
              ref={emailRef}
              id="host-alert-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              placeholder="host@example.com"
              aria-invalid={emailError ? "true" : undefined}
              aria-describedby={emailError ? "host-alert-email-error" : undefined}
              className={`${inputBase} ${inputBorder(!!emailError)}`}
            />
            {emailError && (
              <p id="host-alert-email-error" role="alert" className={errorClass}>
                {emailError}
              </p>
            )}
          </div>
          <div>
            <AdminSegmented
              name="host-alert-lang"
              legend="Email language"
              legendClass={labelClass}
              options={LANG_OPTIONS}
              value={lang}
              onChange={(v) => setLang(v === "es" ? "es" : "en")}
            />
          </div>
          {/* WHY aria-disabled, not disabled: a natively disabled button
              drops keyboard focus to the top of the page while it adds;
              handleAdd ignores presses while a request runs. */}
          <button
            type="submit"
            aria-disabled={state.status === "submitting" || undefined}
            className={`${primaryButtonClass} sm:mt-[24px]`}
          >
            {state.status === "submitting" && state.removing === null ? "Adding…" : "Add host"}
          </button>
        </div>
      </form>

      {state.status === "error" && (
        <p role="alert" className={`mt-2 ${failureLineClass}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
