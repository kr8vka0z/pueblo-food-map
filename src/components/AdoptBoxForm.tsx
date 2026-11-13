"use client";

/**
 * AdoptBoxForm — the "Apply to sponsor this box" inline-expand form on a blessing
 * box's card (Blessing Boxes slice 6, Build Plan card UX item 4). Posts to
 * POST /api/public/blessing-boxes/[id]/adopt (that route's own header has
 * the full guard order and rate-limit scopes); this component only owns
 * the form UI and the Turnstile hand-off.
 *
 * Turnstile via the shared useTurnstile() hook (src/lib/) — same
 * dedicated invisible box key + managed-checkbox fallback BoxCheckinPanel
 * uses, mount details in that hook's own header. A click before a token
 * exists is queued by useQueuedTurnstileSubmit (src/lib/useTurnstile.ts), which carries
 * the 15s timeout and the ponytail note on failure handling.
 *
 * Controlled open state (card redesign, 2026-09-19): the caller
 * (BoxCardBody's sponsor band, whose own "Apply to sponsor this box" link is
 * the ONE trigger for this form) owns open/closed, and this component
 * renders no trigger of its own — otherwise the label would appear twice.
 * The Turnstile container still mounts while closed (CardFormTurnstile's
 * header) so a token is ready before the visitor finishes typing.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import { useQueuedTurnstileSubmit, useTurnstile } from "@/lib/useTurnstile";
import CardFormTurnstile from "@/components/CardFormTurnstile";
import { track, EVENTS } from "@/lib/analytics";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/components/BoxCheckinPanel";

type SubmitState = "idle" | "submitting" | "success" | "error" | "rateLimited";

interface AdoptBoxFormProps {
  boxId: string;
  /** Controlled open state — see this file's own header. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PendingSubmit {
  displayName: string;
  email: string;
  note: string;
}

const RATE_LIMIT_ERRORS = new Set(["rate_limit_visitor", "rate_limit_box", "rate_limit_email", "rate_limit_global"]);

export default function AdoptBoxForm({ boxId, open, onOpenChange }: AdoptBoxFormProps) {
  const { locale } = useLocale();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  // The container ref stays LOCAL to this component (not returned by the
  // hook) — see useTurnstile.ts's own header for why (the React
  // Compiler ESLint rule flags a ref bundled into a hook's returned state
  // object).
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileContainerRef, { box: true });

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
        void track(EVENTS.BOX_ADOPTED, { boxId });
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

  const { queued, queue } = useQueuedTurnstileSubmit<PendingSubmit>(
    turnstile.token,
    (values) => void submit(values),
    () => setState("error"),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting" || queued) return;
    const values: PendingSubmit = { displayName: displayName.trim(), email: email.trim(), note: note.trim() };
    if (turnstile.token) {
      void submit(values);
    } else {
      setState("submitting");
      queue(values);
      // No token in hand (expired after ~5 minutes on the page, or the widget
      // died) — ask for a fresh one NOW rather than hoping one turns up; the
      // token-arrival effect above sends the queued values when it lands.
      turnstile.reset();
    }
  }

  const busy = state === "submitting" || queued;

  // Shown while open, sitting right after the submit/cancel row (visually
  // "inside the form"); off-screen while closed or after success — see
  // CardFormTurnstile's header (#669).
  const turnstileNodes = (
    <CardFormTurnstile
      containerRef={turnstileContainerRef}
      onReady={turnstile.mount}
      visible={open && state !== "success"}
      testId="adopt-turnstile-widget"
    />
  );

  // The sponsor band's own link is the trigger (header), so closed renders
  // only the Turnstile container — as fragment child #2, the same tree
  // position the open and success branches use, so the container survives.
  if (!open) return <>{null}{turnstileNodes}</>;

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
          className={PRIMARY_BTN}
        >
          {busy ? t("box.adopt.submitting", locale) : t("box.adopt.submit", locale)}
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className={SECONDARY_BTN}
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
        branches above (fragment child #2) — CardFormTurnstile's header. */}
    {turnstileNodes}
    </>
  );
}
