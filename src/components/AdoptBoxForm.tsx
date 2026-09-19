"use client";

/**
 * AdoptBoxForm — the "Apply to adopt this box" inline-expand form on a blessing
 * box's card (Blessing Boxes slice 6, Build Plan card UX item 4). Posts to
 * POST /api/public/blessing-boxes/[id]/adopt (that route's own header has
 * the full guard order and rate-limit scopes); this component only owns
 * the form UI and the Turnstile hand-off.
 *
 * Turnstile via the shared useBoxTurnstileWidget() hook (src/lib/) — same
 * dedicated invisible box key + managed-checkbox fallback BoxCheckinPanel
 * uses, mount details in that hook's own header. A click before a token
 * exists queues the submit (`pendingSubmit`) rather than blocking the
 * button or sending an empty token; one effect fires it the instant a
 * token arrives, and a 15s timeout (PENDING_SUBMIT_TIMEOUT_MS, same value
 * BoxCheckinPanel uses) falls through to a plain error if none ever does.
 * ponytail: this is the hook's own documented ceiling — no note/state
 * restore on failure, because this form simply stays open (nothing is
 * cleared until a real success), unlike a one-tap check-in button.
 *
 * Controlled open state (card redesign, 2026-09-19) — `open`/`onOpenChange`
 * are OPTIONAL: omitted, the component behaves exactly as before (its own
 * `useState` + its own collapsed-link trigger button). Passed, the caller
 * (BoxCardBody's sponsor band, whose own "Apply to adopt this box" link is
 * now the ONE trigger for this form) owns open/closed and this component
 * renders no trigger of its own — otherwise the label would appear twice.
 * The Turnstile container still mounts unconditionally either way (this
 * file's own header, above) since the controlled case still needs a token
 * ready before the visitor finishes typing.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import { useBoxTurnstileWidget } from "@/lib/useBoxTurnstileWidget";

const PENDING_SUBMIT_TIMEOUT_MS = 15_000;

type SubmitState = "idle" | "submitting" | "success" | "error" | "rateLimited";

interface AdoptBoxFormProps {
  boxId: string;
  /** Controlled open state — see this file's own header. Omit for the standalone/uncontrolled case. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface PendingSubmit {
  displayName: string;
  email: string;
  note: string;
}

const RATE_LIMIT_ERRORS = new Set(["rate_limit_visitor", "rate_limit_box", "rate_limit_email", "rate_limit_global"]);

export default function AdoptBoxForm({ boxId, open: openProp, onOpenChange }: AdoptBoxFormProps) {
  const { locale } = useLocale();
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? openProp : internalOpen;
  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [pending, setPending] = useState<PendingSubmit | null>(null);

  // The container ref stays LOCAL to this component (not returned by the
  // hook) — see useBoxTurnstileWidget.ts's own header for why (the React
  // Compiler ESLint rule flags a ref bundled into a hook's returned state
  // object).
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstile = useBoxTurnstileWidget(turnstileContainerRef);

  async function submit(values: PendingSubmit) {
    setState("submitting");
    try {
      const res = await fetch(`/api/public/blessing-boxes/${boxId}/adopt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: values.displayName,
          email: values.email,
          note: values.note || undefined,
          // The page's own current locale — the route stores it and every
          // email this application's lifecycle sends renders in ONLY this
          // language (see the adopt route's own header).
          lang: locale,
          website: honeypot,
          turnstileToken: turnstile.token ?? "",
          turnstileKey: turnstile.mode,
          clientToken: getCheckinClientToken() ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data?.ok) {
        setState("success");
      } else if (data?.error && RATE_LIMIT_ERRORS.has(data.error)) {
        setState("rateLimited");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
    // AFTER the state is set, never before: the token is single-use so the
    // widget must be reset, but nothing about the reset may decide what the
    // visitor sees for a request the server already answered.
    turnstile.reset();
  }

  // Fires a queued submit the moment a token becomes available — see this
  // file's own header. setPending(null) is deferred to a microtask (same
  // react-hooks/set-state-in-effect workaround BoxCheckinPanel.tsx's own
  // token-arrival effect uses) rather than called synchronously in the
  // effect body.
  useEffect(() => {
    if (!turnstile.token || !pending) return;
    const values = pending;
    // Both the state clear AND the submit() call (which itself calls
    // setState synchronously as its first line) are deferred to the same
    // microtask — react-hooks/set-state-in-effect traces into a locally
    // defined function's body, so calling submit() directly here (even
    // with setPending(null) already deferred) still flags as a
    // synchronous setState-in-effect.
    queueMicrotask(() => {
      setPending(null);
      void submit(values);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit() closes over this render's turnstile.token/honeypot already; re-run per pending/token change, not per render.
  }, [turnstile.token, pending]);

  // No token ever arrives (widget failed to load/callback at all) — fail
  // the queued submit rather than leaving it stuck on "Sending…" forever.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(null);
      setState("error");
    }, PENDING_SUBMIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting" || pending) return;
    const values: PendingSubmit = { displayName: displayName.trim(), email: email.trim(), note: note.trim() };
    if (turnstile.token) {
      void submit(values);
    } else {
      setState("submitting");
      setPending(values);
      // No token in hand (expired after ~5 minutes on the page, or the widget
      // died) — ask for a fresh one NOW rather than hoping one turns up; the
      // token-arrival effect above sends the queued values when it lands.
      turnstile.reset();
    }
  }

  const busy = state === "submitting" || pending !== null;

  // The Script tag + Turnstile container render UNCONDITIONALLY, even while
  // collapsed — mounting the (invisible) widget the instant this component
  // exists, not only once the form is expanded, means a token is very
  // likely already resolved by the time a visitor finishes typing and taps
  // submit. It also fixes a real mount-timing bug: the hook's own
  // mount-on-first-render effect runs exactly once (see
  // useBoxTurnstileWidget.ts's own header) — if the container div were only
  // rendered after `open` flips true, that effect would have already run
  // and found no container to mount into, and nothing would ever retry.
  const turnstileNodes = (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onReady={turnstile.mount}
      />
      <div ref={turnstileContainerRef} data-testid="adopt-turnstile-widget" />
    </>
  );

  if (!open) {
    return (
      <>
        {/* Controlled mode (BoxCardBody's sponsor band): the band's own link
            IS the trigger — rendering a second one here would duplicate the
            label. Uncontrolled mode (standalone use): own trigger, unchanged. */}
        {!isControlled && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[44px] text-sm font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline w-fit text-left"
          >
            {t("box.adopt.linkLabel", locale)}
          </button>
        )}
        {turnstileNodes}
      </>
    );
  }

  if (state === "success") {
    return (
      <>
        <p role="status" className="text-sm font-medium text-[var(--color-success)]">
          {t("box.adopt.success", locale)}
        </p>
        {turnstileNodes}
      </>
    );
  }

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] p-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)]">
        {t("box.adopt.linkLabel", locale)}
      </h3>

      <div>
        <label htmlFor="adopt-display-name" className="block text-xs font-medium text-[var(--color-ink-700)]">
          {t("box.adopt.displayNameLabel", locale)}
        </label>
        <input
          id="adopt-display-name"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={FIELD_LIMITS.BOX_ADOPTER_DISPLAY_NAME}
          placeholder={t("box.adopt.displayNamePlaceholder", locale)}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        />
      </div>

      <div>
        <label htmlFor="adopt-email" className="block text-xs font-medium text-[var(--color-ink-700)]">
          {t("box.adopt.emailLabel", locale)}
        </label>
        <input
          id="adopt-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={FIELD_LIMITS.EMAIL}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        />
        <p className="mt-1 text-xs text-[var(--color-ink-400)]">
          {t("box.alerts.emailDisclosure", locale)}{" "}
          <Link href="/privacy" className="underline hover:text-[var(--color-sage-600)] transition-colors">
            {t("privacy.linkLabel", locale)}
          </Link>
        </p>
      </div>

      <div>
        <label htmlFor="adopt-note" className="block text-xs font-medium text-[var(--color-ink-700)]">
          {t("box.adopt.noteLabel", locale)}
        </label>
        <textarea
          id="adopt-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={FIELD_LIMITS.BOX_ADOPTER_NOTE}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] bg-white resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        />
      </div>

      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.form.error.generic", locale)}
        </p>
      )}
      {state === "rateLimited" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.form.error.rateLimit", locale)}
        </p>
      )}
      {turnstile.error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("form.turnstile.error", locale)}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          aria-disabled={busy}
          className="min-h-[44px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] text-sm font-semibold hover:bg-[var(--color-sage-600)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        >
          {busy ? t("box.adopt.submitting", locale) : t("box.adopt.submit", locale)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]"
        >
          {t("box.adopt.cancel", locale)}
        </button>
      </div>

      {/* Honeypot — visually hidden from real users, same convention as ReportForm.tsx */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="adopt-website">Website</label>
        <input
          id="adopt-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
    </form>
    {/* OUTSIDE the form, in the same tree position as the closed and success
        branches above (fragment child #2) — so React keeps the SAME container
        div across open/close/success instead of unmounting it and orphaning
        the Turnstile widget mounted inside. */}
    {turnstileNodes}
    </>
  );
}
