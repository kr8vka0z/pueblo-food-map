"use client";

/**
 * useBoxTurnstileWidget — a shared Turnstile mount for the box adopt/alert
 * inline forms (Blessing Boxes slice 6). Extracted so the two new forms
 * (AdoptBoxForm, BoxAlertSignupForm) share one mount/fallback
 * implementation instead of two more copies of it.
 *
 * ponytail: this is a DELIBERATELY SMALLER slice of
 * BoxCheckinPanel.tsx's own Turnstile state machine (that file's own
 * header documents the full design this borrows from) — it keeps the two
 * real pieces (mount the dedicated invisible box key; fall back to the
 * managed checkbox key on error-callback so a doubted visitor always has a
 * way through) and drops BoxCheckinPanel's queued-TAP machinery
 * (pendingSubmit, the 15s no-callback timeout, failQueuedSubmit's note/
 * photo restore) — each consuming form owns its own small version of that
 * queue instead (see AdoptBoxForm.tsx's own header). The ceiling: a click
 * that lands before a token exists shows "Sending…" and fires the instant
 * one arrives, but there is no restore-on-failure — fine here because
 * these forms stay open on failure (nothing to restore), unlike a one-tap
 * check-in button that closes its note form immediately. BoxCheckinPanel is
 * NOT refactored to consume this hook (out of this slice's lane); unifying
 * the two is a fair follow-up if a third form ever needs the same mount
 * logic.
 *
 * The container ref is a PARAMETER, not part of this hook's return value —
 * this repo's ESLint config (the React Compiler's `react-hooks/refs` rule)
 * flags a ref bundled into the same object as ordinary reactive state,
 * because it can't verify every access of that object is ref-safe. Every
 * consuming form declares its own `useRef<HTMLDivElement>(null)` locally
 * (the same pattern BoxCheckinPanel.tsx already uses directly, which is
 * why that file has never tripped this rule) and passes it in here.
 *
 * Renders no <Script> of its own — see each consuming form's own render,
 * which uses next/script's `onReady` (not `onLoad`, unlike BoxCheckinPanel):
 * these forms mount well after page load, by which point BoxCheckinPanel
 * (always present on the same card) has typically already loaded
 * https://challenges.cloudflare.com/turnstile/v0/api.js — next/script
 * dedupes by `src`, and per Next's own docs `onLoad` only fires once per
 * document load (a no-op for a script that's already loaded), while
 * `onReady` fires both on first load AND on every subsequent mount — this
 * hook's own `useEffect` mount-if-already-loaded check is a second,
 * belt-and-suspenders path for the same "already loaded" case.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export type BoxTurnstileMode = "box" | "fallback";

export interface UseBoxTurnstileWidget {
  token: string | null;
  mode: BoxTurnstileMode;
  error: boolean;
  /** Call once a token has been consumed (single-use) — resets the current widget and, in "box" mode, kicks off Turnstile's own re-execution. */
  reset: () => void;
  /** Mounts (or re-mounts) the box widget if nothing is mounted yet — safe to pass directly to <Script onReady>. */
  mount: () => void;
}

export function useBoxTurnstileWidget(containerRef: RefObject<HTMLDivElement | null>): UseBoxTurnstileWidget {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [mode, setModeState] = useState<BoxTurnstileMode>("box");
  const modeRef = useRef<BoxTurnstileMode>("box");
  const widgetId = useRef<string | null>(null);

  function setMode(next: BoxTurnstileMode) {
    modeRef.current = next;
    setModeState(next);
  }

  function mount() {
    if (!containerRef.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY ?? "",
      callback: (t) => {
        setToken(t);
        setError(false);
      },
      "error-callback": () => switchToFallback(),
      "expired-callback": () => setToken(null),
    });
  }

  /** Same fallback shape as BoxCheckinPanel.tsx's own switchToFallback — see that file's header for the full reasoning. Flips at most once, never back. */
  function switchToFallback() {
    if (modeRef.current === "fallback") return;
    if (!containerRef.current || !window.turnstile) {
      setError(true);
      return;
    }
    setMode("fallback");
    setToken(null);
    setError(false);
    if (widgetId.current) {
      window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    }
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
      callback: (t) => {
        setToken(t);
        setError(false);
      },
      "error-callback": () => setError(true),
      "expired-callback": () => setToken(null),
    });
  }

  useEffect(() => {
    if (window.turnstile) mount();
    return () => {
      if (window.turnstile && widgetId.current) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount() only touches refs and stable setState setters; this effect should run once per mount, not once per render.
  }, []);

  // WHY the try/catch: window.turnstile.reset() THROWS if the widget's
  // container has left the DOM. Both card forms call reset() right after
  // their POST returns, before reading the response — so a throw here skipped
  // the success state entirely and left the button on "Sending…" forever even
  // though the server had saved the application (Kyle's phone, 2026-09-19).
  // A reset that fails must never break the caller; drop the dead widget id
  // and mount a fresh one if the container is still around.
  //
  // WHY it also RE-RENDERS when the container is empty: a widget whose iframe
  // is no longer inside our container can sit there "valid" and never call
  // back again — reset() on it neither throws nor produces a token, so a
  // queued submit waits forever (Kyle's phone again, same night: the alert
  // sign-up sat on "Sending…" and no request ever reached the server). An
  // empty container is the reliable sign; rebuild in whichever mode we're in.
  function reset() {
    setToken(null);
    if (!window.turnstile) return;
    const container = containerRef.current;
    const widgetAlive = widgetId.current !== null && container !== null && container.childElementCount > 0;
    if (widgetAlive) {
      try {
        window.turnstile.reset(widgetId.current as string);
        return;
      } catch {
        // fall through to a rebuild
      }
    }
    if (widgetId.current) {
      try {
        window.turnstile.remove(widgetId.current);
      } catch {
        // already gone — nothing to remove
      }
      widgetId.current = null;
    }
    if (!container) return;
    if (modeRef.current === "box") {
      mount();
    } else {
      // Re-enter the fallback render path: it only short-circuits when the
      // mode is ALREADY fallback, so step back to "box" for the one call.
      modeRef.current = "box";
      switchToFallback();
    }
  }

  return { token, mode, error, reset, mount };
}
