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

import { useId, useState } from "react";
import AdminSegmented from "@/components/AdminSegmented";
import { inputBase, inputBorder } from "@/components/formClasses";
import { controlLabelClass, dangerButtonClass, emptyStateClass, failureLineClass, primaryButtonClass } from "@/lib/adminCardStyles";

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
// button stays disabled during any request, as before.
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

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    void mutate("POST", { email, lang }, () => setEmail(""));
  }

  function handleRemove(hostEmail: string) {
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
        <ul className="flex flex-col gap-2">
          {hosts.map((h) => {
            // The button's name is "Remove <that email>" through
            // aria-labelledby on the visible address, never an aria-label.
            const buttonId = `${idPrefix}-${h.id}-remove`;
            const emailId = `${idPrefix}-${h.id}-email`;
            const removingThis = state.status === "submitting" && state.removing === h.email;
            return (
              <li key={h.id} className="flex items-center justify-between gap-2 text-sm text-[var(--color-ink-700)]">
                <span id={emailId} className="min-w-0 break-words">
                  {h.email}
                </span>
                <button
                  id={buttonId}
                  type="button"
                  aria-labelledby={`${buttonId} ${emailId}`}
                  onClick={() => handleRemove(h.email)}
                  disabled={state.status === "submitting"}
                  className={`${dangerButtonClass} shrink-0`}
                >
                  {removingThis ? "Removing…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="host-alert-email" className={controlLabelClass}>
            Add a host email
          </label>
          <input
            id="host-alert-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="host@example.com"
            className={`${inputBase} ${inputBorder(false)}`}
          />
        </div>
        <div>
          {/* The slider's legend is read by screen readers; this caption is
              its visible twin, so it is hidden from them. */}
          <p aria-hidden="true" className={controlLabelClass}>
            Email language
          </p>
          <AdminSegmented
            name="host-alert-lang"
            legend="Email language"
            options={LANG_OPTIONS}
            value={lang}
            onChange={(v) => setLang(v === "es" ? "es" : "en")}
          />
        </div>
        <button type="submit" disabled={state.status === "submitting"} className={primaryButtonClass}>
          {state.status === "submitting" && state.removing === null ? "Adding…" : "Add host"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" className={`mt-2 ${failureLineClass}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
