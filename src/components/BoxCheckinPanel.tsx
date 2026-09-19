"use client";

/**
 * BoxCheckinPanel — the public check-in panel on /box/[id] (Blessing Boxes
 * slice 2, Discovery stories C1-C4: "I filled it" / "I took something" /
 * "Running low" / "It's empty" / "Report a problem"). Slice 5 (2026-09-18)
 * adds a 6th choice, "Add a photo" — see that section of this header below.
 *
 * Five check-in buttons, one tap each. 'took'/'low'/'empty' submit
 * immediately — "one tap ... no note, no extra screen" (Build Plan).
 * 'filled'/'problem' expand a small optional-note form first (this slice's
 * own scope: "optional short note on filled and problem").
 *
 * Turnstile mount/reset mirrors ReportForm.tsx's own widget lifecycle
 * (mount once the CF script loads; the sitekey/container pattern is
 * identical) with one addition: a Turnstile token is single-use, so this
 * panel resets the widget after EVERY submit attempt, not only a failed
 * one — a user can tap more than once in the same page view (e.g. "took"
 * now, "empty" later), and the second tap would otherwise silently fail
 * Turnstile verification with a stale, already-consumed token.
 *
 * Widget visibility (2026-09-18, Kyle: "Do we need to show the Cloudflare
 * check?" — then, same day, from his phone: the managed-mode widget still
 * popped the checkbox on a real device even with `appearance:
 * "interaction-only"", so a SECOND, dedicated Turnstile site key was
 * provisioned in Cloudflare's own "invisible" widget mode
 * (`NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY` — check-ins only; every other
 * public form keeps the original managed-mode key,
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). An invisible-mode key never renders a
 * checkbox at all — `appearance` is irrelevant to it and is left off the
 * render call. That means a tap CAN still land before a token exists yet
 * (the invisible challenge is still asynchronous). Rather
 * than block the whole panel on it (the old "Verifying…" line + disabled
 * buttons) or silently drop the tap, the tapped kind is queued
 * (`pendingSubmit`) and an effect fires it the moment `turnstileToken`
 * resolves — the tapped button shows the same "Sending…" label a real
 * in-flight submit uses, everything else disables for the moment so a
 * second tap can't race it. Token expiry is already handled the same way:
 * Turnstile's own `expired-callback` clears `turnstileToken`, and the next
 * tap (or an already-queued one) waits for the callback's next token exactly
 * like the first one did.
 *
 * Fallback to a visible checkbox (2026-09-18, follow-up): the invisible
 * widget's own `error-callback` fires whenever Cloudflare doubts a visitor —
 * with no widget on screen, that visitor had no way through at all (the old
 * behavior: a red "please retry" error, forever, since retrying just re-runs
 * the same invisible check that will fail the same way). Instead, a box
 * error-callback swaps the invisible widget for a SECOND widget rendered
 * into the same container, using the ordinary MANAGED key every other public
 * form already uses (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, default visible
 * "Verify you are human" checkbox — no `appearance` override). `turnstileMode`
 * ("box" | "fallback", mirrored into `turnstileModeRef` so the widget
 * callbacks registered once at mount always read the current value, same
 * reason `submitCheckin`'s own closure trick exists below) tracks which key
 * is live; it flips at most once and never flips back — once a visitor has
 * been asked for the visible checkbox, there's no reason to re-attempt the
 * invisible one. A tap queued when the box widget fails is NOT failed — it
 * stays in `pendingSubmit` and the existing token-arrival effect fires it
 * the moment the FALLBACK widget produces a token, now carrying
 * `turnstileKey: "fallback"` in the POST body instead of `"box"` (the server
 * route picks its verification secret off this field). While waiting on the
 * human, a calm one-line prompt (`box.checkin.turnstileFallbackPrompt`)
 * replaces the old red error text — the fallback widget is expected to need
 * an actual tap, not a transient failure.
 *
 * A queued tap isn't guaranteed a token ever arrives — Turnstile's own
 * `error-callback` can fire instead, or the widget script can fail to load
 * or call back at all (content blocker, offline, slow network). Either way
 * the tapped button would otherwise read "Sending…" forever with every
 * button disabled and no way out. `failQueuedSubmit` is the one recovery
 * path both cases route through: it clears `pendingSubmit`, shows the
 * existing plain error message, and — for a note-kind tap (filled/problem)
 * — reopens the note form with the visitor's typed text (and any attached
 * photo, slice 5) restored, since `handleNoteSubmit` already cleared that
 * live state at queue time. In BOX mode, neither trigger reaches
 * `failQueuedSubmit` directly anymore: `error-callback` calls
 * `switchToFallback()` instead (see above), and `PENDING_SUBMIT_TIMEOUT_MS`
 * — which still only runs in box mode; it's suspended entirely once
 * `turnstileMode` is `"fallback"`, since a visible checkbox waiting on a
 * real human tap has no natural time bound — also calls `switchToFallback()`
 * first and only falls through to `failQueuedSubmit` if that swap itself
 * couldn't happen (`window.turnstile` never loaded at all — the one case a
 * fallback widget can't be mounted either). Only once the FALLBACK widget's
 * own `error-callback` fires does `failQueuedSubmit` run for real, restoring
 * the plain red error exactly as before this change.
 *
 * onCheckinSuccess lifts the POST response's fresh status/lastFilledAt
 * straight into BoxContent's own state — no refetch, no dependency on the
 * list endpoint's 60s cache (see the route handler's own header for the
 * full freshness story).
 *
 * Slice 5 — "Add a photo" (2026-09-18): a 6th tap opens a small file-picker
 * form (standalone, no check-in attached — `checkinId: null`), and the
 * "filled" note form gains its own optional photo attach (spec: "optional
 * photo attached to the 'filled' note form too") — `usePhotoAttach()`
 * below is instantiated twice, once per context, so the pick/shrink/
 * preview/error logic exists in exactly one place ("one upload path serves
 * both", per the task). A file is shrunk client-side to a JPEG blob
 * immediately on selection (shrinkImageToJpeg, src/lib/imageResize.ts) —
 * before any Turnstile/submit step — so an unsupported format (HEIC on a
 * browser with no decoder) surfaces as a friendly inline error right away,
 * not after a wasted round trip.
 *
 * Chaining onto the SAME single-widget Turnstile flow, not a second widget:
 * `pendingSubmit` is widened to a discriminated union — a queued CHECK-IN
 * tap now optionally carries an attached photo blob, and a queued PHOTO tap
 * (checkinId null or, after a successful "filled" checkin, that checkin's
 * new id) is its own variant the same token-arrival effect can fire. A
 * checkin submit's own Turnstile token is single-use and gets reset right
 * after that request completes; Turnstile's default `execution: "render"`
 * mode means `turnstile.reset()` on an invisible/box-mode widget
 * automatically re-runs the challenge and calls back with a FRESH token —
 * so "filled + attached photo" queues the photo upload the instant the
 * checkin succeeds, and it fires as soon as that next token lands, with no
 * second widget and no separate photo-specific Turnstile plumbing needed.
 * (In fallback/checkbox mode, the visitor would need to tap the checkbox
 * again for that second token — a real but rare edge case, not blocking:
 * fallback mode only triggers when the invisible check already doubted the
 * visitor once, and the queued photo upload simply waits, same as any other
 * queued submit does.)
 *
 * "What would help you next time?" ask (migration 0012, mockup v3 Part 2):
 * a successful 'took' check-in (only 'took' — never filled/low/empty/
 * problem) that comes back with a `checkinId` AND `needsToken` opens the
 * ask IN PLACE of the three button groups (`needsAsk` state) — chips for
 * the nine fixed NEED_KEYS plus one optional short text field. Skip, or
 * Send with nothing picked and nothing typed, just clears `needsAsk`
 * locally with NO request — there is nothing meaningful to save. A real
 * Send chains onto the SAME single-widget Turnstile flow as the photo
 * attach above (queued in `pendingSubmit` as a `"needs"` variant): by the
 * time a visitor has read the heading and tapped a chip, the checkin's own
 * post-success `turnstile.reset()` has almost always already produced a
 * fresh token, but the queue exists for the rare case it hasn't yet.
 * `checkinId`/`needsToken` are held only in component state, never
 * persisted — losing them (a page refresh mid-ask) simply means the ask
 * can no longer be answered for that check-in, the same low-stakes ceiling
 * boxNeedsToken.ts's own header describes. A failed Send (network error,
 * expired 15-minute window, rate limit) closes the ask and shows the
 * existing generic error copy — ponytail: this drops the visitor's picks on
 * a transient failure rather than restoring the ask with them intact; the
 * upgrade path is the same `note`/`photoBlob`-restore pattern
 * failQueuedSubmit already uses for a note-kind checkin, extended to needs.
 */

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { getCheckinClientToken } from "@/lib/checkinClientToken";
import { shrinkImageToJpeg, UnsupportedImageError } from "@/lib/imageResize";
import ReportPhotoButton from "@/components/ReportPhotoButton";
import { NEED_KEYS, type BoxStatus, type CheckinKind, type NeedKey } from "@/lib/blessingBoxes";

const { BOX_CHECKIN_NOTE } = FIELD_LIMITS;

// Card redesign (2026-09-19) — the five kinds now render in three explicit
// groups instead of one CHECKIN_KINDS.map'd flat grid: a colored-dot status
// trio (filled/low/empty, STATUS_KINDS' order), a two-up row (took, add a
// photo), and 'problem' as a quiet text link beside "Report photo" — each
// group's own JSX below names its kinds directly, so the old single
// display-order array no longer has a reader.
const STATUS_KINDS: readonly CheckinKind[] = ["filled", "low", "empty"];
/** Dot color per status-trio kind — same success/warning/danger tokens STATUS_DOT_CLASS (blessingBoxes.ts) uses, keyed by CheckinKind instead of BoxStatus (different domain: what someone just reported vs. the box's current computed status), so kept local rather than shared. */
const KIND_DOT_CLASS: Partial<Record<CheckinKind, string>> = {
  filled: "bg-[var(--color-success)]",
  low: "bg-[var(--color-warning)]",
  empty: "bg-[var(--color-danger)]",
};
const KINDS_WITH_NOTE: ReadonlySet<CheckinKind> = new Set(["filled", "problem"]);
/** Only the "filled" note form gets a photo-attach option — the task's own spec names "filled" specifically, not "problem" (a problem report's photo, if ever needed, is a separate future scope). */
const KIND_WITH_PHOTO_ATTACH: CheckinKind = "filled";

// A queued tap (see this file's own header) must not wait forever for a
// token that may never come — 15s is comfortably longer than Turnstile's own
// typical challenge-resolution time, short enough that a real visitor isn't
// left staring at "Sending…" wondering if their tap registered.
const PENDING_SUBMIT_TIMEOUT_MS = 15_000;

interface BoxCheckinPanelProps {
  boxId: string;
  /**
   * `kind` was added for the map-first card rework (2026-09-18): the card
   * shows the single most recent check-in inline, and the POST response
   * body never echoes back which kind was just submitted — the caller
   * already knows it (it's what it just sent), so it's threaded through
   * here rather than re-fetched.
   */
  onCheckinSuccess: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
  /** Card redesign (2026-09-19): the box's current photo id, if any — renders "Report photo" beside "Report a problem" (moved down from the card's top photo slot, which now shows only the caption chip). Omit/null when there's no photo yet. */
  latestPhotoId?: number | null;
}

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error"
  // Split 2026-09-17 (review correction) from one shared "rate_limited" —
  // the route now returns two distinct error codes (rate_limit_visitor vs.
  // rate_limit_box) so the copy can say WHOSE cap tripped instead of one
  // message that misdirected blame either way.
  | "rate_limited_visitor"
  | "rate_limited_box";

type PhotoSubmitState = "idle" | "submitting" | "success" | "error";

/** A queued action waiting on the next Turnstile token — see this file's own header, "Chaining onto the SAME single-widget Turnstile flow." */
type PendingSubmit =
  | { type: "checkin"; kind: CheckinKind; note: string; photoBlob: Blob | null }
  | { type: "photo"; blob: Blob; checkinId: number | null }
  | { type: "needs"; checkinId: number; needsToken: string; needs: NeedKey[]; note: string };

/** A 'took' check-in that came back with enough to open the needs ask — see this file's own header, "What would help you next time?" ask. */
interface NeedsAsk {
  checkinId: number;
  needsToken: string;
}

/**
 * The pick -> shrink -> preview -> error state machine for one photo-attach
 * slot, instantiated once per context (the standalone "Add a photo" form,
 * and the "filled" note form's own attach) so that logic exists in exactly
 * one place. Shrinking happens immediately on selection (before any
 * Turnstile/submit step) so an unsupported format surfaces right away.
 */
function usePhotoAttach() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  function clear() {
    setBlob(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
  }

  /** Restores a previously-selected blob (e.g. after a failed queued submit) without re-running the shrink step — the blob is already shrunk. */
  function restore(restoredBlob: Blob) {
    setBlob(restoredBlob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(restoredBlob);
    });
  }

  async function select(file: File, locale: Locale) {
    setError(null);
    setProcessing(true);
    try {
      const shrunk = await shrinkImageToJpeg(file);
      setBlob(shrunk);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(shrunk);
      });
    } catch (err) {
      setBlob(null);
      setError(
        err instanceof UnsupportedImageError
          ? t("box.photo.unsupportedFormat", locale)
          : t("box.photo.processError", locale),
      );
    } finally {
      setProcessing(false);
    }
  }

  return { blob, previewUrl, error, processing, select, clear, restore };
}

export default function BoxCheckinPanel({ boxId, onCheckinSuccess, latestPhotoId }: BoxCheckinPanelProps) {
  const { locale } = useLocale();

  const [openKind, setOpenKind] = useState<CheckinKind | null>(null);
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [lastKind, setLastKind] = useState<CheckinKind | null>(null);

  // Slice 5 — the standalone "Add a photo" form and the "filled" note
  // form's own attach are two independent instances of the same hook.
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoSubmitState, setPhotoSubmitState] = useState<PhotoSubmitState>("idle");
  const standalonePhoto = usePhotoAttach();
  const notePhoto = usePhotoAttach();

  // Needs ask (migration 0012) — see this file's own header.
  const [needsAsk, setNeedsAsk] = useState<NeedsAsk | null>(null);
  const [selectedNeeds, setSelectedNeeds] = useState<ReadonlySet<NeedKey>>(new Set());
  const [needsText, setNeedsText] = useState("");
  const [needsSubmitState, setNeedsSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  // needsAsk's own heading gets focus the moment it appears — the ask
  // replaces the button grid in place, so a keyboard/screen-reader user
  // needs to be told where they landed rather than losing focus context.
  const needsHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (needsAsk) needsHeadingRef.current?.focus();
  }, [needsAsk]);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Which Turnstile key produced (or is expected to produce) the current
  // token — see this file's own header, "Fallback to a visible checkbox".
  // Mirrored into a ref because the box widget's error-callback is
  // registered once at mount and must read the CURRENT mode synchronously
  // (a second error-callback firing before a re-render would otherwise see
  // a stale "box" and try to switch again).
  const [turnstileMode, setTurnstileModeState] = useState<"box" | "fallback">("box");
  const turnstileModeRef = useRef<"box" | "fallback">("box");
  function setTurnstileMode(mode: "box" | "fallback") {
    turnstileModeRef.current = mode;
    setTurnstileModeState(mode);
  }

  // A tap that lands before Turnstile's invisible check resolves queues here
  // instead of being dropped or blocking the panel — see this file's own
  // header. Cleared the instant the queued submit actually fires.
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(null);

  function mountTurnstile() {
    if (!turnstileContainerRef.current || !window.turnstile) return;
    if (turnstileWidgetId.current) return; // already mounted

    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      // Dedicated invisible-mode key, check-ins only — never the managed
      // NEXT_PUBLIC_TURNSTILE_SITE_KEY the other three forms use (that key
      // is reserved for the FALLBACK widget below). See this file's own
      // header for why (Kyle, 2026-09-18: the managed checkbox still
      // appeared on his phone even under "interaction-only").
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY ?? "",
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError(false);
      },
      "error-callback": () => {
        // The invisible check doubts this visitor and there's no widget on
        // screen for them to satisfy — swap in a visible checkbox instead
        // of a dead-end error. Any queued tap stays queued; see this file's
        // own header, "Fallback to a visible checkbox".
        switchToFallback();
      },
      "expired-callback": () => {
        setTurnstileToken(null);
      },
    });
  }

  /**
   * Removes the (invisible) box widget and mounts the managed-key fallback
   * widget into the same container — a visible "Verify you are human"
   * checkbox, default appearance. Idempotent (a second call while already
   * in fallback mode is a no-op) and never flips back to box mode: once a
   * visitor's been asked for the visible checkbox, the invisible one has
   * nothing left to prove. Returns false only when the swap genuinely
   * couldn't happen (`window.turnstile` never loaded) — the one case the
   * caller (the pending-submit timeout) still needs to fail the queued tap
   * outright rather than wait on a widget that will never render.
   */
  function switchToFallback(): boolean {
    if (turnstileModeRef.current === "fallback") return true;
    if (!turnstileContainerRef.current || !window.turnstile) return false;

    setTurnstileMode("fallback");
    setTurnstileToken(null);
    setTurnstileError(false);

    if (turnstileWidgetId.current) {
      window.turnstile.remove(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
    }
    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError(false);
      },
      "error-callback": () => {
        setTurnstileToken(null);
        setTurnstileError(true);
      },
      "expired-callback": () => {
        setTurnstileToken(null);
      },
    });
    return true;
  }

  useEffect(() => {
    if (window.turnstile) mountTurnstile();
    return () => {
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, []);

  // Fires a queued tap the moment a token becomes available (first mount,
  // or after `expired-callback` clears a stale one and Turnstile hands back
  // a fresh one). setPendingSubmit is deferred to a microtask — same
  // react-hooks/set-state-in-effect workaround DesktopVenueWindow's own
  // position effect uses (see its own header) — calling it synchronously in
  // the effect body is a lint error (cascading-render risk), even though
  // it's cleared before the async submit call starts, not after.
  useEffect(() => {
    if (!turnstileToken || !pendingSubmit) return;
    const pending = pendingSubmit;
    queueMicrotask(() => setPendingSubmit(null));
    if (pending.type === "checkin") {
      void submitCheckin(pending.kind, pending.note, pending.photoBlob);
    } else if (pending.type === "photo") {
      void submitPhoto(pending.blob, pending.checkinId);
    } else {
      void submitNeeds(pending.checkinId, pending.needsToken, pending.needs, pending.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submitCheckin/submitPhoto close over this render's turnstileToken/honeypot/boxId already; re-running per pendingSubmit/turnstileToken change (not per render) is what this effect wants.
  }, [turnstileToken, pendingSubmit]);

  // The one recovery path both queued-tap failure modes route through — see
  // this file's own header. Restores the note form for a note-kind tap
  // (filled/problem) since handleNoteSubmit already cleared the live
  // note/openKind state at queue time; there's nothing to restore for a
  // one-tap kind (took/low/empty). A queued PHOTO tap (standalone, or one
  // already detached from its checkin) has nothing to "reopen" — its own
  // form was never closed while queued (see handleSendStandalonePhoto) — so
  // it just falls back to the plain error message via photoSubmitState.
  function failQueuedSubmit(pending: PendingSubmit) {
    setPendingSubmit(null);
    if (pending.type === "checkin") {
      setSubmitState("error");
      if (KINDS_WITH_NOTE.has(pending.kind)) {
        setOpenKind(pending.kind);
        setNote(pending.note);
        if (pending.photoBlob) notePhoto.restore(pending.photoBlob);
      }
    } else if (pending.type === "photo") {
      setPhotoSubmitState("error");
    } else {
      // Needs ask — ponytail: drops the visitor's picks rather than
      // restoring the ask with them intact (see this file's own header,
      // "A failed Send ... closes the ask"). needsAsk is already null by
      // this point (cleared at queue time, same as the note form above),
      // so there's no form left open to fail into.
      setNeedsSubmitState("error");
    }
  }

  // Failure mode 1: Turnstile's error-callback fires while a tap is queued.
  // mountTurnstile's callbacks are registered once at mount, so reading
  // pendingSubmit directly inside error-callback would close over a stale
  // (always-null) value — same reason the token-arrival effect above exists
  // instead of firing submitCheckin straight from Turnstile's own callback.
  useEffect(() => {
    if (!turnstileError || !pendingSubmit) return;
    const queued = pendingSubmit;
    queueMicrotask(() => failQueuedSubmit(queued));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- failQueuedSubmit closes over stable setState setters + the notePhoto hook instance; re-running per turnstileError/pendingSubmit change (not per render) is what this effect wants.
  }, [turnstileError, pendingSubmit]);

  // Failure mode 2: the box widget never loads or never calls back at all
  // (content blocker, offline, slow network) — nothing above ever fires
  // without this. Only runs in BOX mode; suspended entirely once
  // turnstileMode is "fallback" (dep below), since a visible checkbox
  // waiting on a real human tap has no natural time bound — see this
  // file's own header. On firing, tries switchToFallback() FIRST (the
  // "no callback at all" case is exactly the case a real visitor most needs
  // the visible widget for) and only falls through to failQueuedSubmit if
  // that swap itself couldn't happen (window.turnstile never loaded — the
  // one case a fallback widget can't be mounted either).
  useEffect(() => {
    if (!pendingSubmit || turnstileMode === "fallback") return;
    const queued = pendingSubmit;
    const timer = setTimeout(() => {
      if (!switchToFallback()) failQueuedSubmit(queued);
    }, PENDING_SUBMIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- switchToFallback/failQueuedSubmit only touch refs and stable setState setters (see switchToFallback's own header), so a fresh closure per render behaves identically; re-running this effect per pendingSubmit/turnstileMode change (not per render) is what it wants.
  }, [pendingSubmit, turnstileMode]);

  async function submitCheckin(kind: CheckinKind, noteValue: string, photoBlob: Blob | null) {
    setSubmitState("submitting");
    setLastKind(kind);

    try {
      const res = await fetch(`/api/public/blessing-boxes/${boxId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          note: noteValue || undefined,
          website: honeypot, // honeypot field
          turnstileToken: turnstileToken ?? "",
          // Which key produced this token — the route picks its
          // verification secret off this field (TURNSTILE_SECRET_KEY for
          // "fallback", TURNSTILE_BOX_SECRET_KEY otherwise). Read off the
          // ref, not the `turnstileMode` state closed over by this render,
          // so a mode flip that happens between queueing and firing (the
          // exact case this whole fallback feature exists for) is never
          // sent stale.
          turnstileKey: turnstileModeRef.current,
          clientToken: getCheckinClientToken() ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        status?: BoxStatus;
        lastFilledAt?: string | null;
        checkinId?: number;
        needsToken?: string;
      };

      // Reviewer fix pass (2026-09-19): the request already succeeded or
      // failed by this point — that outcome must land in state regardless
      // of what the widget does next. Every Turnstile token is single-use,
      // so it's still reset for the next possible tap (and, in BOX mode,
      // this kicks off Turnstile's own re-execution, default `execution:
      // "render"`, which is exactly what an attached photo below is
      // waiting on) — but `reset()` is a call into third-party widget code
      // outside this try, and if IT throws, the outer catch below must not
      // be allowed to reclassify a real success as "error". Own try/catch,
      // after the outcome is already decided.
      try {
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
        }
      } catch {
        // Nothing to recover — the checkin itself already succeeded or
        // failed above; a stale/broken widget only affects the NEXT tap
        // (which re-queues normally, same as if no token ever arrived).
      }
      setTurnstileToken(null);

      if (data.ok) {
        setSubmitState("success");
        setOpenKind(null);
        setNote("");
        if (data.status) {
          onCheckinSuccess({ status: data.status, lastFilledAt: data.lastFilledAt ?? null, kind });
        }
        // A photo was attached to this check-in (slice 5, "filled" only) —
        // queue it for the NEXT token this same widget produces, rather
        // than submitting alongside the checkin itself (the token that
        // just got used is already spent). See this file's own header,
        // "Chaining onto the SAME single-widget Turnstile flow."
        if (photoBlob) {
          setPendingSubmit({ type: "photo", blob: photoBlob, checkinId: data.checkinId ?? null });
        }
        // Needs ask (migration 0012) — only 'took' ever gets asked, and
        // only when there's a real row + capability to attach picks to (see
        // this file's own header). A 'filled' checkin can carry BOTH a
        // queued photo (above) and, structurally, could never also open the
        // ask — the checkins route only mints needsToken for kind==='took'.
        if (kind === "took" && data.checkinId != null && data.needsToken) {
          setNeedsAsk({ checkinId: data.checkinId, needsToken: data.needsToken });
          setSelectedNeeds(new Set());
          setNeedsText("");
          setNeedsSubmitState("idle");
        }
      } else if (data.error === "rate_limit_visitor") {
        setSubmitState("rate_limited_visitor");
      } else if (data.error === "rate_limit_box") {
        setSubmitState("rate_limited_box");
      } else {
        setSubmitState("error");
      }
    } catch {
      setSubmitState("error");
    }
  }

  async function submitPhoto(blob: Blob, checkinId: number | null) {
    setPhotoSubmitState("submitting");
    try {
      const form = new FormData();
      form.set("photo", blob, "photo.jpg");
      if (checkinId !== null) form.set("checkinId", String(checkinId));
      form.set("website", honeypot);
      form.set("turnstileToken", turnstileToken ?? "");
      form.set("turnstileKey", turnstileModeRef.current);
      const clientToken = getCheckinClientToken();
      if (clientToken) form.set("clientToken", clientToken);

      const res = await fetch(`/api/public/blessing-boxes/${boxId}/photos`, { method: "POST", body: form });

      // Reviewer fix pass (2026-09-19) — see submitCheckin's own comment on
      // this same pattern: reset() is third-party widget code and must not
      // be able to reclassify a real outcome as an error via the outer catch.
      try {
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
        }
      } catch {
        // Nothing to recover — see submitCheckin's own comment.
      }
      setTurnstileToken(null);

      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setPhotoSubmitState("success");
        setPhotoOpen(false);
        standalonePhoto.clear();
        notePhoto.clear();
      } else {
        setPhotoSubmitState("error");
      }
    } catch {
      setPhotoSubmitState("error");
    }
  }

  /** Needs ask (migration 0012) — see this file's own header. Same turnstile-reset-after-every-attempt convention as submitCheckin/submitPhoto (a token is single-use regardless of outcome). */
  async function submitNeeds(checkinId: number, needsToken: string, needs: NeedKey[], noteValue: string) {
    setNeedsSubmitState("submitting");
    try {
      const res = await fetch(`/api/public/blessing-boxes/${boxId}/needs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkinId,
          needsToken,
          needs,
          note: noteValue || undefined,
          website: honeypot,
          turnstileToken: turnstileToken ?? "",
          turnstileKey: turnstileModeRef.current,
          clientToken: getCheckinClientToken() ?? undefined,
        }),
      });

      // Reviewer fix pass (2026-09-19) — see submitCheckin's own comment on
      // this same pattern: reset() is third-party widget code and must not
      // be able to reclassify a real outcome as an error via the outer catch.
      try {
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current);
        }
      } catch {
        // Nothing to recover — see submitCheckin's own comment.
      }
      setTurnstileToken(null);

      const data = (await res.json()) as { ok: boolean };
      setNeedsSubmitState(data.ok ? "success" : "error");
    } catch {
      setNeedsSubmitState("error");
    }
  }

  function handleTap(kind: CheckinKind) {
    if (submitState === "submitting" || pendingSubmit) return;
    if (KINDS_WITH_NOTE.has(kind)) {
      setOpenKind(kind);
      setNote("");
      setSubmitState("idle");
      return;
    }
    if (turnstileToken) {
      void submitCheckin(kind, "", null);
    } else {
      // No token yet (interaction-only Turnstile hasn't resolved) — queue
      // instead of submitting with an empty token or dropping the tap. The
      // effect above fires it the moment turnstileToken arrives.
      setPendingSubmit({ type: "checkin", kind, note: "", photoBlob: null });
    }
  }

  function handleNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openKind) return;
    const kind = openKind;
    const noteValue = note.trim();
    const photoBlob = kind === KIND_WITH_PHOTO_ATTACH ? notePhoto.blob : null;
    setOpenKind(null);
    setNote("");
    notePhoto.clear();
    if (turnstileToken) {
      void submitCheckin(kind, noteValue, photoBlob);
    } else {
      setPendingSubmit({ type: "checkin", kind, note: noteValue, photoBlob });
    }
  }

  /** Toggles one chip in the needs ask — multi-select, per the mockup ("Tap any"). */
  function toggleNeed(key: NeedKey) {
    setSelectedNeeds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Skip always just closes the ask locally — no request, nothing to save. */
  function handleNeedsSkip() {
    setNeedsAsk(null);
    setSelectedNeeds(new Set());
    setNeedsText("");
  }

  /**
   * Send with nothing picked and nothing typed behaves exactly like Skip —
   * there's nothing meaningful to save, and sending an empty payload would
   * just be a wasted round trip against the rate limit this shares with the
   * check-in itself. A real submission clears `needsAsk` immediately (the
   * ask disappears whether the request ultimately succeeds or fails — see
   * this file's own header on why a failure doesn't restore it).
   */
  function handleNeedsSend() {
    if (!needsAsk) return;
    const needs = NEED_KEYS.filter((k) => selectedNeeds.has(k));
    const noteValue = needsText.trim();
    if (needs.length === 0 && noteValue === "") {
      handleNeedsSkip();
      return;
    }
    const { checkinId, needsToken } = needsAsk;
    setNeedsAsk(null);
    setSelectedNeeds(new Set());
    setNeedsText("");
    if (turnstileToken) {
      void submitNeeds(checkinId, needsToken, needs, noteValue);
    } else {
      setPendingSubmit({ type: "needs", checkinId, needsToken, needs, note: noteValue });
    }
  }

  function handleSendStandalonePhoto() {
    if (!standalonePhoto.blob || photoSubmitState === "submitting" || pendingSubmit) return;
    setPhotoSubmitState("submitting");
    if (turnstileToken) {
      void submitPhoto(standalonePhoto.blob, null);
    } else {
      setPendingSubmit({ type: "photo", blob: standalonePhoto.blob, checkinId: null });
    }
  }

  const buttonBase =
    "min-h-[44px] px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium text-center " +
    "transition-colors duration-150 border border-[var(--color-bone-300)] text-[var(--color-ink-700)] bg-white " +
    "hover:bg-[var(--color-bone-100)] focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-[var(--color-sage-500)] disabled:opacity-60 disabled:cursor-not-allowed";

  // One action at a time: busy while an actual submit is in flight OR one is
  // queued waiting on a token (see handleTap/handleNoteSubmit above) — never
  // gated on turnstileToken alone, since that would be the old "disabled
  // until Verifying… resolves" behavior this rework removes. Includes
  // needsSubmitState (migration 0012) — a direct (non-queued) needs Send
  // never touches submitState/pendingSubmit at all, so without this the
  // just-reappeared button grid would be tappable WHILE that request is
  // still in flight.
  const busy = submitState === "submitting" || pendingSubmit !== null || needsSubmitState === "submitting";
  // Which single button (if any) shows the "Sending…" label — either the
  // tap actually in flight, or the one queued waiting on a token.
  const busyKind = pendingSubmit?.type === "checkin" ? pendingSubmit.kind : submitState === "submitting" ? lastKind : null;

  return (
    <section aria-labelledby="box-checkin-heading" className="space-y-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={mountTurnstile}
      />
      {/* Card redesign (2026-09-19): display-font question heading, matching the mockup — was a small uppercase label. */}
      <h2
        id="box-checkin-heading"
        className="text-lg font-semibold text-[var(--color-ink-900)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {t("box.checkin.heading", locale)}
      </h2>

      <div role="status" aria-live="polite">
        {submitState === "success" && lastKind && (
          <p className="text-sm font-medium text-[var(--color-success)]">
            {t(`box.checkin.success.${lastKind}`, locale)}
          </p>
        )}
      </div>
      {submitState === "error" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error", locale)}
        </p>
      )}
      {submitState === "rate_limited_visitor" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error.rateLimitVisitor", locale)}
        </p>
      )}
      {submitState === "rate_limited_box" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error.rateLimitBox", locale)}
        </p>
      )}
      {turnstileError && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("form.turnstile.error", locale)}
        </p>
      )}
      {turnstileMode === "fallback" && !turnstileToken && !turnstileError && (
        <p className="text-xs text-[var(--color-ink-700)]">{t("box.checkin.turnstileFallbackPrompt", locale)}</p>
      )}

      {/* Persistent (not inside `photoOpen &&`) — a successful standalone
          send closes that form immediately (matching the checkin note
          form's own auto-close), so the confirmation must live somewhere
          that survives the close, same reasoning the checkin success
          message above lives outside `openKind &&`. */}
      <div role="status" aria-live="polite">
        {photoSubmitState === "success" && (
          <p className="text-sm font-medium text-[var(--color-success)]">{t("box.photo.success", locale)}</p>
        )}
      </div>
      {photoSubmitState === "error" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.photo.error", locale)}
        </p>
      )}

      {/* The needs ask replaces the three button groups below IN PLACE
          (task spec: "the check-in buttons are replaced IN PLACE") — never
          rendered alongside them. */}
      {!needsAsk && (
        <>
          {/* Status trio — colored dot above the label (mockup's ".tri"). */}
          <div className="grid grid-cols-3 gap-2">
            {STATUS_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={buttonBase}
                disabled={busy}
                aria-disabled={busy}
                onClick={() => handleTap(kind)}
              >
                <i aria-hidden className={`block w-2 h-2 rounded-full mx-auto mb-1 ${KIND_DOT_CLASS[kind]}`} />
                {kind === busyKind ? t("box.checkin.submitting", locale) : t(`box.checkin.${kind}`, locale)}
              </button>
            ))}
          </div>

          {/* Second row — "took" (most common action) + "Add a photo". */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={buttonBase}
              disabled={busy}
              aria-disabled={busy}
              onClick={() => handleTap("took")}
            >
              {busyKind === "took" ? t("box.checkin.submitting", locale) : t("box.checkin.took", locale)}
            </button>
            {/* Slice 5 — opens the standalone photo form below rather than submitting anything itself. */}
            <button
              type="button"
              className={buttonBase}
              disabled={busy}
              aria-disabled={busy}
              aria-expanded={photoOpen}
              onClick={() => {
                setPhotoOpen((open) => !open);
                setPhotoSubmitState("idle");
              }}
            >
              {t("box.photo.addButton", locale)}
            </button>
          </div>

          {/* Quiet text links — "Report a problem" (was a grid button; same
              behavior, tap opens the same note form via handleTap below) beside
              "Report photo" when the box has a current photo. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              disabled={busy}
              aria-disabled={busy}
              onClick={() => handleTap("problem")}
              className="inline-flex min-h-[44px] items-center text-xs font-medium text-[var(--color-sage-700)] underline underline-offset-2 disabled:opacity-60"
            >
              {busyKind === "problem" ? t("box.checkin.submitting", locale) : t("box.checkin.problem", locale)}
            </button>
            {latestPhotoId != null && <ReportPhotoButton photoId={latestPhotoId} locale={locale} />}
          </div>
        </>
      )}

      {/* "What would help you next time?" ask (migration 0012) — see this
          file's own header. */}
      {needsAsk && (
        <div className="space-y-3">
          <div>
            <h3
              ref={needsHeadingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-[var(--color-ink-900)] focus:outline-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("box.needs.heading", locale)}
            </h3>
            <p className="text-sm text-[var(--color-ink-500)]">{t("box.needs.sub", locale)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {NEED_KEYS.map((key) => {
              const selected = selectedNeeds.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  disabled={needsSubmitState === "submitting" || pendingSubmit?.type === "needs"}
                  onClick={() => toggleNeed(key)}
                  className={
                    "min-h-[44px] rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
                    "disabled:opacity-60 disabled:cursor-not-allowed " +
                    (selected
                      ? "border-[var(--color-sage-500)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)]"
                      : "border-[var(--color-bone-300)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]")
                  }
                >
                  {t(`box.needs.${key}`, locale)}
                </button>
              );
            })}
          </div>
          <div>
            <label htmlFor="box-needs-other" className="block text-xs font-medium text-[var(--color-ink-700)]">
              {t("box.needs.otherLabel", locale)}
            </label>
            <input
              id="box-needs-other"
              type="text"
              value={needsText}
              onChange={(e) => setNeedsText(e.target.value)}
              maxLength={BOX_CHECKIN_NOTE}
              disabled={needsSubmitState === "submitting" || pendingSubmit?.type === "needs"}
              className={
                "mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 " +
                "text-base md:text-sm text-[var(--color-ink-900)] bg-white " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNeedsSend}
              disabled={needsSubmitState === "submitting" || pendingSubmit?.type === "needs"}
              aria-disabled={needsSubmitState === "submitting" || pendingSubmit?.type === "needs"}
              className={
                "min-h-[44px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
                "text-sm font-semibold hover:bg-[var(--color-sage-600)] disabled:opacity-60 disabled:cursor-not-allowed " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
              }
            >
              {needsSubmitState === "submitting" || pendingSubmit?.type === "needs"
                ? t("box.checkin.submitting", locale)
                : t("box.needs.send", locale)}
            </button>
            <button
              type="button"
              onClick={handleNeedsSkip}
              className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]"
            >
              {t("box.needs.skip", locale)}
            </button>
          </div>
        </div>
      )}

      {/* Persistent (not inside `needsAsk &&`) — the ask disappears the
          instant Send/Skip is tapped (handleNeedsSend/handleNeedsSkip both
          clear needsAsk immediately), so the confirmation must live
          somewhere that survives the close, same reasoning the checkin/
          photo success messages above live outside their own forms'
          conditionals. */}
      <div role="status" aria-live="polite">
        {needsSubmitState === "success" && (
          <p className="text-sm font-medium text-[var(--color-success)]">{t("box.needs.success", locale)}</p>
        )}
      </div>
      {needsSubmitState === "error" && (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {t("box.checkin.error", locale)}
        </p>
      )}

      {openKind && (
        <form onSubmit={handleNoteSubmit} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] p-3">
          <label htmlFor="box-checkin-note" className="block text-xs font-medium text-[var(--color-ink-700)]">
            {t("box.checkin.noteLabel", locale)}
          </label>
          <textarea
            id="box-checkin-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={BOX_CHECKIN_NOTE}
            placeholder={t(`box.checkin.notePlaceholder.${openKind}`, locale)}
            className={
              "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 " +
              "text-base md:text-sm text-[var(--color-ink-900)] bg-white resize-y " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          />
          {openKind === KIND_WITH_PHOTO_ATTACH && (
            <PhotoPickerField
              idPrefix="box-checkin-note-photo"
              label={t("box.photo.attachLabel", locale)}
              attach={notePhoto}
              locale={locale}
            />
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              aria-disabled={busy}
              className={
                "min-h-[44px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
                "text-sm font-semibold hover:bg-[var(--color-sage-600)] disabled:opacity-60 disabled:cursor-not-allowed " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
              }
            >
              {submitState === "submitting" ? t("box.checkin.submitting", locale) : t("box.checkin.submit", locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenKind(null);
                notePhoto.clear();
              }}
              className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]"
            >
              {t("box.checkin.cancel", locale)}
            </button>
          </div>
        </form>
      )}

      {photoOpen && (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] p-3">
          <PhotoPickerField
            idPrefix="box-photo-standalone"
            label={t("box.photo.chooseLabel", locale)}
            attach={standalonePhoto}
            locale={locale}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSendStandalonePhoto}
              disabled={!standalonePhoto.blob || busy || photoSubmitState === "submitting"}
              aria-disabled={!standalonePhoto.blob || busy || photoSubmitState === "submitting"}
              className={
                "min-h-[44px] flex-1 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
                "text-sm font-semibold hover:bg-[var(--color-sage-600)] disabled:opacity-60 disabled:cursor-not-allowed " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
              }
            >
              {photoSubmitState === "submitting" ? t("box.photo.sending", locale) : t("box.photo.send", locale)}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhotoOpen(false);
                standalonePhoto.clear();
                setPhotoSubmitState("idle");
              }}
              className="min-h-[44px] px-4 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)]"
            >
              {t("box.checkin.cancel", locale)}
            </button>
          </div>
        </div>
      )}

      {/* Honeypot — visually hidden from real users, same convention as ReportForm.tsx */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="box-checkin-website">Website</label>
        <input
          id="box-checkin-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div ref={turnstileContainerRef} data-testid="turnstile-widget" />
    </section>
  );
}

// ─── Shared photo-picker UI (slice 5) ──────────────────────────────────────

/**
 * The file-input + preview + inline-error block shared by the standalone
 * "Add a photo" form and the "filled" note form's own attach — reads/writes
 * through a `usePhotoAttach()` instance the caller owns, so this is purely
 * presentational. `accept="image/*"` deliberately omits `capture` — with it
 * set, iOS forces camera-only and a visitor can't pick an existing photo
 * from their library (spec's own instruction).
 */
function PhotoPickerField({
  idPrefix,
  label,
  attach,
  locale,
}: {
  idPrefix: string;
  label: string;
  attach: ReturnType<typeof usePhotoAttach>;
  locale: Locale;
}) {
  const inputId = `${idPrefix}-input`;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-medium text-[var(--color-ink-700)]">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file after a clear
          if (file) void attach.select(file, locale);
        }}
        className="block w-full text-sm text-[var(--color-ink-700)] file:mr-3 file:rounded-[var(--radius-md)] file:border file:border-[var(--color-bone-300)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink-700)] hover:file:bg-[var(--color-bone-100)]"
      />
      {attach.processing && <p className="text-xs text-[var(--color-ink-500)]">{t("box.photo.processing", locale)}</p>}
      {attach.error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {attach.error}
        </p>
      )}
      {attach.previewUrl && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview URL, not a build-time/remote asset next/image can optimize */}
          <img
            src={attach.previewUrl}
            alt={t("box.photo.previewAlt", locale)}
            className="h-20 w-20 rounded-[var(--radius-md)] border border-[var(--color-bone-200)] object-cover"
          />
          <button
            type="button"
            onClick={attach.clear}
            className="text-xs font-medium text-[var(--color-sage-700)] underline underline-offset-2"
          >
            {t("box.photo.remove", locale)}
          </button>
        </div>
      )}
      <p className="text-xs text-[var(--color-ink-500)]">{t("box.photo.disclosure", locale)}</p>
    </div>
  );
}
