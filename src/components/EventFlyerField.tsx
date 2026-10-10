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
 *   - Remove deletes it.
 * The flyer route changes the event's `updated_at`, so every success hands the
 * new value up (`onVersion`); without that the form's next Save would 409
 * against the admin's own flyer change.
 *
 * The preview reads the ADMIN route, not the public URL: a draft's flyer has
 * no public URL. The route's answers carry field-level messages (`errors.flyer`),
 * shown right under the picture.
 */

import { useRef, useState } from "react";
import { shrinkFlyerToJpeg, UnsupportedImageError } from "@/lib/imageResize";
import type { PublicFlyer } from "@/lib/events";

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

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";
const buttonClass =
  "inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-sage-500)] px-4 text-sm " +
  "font-medium text-[var(--color-sage-600)] bg-transparent hover:bg-[var(--color-sage-50)] focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
const dangerClass =
  "inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] px-4 text-sm " +
  "font-medium text-[var(--color-danger)] bg-transparent hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

type Busy = null | "uploading" | "saving" | "removing";

export default function EventFlyerField({ eventId, version, onVersion, initialFlyer = null }: EventFlyerFieldProps) {
  const [flyer, setFlyer] = useState<PublicFlyer | null>(initialFlyer);
  const [alt, setAlt] = useState(initialFlyer?.alt ?? "");
  const [altEs, setAltEs] = useState(initialFlyer?.alt_es ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (eventId === undefined || version === undefined) {
    return (
      <fieldset className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--color-ink-700)]">Flyer or photo</legend>
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
    if (!ACCEPTED.includes(file.type)) {
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

  async function remove() {
    if (!window.confirm("Remove this flyer?")) return;
    await send(
      { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt: version }) },
      "removing",
      "Flyer removed.",
    );
  }

  return (
    <fieldset className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] p-4">
      <legend className="px-1 text-sm font-medium text-[var(--color-ink-700)]">
        Flyer or photo <span className="font-normal text-[var(--color-ink-400)]">optional, shown at the top of the event card</span>
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
        <button type="button" disabled={busy !== null} onClick={() => input.current?.click()} className={buttonClass}>
          {busy === "uploading" ? "Uploading…" : flyer ? "Replace image" : "Choose image"}
        </button>
        {flyer && (
          <button type="button" disabled={busy !== null} onClick={() => void remove()} className={dangerClass}>
            {busy === "removing" ? "Removing…" : "Remove"}
          </button>
        )}
        <p className="text-xs text-[var(--color-ink-500)]">JPEG, PNG or WebP. It is shrunk to about 150 KB before upload.</p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="text-sm text-[var(--color-sage-700)]">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-flyer-alt" className="mb-1 block text-sm font-medium text-[var(--color-ink-700)]">
            Describe the picture (English) <span className="font-normal text-[var(--color-ink-400)]">for screen readers</span>
          </label>
          <input id="event-flyer-alt" type="text" value={alt} maxLength={200} onChange={(e) => setAlt(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="event-flyer-alt-es" className="mb-1 block text-sm font-medium text-[var(--color-ink-700)]">
            Describe the picture (Spanish) <span className="font-normal text-[var(--color-ink-400)]">optional</span>
          </label>
          <input id="event-flyer-alt-es" type="text" lang="es" value={altEs} maxLength={200} onChange={(e) => setAltEs(e.target.value)} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-[var(--color-ink-500)]">If left blank, the event name is read out instead.</p>
      {flyer && (
        <button
          type="button"
          disabled={busy !== null || !altDirty}
          onClick={() => void send({ method: "POST", body: body() }, "saving", "Description saved.")}
          className={buttonClass}
        >
          {busy === "saving" ? "Saving…" : "Save description"}
        </button>
      )}
    </fieldset>
  );
}
