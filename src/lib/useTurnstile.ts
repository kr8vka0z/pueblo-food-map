"use client";

/**
 * useTurnstile — the one Cloudflare Turnstile widget lifecycle every public
 * form uses (mount, token, error, reset, cleanup). Two keys:
 *
 * - **managed** (default): `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, the visible
 *   "Verify you are human" widget. Feedback, Report and Suggest use this.
 * - **box** (`{ box: true }`): the dedicated invisible key
 *   `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY` (BoxCheckinPanel, AdoptBoxForm,
 *   BoxAlertSignupForm). When Cloudflare doubts a visitor, the invisible
 *   widget's error-callback swaps it for the managed widget in the same
 *   container (`mode` becomes "fallback"), so the visitor always has a way
 *   through. It flips at most once and never back. The POST body carries
 *   `turnstileKey: mode` so the route verifies against the matching secret
 *   (src/lib/boxTurnstile.ts). BoxCheckinPanel.tsx's header has the history.
 *
 * Two reset() behaviours, one per form, never both: by default reset()
 * rebuilds a dead widget (see reset() below) — the card forms AdoptBoxForm
 * and BoxAlertSignupForm rely on that. `rebuildDeadWidget: false` keeps a
 * plain reset: BoxCheckinPanel already owns its own dead-widget recovery
 * (its 15 s timeout → switchToFallback), and two recovery paths racing would
 * deliver two tokens to one queued tap; the page forms never had the phone
 * bug the rebuild fixes.
 *
 * Queued submits (a tap that lands before a token exists) stay in each form:
 * BoxCheckinPanel's queue restores a closed note form on failure and the
 * other forms' don't, so the shapes differ. `switchToFallback()` is exposed
 * because BoxCheckinPanel's 15 s no-callback timeout calls it directly.
 *
 * The container ref is a PARAMETER, not part of the return value: the React
 * Compiler's `react-hooks/refs` lint rule flags a ref bundled into an object
 * with ordinary reactive state. Each form declares its own
 * `useRef<HTMLDivElement>(null)` and passes it in.
 *
 * Renders no <Script>: each form loads
 * https://challenges.cloudflare.com/turnstile/v0/api.js itself and passes
 * `mount` to `onLoad` (page forms) or `onReady` (card forms, which mount after
 * BoxCheckinPanel already loaded the script — `onLoad` fires once per
 * document, `onReady` on every mount). The mount-if-already-loaded effect
 * below covers the same case a second way.
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export type TurnstileMode = "box" | "fallback";

export interface UseTurnstile {
  token: string | null;
  /** Always "box" for a managed-only form (no `box` option); never read there. */
  mode: TurnstileMode;
  error: boolean;
  /** The mode right now, read off a ref — for a POST fired from a closure that may predate the last fallback switch. */
  currentMode: () => TurnstileMode;
  /** Mounts the widget if nothing is mounted yet — safe to pass to <Script onLoad/onReady>. */
  mount: () => void;
  /** Call once a token has been used (tokens are single-use): clears it and resets the widget so the next one arrives. */
  reset: () => void;
  /** The server said `turnstile_failed`: reset, then show the "couldn't verify" message. */
  fail: () => void;
  /** Box widget → managed fallback widget. False only when Turnstile never loaded (nothing to mount). */
  switchToFallback: () => boolean;
}

export function useTurnstile(
  containerRef: RefObject<HTMLDivElement | null>,
  { box = false, rebuildDeadWidget = true }: { box?: boolean; rebuildDeadWidget?: boolean } = {},
): UseTurnstile {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [mode, setModeState] = useState<TurnstileMode>("box");
  // Mirrored into a ref: widget callbacks are registered once at mount and
  // must read the CURRENT mode (a second error-callback before a re-render
  // would otherwise see a stale "box" and switch again).
  const modeRef = useRef<TurnstileMode>("box");
  const widgetId = useRef<string | null>(null);

  function setMode(next: TurnstileMode) {
    modeRef.current = next;
    setModeState(next);
  }

  /** The managed widget, as the primary widget of a page form or as the box fallback. */
  function renderManaged(container: HTMLDivElement): string {
    return window.turnstile!.render(container, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
      callback: (t) => {
        setToken(t);
        setError(false);
      },
      "error-callback": () => {
        setToken(null);
        setError(true);
      },
      "expired-callback": () => {
        setToken(null);
        setError(false);
      },
    });
  }

  function mount() {
    if (!containerRef.current || !window.turnstile || widgetId.current) return;
    if (!box) {
      widgetId.current = renderManaged(containerRef.current);
      return;
    }
    widgetId.current = window.turnstile.render(containerRef.current, {
      // Invisible-mode key, box forms only. Never the managed key, which is
      // reserved for the fallback below (Kyle, 2026-09-18: the managed
      // checkbox still showed on his phone even under "interaction-only").
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY ?? "",
      callback: (t) => {
        setToken(t);
        setError(false);
      },
      // The invisible check doubts this visitor and nothing is on screen for
      // them to satisfy: show the visible checkbox instead of a dead end.
      "error-callback": () => {
        if (!switchToFallback()) setError(true);
      },
      "expired-callback": () => setToken(null),
    });
  }

  function switchToFallback(): boolean {
    if (modeRef.current === "fallback") return true;
    if (!containerRef.current || !window.turnstile) return false;
    setMode("fallback");
    setToken(null);
    setError(false);
    if (widgetId.current) {
      window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    }
    widgetId.current = renderManaged(containerRef.current);
    return true;
  }

  useEffect(() => {
    if (window.turnstile) mount();
    return () => {
      if (window.turnstile && widgetId.current) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount() only touches refs and stable setState setters; run once per mount, not per render.
  }, []);

  // WHY reset() never throws: window.turnstile.reset() THROWS if the widget's
  // container has left the DOM, and the card forms call reset() right after
  // their POST returns. A throw there skipped the success state and left the
  // button on "Sending…" though the server had saved the application (Kyle's
  // phone, 2026-09-19).
  //
  // WHY it REBUILDS when the container is empty: a widget whose iframe is no
  // longer inside our container can sit "valid" and never call back again;
  // reset() on it neither throws nor produces a token, so a queued submit
  // waits forever (Kyle's phone, same night). An empty container is the
  // reliable sign; rebuild in whichever mode we're in.
  function reset() {
    setToken(null);
    if (!window.turnstile) return;
    if (!rebuildDeadWidget) {
      try {
        if (widgetId.current) window.turnstile.reset(widgetId.current);
      } catch {
        // A broken widget only affects the next submit, which waits for a token like the first one did.
      }
      return;
    }
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
    if (modeRef.current === "fallback") {
      widgetId.current = renderManaged(container);
    } else {
      mount();
    }
  }

  function fail() {
    reset();
    setError(true);
  }

  return { token, mode, error, currentMode: () => modeRef.current, mount, reset, fail, switchToFallback };
}
