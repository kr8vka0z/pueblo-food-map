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
 * "Email language" select (English/Spanish, default English) — a host is
 * admin-added, not self-signed-up, so there's no page locale to read the
 * way the two public forms (AdoptBoxForm/BoxAlertSignupForm) do; the admin
 * picks it directly. The route stores it and every future alert this host
 * receives renders in ONLY that language.
 */

import { useState } from "react";

interface HostRow {
  id: number;
  email: string;
}

export interface HostAlertsAdminPanelProps {
  venueId: string;
  initialHosts: HostRow[];
}

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-500)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const removeButtonClass =
  "text-sm font-medium text-[var(--color-danger)] underline underline-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";

type PanelState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

export default function HostAlertsAdminPanel({ venueId, initialHosts }: HostAlertsAdminPanelProps) {
  const [hosts, setHosts] = useState<HostRow[]>(initialHosts);
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState<"en" | "es">("en");
  const [state, setState] = useState<PanelState>({ status: "idle" });

  const genericErrorMessage = "Something went wrong. Try again.";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });
    try {
      const res = await fetch(`/api/admin/blessing-boxes/${venueId}/host-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang }),
      });
      const data = (await res.json().catch(() => null)) as { hosts?: HostRow[]; error?: string } | null;
      if (res.status === 200 && data?.hosts) {
        setHosts(data.hosts);
        setEmail("");
        setState({ status: "idle" });
        return;
      }
      if (res.status === 409) {
        setState({ status: "error", message: "That address previously stopped these emails and can't be re-added here." });
        return;
      }
      setState({ status: "error", message: genericErrorMessage });
    } catch {
      setState({ status: "error", message: genericErrorMessage });
    }
  }

  async function handleRemove(hostEmail: string) {
    setState({ status: "submitting" });
    try {
      const res = await fetch(`/api/admin/blessing-boxes/${venueId}/host-alerts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: hostEmail }),
      });
      const data = (await res.json().catch(() => null)) as { hosts?: HostRow[] } | null;
      if (res.status === 200 && data?.hosts) {
        setHosts(data.hosts);
        setState({ status: "idle" });
        return;
      }
      setState({ status: "error", message: genericErrorMessage });
    } catch {
      setState({ status: "error", message: genericErrorMessage });
    }
  }

  return (
    <div>
      {hosts.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-500)]">No host emails on file yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {hosts.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 text-sm text-[var(--color-ink-700)]">
              <span>{h.email}</span>
              <button
                type="button"
                onClick={() => handleRemove(h.email)}
                disabled={state.status === "submitting"}
                className={removeButtonClass}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="host-alert-email" className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">
            Add a host email
          </label>
          <input
            id="host-alert-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="host@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="host-alert-lang" className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">
            Email language
          </label>
          <select
            id="host-alert-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value === "es" ? "es" : "en")}
            className={inputClass}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </div>
        <button type="submit" disabled={state.status === "submitting"} className={primaryButtonClass}>
          {state.status === "submitting" ? "Adding…" : "Add host"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      )}
    </div>
  );
}
