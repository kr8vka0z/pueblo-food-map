"use client";

/**
 * AdminConfirm — the on-page confirm that replaces window.confirm in the
 * admin (#926 decision 7; picture: `.pa-confirm` / ruleConfirm in
 * docs/design/design-system/pages/03c-components-admin.ts). It opens where
 * the asking button was, names the thing, says what happens and what does
 * not, and puts Cancel FIRST, then the action button: half the row each
 * from 640 up, stacked full width (Cancel on top) on a phone.
 * Nothing is sent until the action button is pressed: that press is the
 * gate window.confirm used to be.
 *
 * Three parts:
 *   useAdminConfirm()  -> { asking, ask, cancel, triggerRef }
 *     ask()       opens it (call from the trigger's onClick).
 *     cancel()    closes it and puts focus back on the trigger. Also call it
 *                 to close after the action succeeds and the page stays; if
 *                 the trigger is gone by then (the thing was removed), the
 *                 focus call is a no-op and focus stays where the browser
 *                 leaves it, so move it yourself if that matters.
 *     triggerRef  put on the trigger button. Keep the trigger MOUNTED with
 *                 hidden={asking} (not unmounted), or focus has nowhere to
 *                 return to.
 *   useAdminStep({ busy?, onCancel? }) -> { open, openStep, closeStep, triggerRef, fieldRef }
 *                 the same for an inline reason step that is not a confirm:
 *                 opening focuses fieldRef, closing returns to the trigger.
 *   <AdminConfirm title body confirmLabel busyLabel tone busy error onConfirm onCancel />
 *     title         the question, naming the thing ("Remove Eastside Pantry from the map?")
 *     children      optional body: what happens and what does not
 *     confirmLabel  names the action ("Remove from map"), never Yes or OK
 *     busyLabel     optional, shown on the action button while busy ("Removing…")
 *     tone          "danger" (red: removals) | "primary" (green: Publish, Approve all)
 *     busy          optional; disables both buttons (and Escape) while the request runs
 *     error         optional; a red line under the buttons (role="alert")
 *     onConfirm     runs the action; only the action button calls it
 *     onCancel      pass the hook's cancel
 *
 * Usage:
 *   // Destructure: the react-hooks/refs lint rule refuses `confirm.asking`
 *   // in render when the same object also holds the ref.
 *   const { asking, ask, cancel, triggerRef } = useAdminConfirm();
 *   <button ref={triggerRef} hidden={asking} onClick={ask} className={dangerButtonClass}>
 *     Remove from map
 *   </button>
 *   {asking && (
 *     <AdminConfirm title={`Remove ${name} from the map?`} confirmLabel="Remove from map" busyLabel="Removing…"
 *       tone="danger" busy={busy} error={error} onConfirm={remove} onCancel={cancel}>
 *       It will stop appearing on the next publish. Its record is kept, not deleted.
 *     </AdminConfirm>
 *   )}
 *
 * Focus: opening moves focus to Cancel (so Enter right after opening is the
 * safe choice); cancel() returns it to the trigger after the trigger is
 * shown again (an effect, not a synchronous focus on a still-hidden button).
 * Both buttons are type="button", so the box is safe inside a <form>.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { dangerButtonClass, failureLineClass, primaryButtonClass, secondaryButtonClass } from "@/lib/adminCardStyles";

export function useAdminConfirm<T extends HTMLElement = HTMLButtonElement>(): {
  asking: boolean;
  ask: () => void;
  cancel: () => void;
  triggerRef: RefObject<T | null>;
} {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<T | null>(null);
  const returnFocus = useRef(false);
  const ask = useCallback(() => setAsking(true), []);
  const cancel = useCallback(() => {
    returnFocus.current = true;
    setAsking(false);
  }, []);
  useEffect(() => {
    if (!asking && returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);
  return { asking, ask, cancel, triggerRef };
}

/**
 * useAdminStep — the same focus handling for an inline step that opens in
 * place of its button but is not a confirm box (the Reject, Remove photo and
 * Decline reason steps on the change cards). Opening moves focus to the
 * step's first field (fieldRef); closeStep() hands it back to the trigger.
 * As with useAdminConfirm, keep the trigger MOUNTED with hidden={open}.
 *   const { open, openStep, closeStep, triggerRef, fieldRef } = useAdminStep({ busy, onCancel });
 *
 * Escape closes the step the way it closes a confirm, while focus is inside
 * the step: the nearest ancestor of fieldRef marked data-admin-step, else
 * the element that directly holds fieldRef. Mark the step's box with
 * data-admin-step when the field sits in its own wrapper (a TextField), so
 * Escape also works from the step's buttons. Options, both optional:
 *   busy      true while the step's request runs: Escape then does nothing.
 *   onCancel  what the step's own Cancel button does (clear the reason,
 *             then closeStep()), so Escape leaves the same state behind.
 *             Without it Escape only calls closeStep().
 */
export function useAdminStep<F extends HTMLElement = HTMLTextAreaElement>(
  options: { busy?: boolean; onCancel?: () => void } = {},
): {
  open: boolean;
  openStep: () => void;
  closeStep: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  fieldRef: RefObject<F | null>;
} {
  const { busy = false, onCancel } = options;
  const { asking, ask, cancel, triggerRef } = useAdminConfirm();
  const fieldRef = useRef<F | null>(null);
  useEffect(() => {
    if (asking) fieldRef.current?.focus();
  }, [asking]);
  // A native listener on the step's box, not on the document: a page can
  // hold several open steps, and Escape must close only the one it was
  // pressed in. Re-attached when busy or onCancel change, so it never acts
  // on a stale value.
  useEffect(() => {
    const field = asking ? fieldRef.current : null;
    const box = field?.closest<HTMLElement>("[data-admin-step]") ?? field?.parentElement;
    if (!box) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || busy) return;
      e.preventDefault();
      (onCancel ?? cancel)();
    };
    box.addEventListener("keydown", onKeyDown);
    return () => box.removeEventListener("keydown", onKeyDown);
  }, [asking, busy, onCancel, cancel]);
  return { open: asking, openStep: ask, closeStep: cancel, triggerRef, fieldRef };
}

type AdminConfirmProps = {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  tone: "danger" | "primary";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AdminConfirm({
  title,
  children,
  confirmLabel,
  busyLabel,
  tone,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: AdminConfirmProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      className={
        "flex flex-col gap-2 rounded-[var(--radius-md)] border bg-white p-4 " +
        (tone === "danger" ? "border-[var(--color-danger)]" : "border-[var(--color-sage-500)]")
      }
    >
      <p id={titleId} className="font-medium text-[var(--color-ink-900)]">
        {title}
      </p>
      {children && <div className="text-sm text-[var(--color-ink-700)]">{children}</div>}
      {/* WHY stacked under 640: at half a phone's width the action's words
          wrapped ("Remove from / map"). Full width, Cancel stays on top. */}
      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={tone === "danger" ? dangerButtonClass : primaryButtonClass}
        >
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
      </div>
      {error && (
        <p role="alert" className={failureLineClass}>
          {error}
        </p>
      )}
    </div>
  );
}
