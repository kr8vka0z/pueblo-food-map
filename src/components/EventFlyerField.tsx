"use client";

/**
 * EventFlyerField — the flyer section of the admin event form (#760).
 *
 * Edit mode only: a flyer is stored under the event's id, so a brand-new event
 * (no id yet) shows a one-line "save first" note instead. Each action goes
 * straight to /api/admin/events/[id]/flyer and is saved by itself, separate
 * from the form's Save button:
 *   - choosing a file shrinks it in the browser (shrinkFlyerToJpeg, about
 *     150 KB, never cropped) and uploads it with the alt texts typed so far;
 *   - "Save description" re-sends only the alt texts for the flyer already there;
 *   - Remove asks on the page first (AdminConfirm, #926: no browser pop-up),
 *     and only its Remove flyer button deletes it.
 * The flyer route changes the event's `updated_at`, so every success hands the
 * new value up (`onVersion`); without that the form's next Save would 409
 * against the admin's own flyer change.
 *
 * The preview reads the ADMIN route, not the public URL: a draft's flyer has
 * no public URL. The route's answers carry field-level messages (`errors.flyer`),
 * shown right under the picture.
 */

import { useEffect, useRef, useState } from "react";
import { shrinkFlyerToJpeg, UnsupportedImageError } from "@/lib/imageResize";
import type { PublicFlyer } from "@/lib/events";
import { dangerButtonClass, secondaryButtonClass } from "@/lib/adminCardStyles";
import { errorClass, fieldGroupClass, hintClass, inputBase, inputBorder, labelClass } from "@/components/formClasses";
import AdminConfirm, { useAdminConfirm } from "@/components/AdminConfirm";

export interface EventFlyerFieldProps {
  /** Absent in create mode. */
  eventId?: string;
  /** The row's current `updated_at` (the 409 precondition). */
  version?: string;
  onVersion: (updatedAt: string) => void;
  initialFlyer?: PublicFlyer | null;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const WRONG_TYPE = "That file isn't a JPEG, PNG or WebP image. Choose a different one.";

const inputClass = `${inputBase} ${inputBorder(false)}`;

type Busy = null | "uploading" | "saving" | "removing";

export default function EventFlyerField({ eventId, version, onVersion, initialFlyer = null }: EventFlyerFieldProps) {
  const [flyer, setFlyer] = useState<PublicFlyer | null>(initialFlyer);
  const [alt, setAlt] = useState(initialFlyer?.alt ?? "");
  const [altEs, setAltEs] = useState(initialFlyer?.alt_es ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const { asking, ask, cancel, triggerRef } = useAdminConfirm();
  const focusChooseNext = useRef(false);
  // An effect, not a focus call in remove(): the button is still disabled until busy clears and re-renders.
  useEffect(() => {
    if (busy === null && !asking && focusChooseNext.current) {
      focusChooseNext.current = false;
      chooseRef.current?.focus();
    }
  }, [busy, asking]);

  if (eventId === undefined || version === undefined) {
    return (
      <fieldset className={fieldGroupClass}>
        <legend className={`${labelClass} px-1`}>Flyer or photo</legend>
        <p className="text-sm text-[var(--color-ink-500)]">Save the event first, then add a flyer here.</p>
      </fieldset>
    );
  }

  const endpoint = `/api/admin/events/${eventId}/flyer`;
  const altDirty = flyer !== null && (alt.trim() !== (flyer.alt ?? "") || altEs.trim() !== (flyer.alt_es ?? ""));

  /** Sends one flyer request and folds the answer into state; returns whether it worked. */
  async function send(init: RequestInit, busyState: Exclude<Busy, null>, done: string): Promise<boolean> {
    setBusy(busyState);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(endpoint, init);
      const data = (await res.json().catch(() => null)) as {
        updated_at?: string;
        flyer?: PublicFlyer | null;
        message?: string;
        errors?: Record<string, string>;
      } | null;
      if (res.ok && data?.updated_at) {
        onVersion(data.updated_at);
        setFlyer(data.flyer ?? null);
        setAlt(data.flyer?.alt ?? "");
        setAltEs(data.flyer?.alt_es ?? "");
        setNotice(done);
        return true;
      }
      setError(data?.errors?.flyer ?? data?.errors?.flyer_alt ?? data?.errors?.flyer_alt_es ?? data?.message ?? "The upload failed. Try again.");
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
    return false;
  }

  function body(file?: Blob): FormData {
    const form = new FormData();
    if (file) form.set("flyer", file, "flyer.jpg");
    form.set("alt", alt);
    form.set("alt_es", altEs);
    form.set("expectedUpdatedAt", version as string);
    return form;
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    // Some Android pickers report no type at all; only refuse a type that is present and wrong.
    // A non-image with a blank type still fails at decode, with its own message below.
    if (file.type && !ACCEPTED.includes(file.type)) {
      setError(WRONG_TYPE);
      return;
    }
    setBusy("uploading");
    setError(null);
    setNotice(null);
    let small: Blob;
    try {
      small = await shrinkFlyerToJpeg(file);
    } catch (err) {
      setBusy(null);
      setError(err instanceof UnsupportedImageError ? "This browser couldn't open that image. Try a JPEG or PNG." : "The image couldn't be prepared. Try a different one.");
      return;
    }
    await send({ method: "POST", body: body(small) }, "uploading", "Flyer saved.");
  }

  // Runs only from the on-page confirm's Remove flyer button: that second press is the gate.
  async function remove() {
    const ok = await send(
      { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: version }) },
      "removing",
      "Flyer removed.",
    );
    if (ok) {
      // The Remove button is gone with the flyer, so close the confirm (or the next upload
      // would open with it still asking) and give focus to Choose image once it is enabled again.
      focusChooseNext.current = true;
      cancel();
    }
  }

  return (
    <fieldset className={`space-y-3 ${fieldGroupClass}`}>
      <legend className={`${labelClass} px-1`}>
        Flyer or photo <span className={hintClass}>(optional) shown at the top of the event card</span>
      </legend>

      {flyer && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-uploaded file; the key in ?v busts the cache on replace
        <img
          src={`${endpoint}?v=${encodeURIComponent(flyer.src)}`}
          alt="Current flyer preview"
          width={flyer.width}
          height={flyer.height}
          className="max-h-72 w-auto max-w-full rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-[var(--color-bone-100)] object-contain"
        />
      )}

      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(",")}
        aria-label="Flyer image file"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // choosing the same file again must still fire onChange
          void choose(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button ref={chooseRef} type="button" disabled={busy !== null} onClick={() => input.current?.click()} className={secondaryButtonClass}>
          {busy === "uploading" ? "Uploading…" : flyer ? "Replace image" : "Choose image"}
        </button>
        {flyer && (
          <button ref={triggerRef} type="button" hidden={asking} disabled={busy !== null} onClick={ask} className={dangerButtonClass}>
            Remove
          </button>
        )}
        <p className="text-xs text-[var(--color-ink-500)]">JPEG, PNG or WebP. It is shrunk to about 150 KB before upload.</p>
      </div>
      {flyer && asking && (
        <AdminConfirm
          title="Remove this flyer?"
          confirmLabel="Remove flyer"
          busyLabel={busy === "removing" ? "Removing…" : undefined}
          tone="danger"
          // Any flyer request in flight blocks the confirm, as it blocked the old Remove button.
          busy={busy !== null}
          onConfirm={() => void remove()}
          onCancel={cancel}
        >
          The event stays. Only the picture is removed.
        </AdminConfirm>
      )}

      {/* The one error line for every flyer action, the confirm's included (it sits right above). */}
      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-sm text-[var(--color-sage-700)]">
          {notice}
        </p>
      )}

      {/* items-end: the two labels can wrap differently; keep the boxes level. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
        <div>
          <label htmlFor="event-flyer-alt" className={labelClass}>
            Describe the picture (English) <span className={hintClass}>for screen readers</span>
          </label>
          <input id="event-flyer-alt" type="text" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="event-flyer-alt-es" className={labelClass}>
            Describe the picture (Spanish) <span className={hintClass}>(optional)</span>
          </label>
          <input id="event-flyer-alt-es" type="text" lang="es" value={altEs} maxLength={200} onChange={(e) => setAltEs(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--color-ink-500)]">
        If left blank, the event name is read out instead. Descriptions are saved with the picture or the Save description button, not the Save buttons below.
      </p>
      {flyer && (
        <button
          type="button"
          disabled={busy !== null || !altDirty}
          onClick={() => void send({ method: "POST", body: body() }, "saving", "Description saved.")}
          className={secondaryButtonClass}
        >
          {busy === "saving" ? "Saving…" : "Save description"}
        </button>
      )}
    </fieldset>
  );
}
