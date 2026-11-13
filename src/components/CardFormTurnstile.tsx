"use client";

/**
 * CardFormTurnstile — the Turnstile <Script> + widget container the two box
 * card forms (AdoptBoxForm, BoxAlertSignupForm) render in every branch
 * (closed, open, success).
 *
 * Each form renders this UNCONDITIONALLY, even while collapsed: mounting the
 * (invisible) widget the instant the form exists, not only once it is
 * expanded, means a token is very likely already resolved by the time a
 * visitor finishes typing and taps submit. It also fixes a real mount-timing
 * bug: useTurnstile's mount-on-first-render effect runs exactly once — if the
 * container div were only rendered after `open` flips true, that effect would
 * already have run and found no container to mount into, and nothing would
 * ever retry. Each form keeps it in the same tree position (fragment child
 * #2) in every branch, so React keeps the SAME container div across
 * open/close/success instead of orphaning the widget mounted inside.
 *
 * #669 — a doubted visitor's fallback checkbox must not show while the form
 * is collapsed (it was rendering above the box's name, under the sponsor
 * band, for a form nobody had opened). The container must still stay in the
 * DOM (see above), so while `!visible` it is moved OFF-SCREEN with
 * `position: absolute` rather than `display:none` — Cloudflare's widget can
 * fail to render into a `display:none` container (no laid-out box for its
 * iframe), where an off-screen absolute position still gives it real
 * dimensions. Each form passes `visible = open && state !== "success"`:
 * nothing is left to verify once the submit already went through.
 *
 * `onReady`, not `onLoad`: these forms mount after BoxCheckinPanel already
 * loaded the script (useTurnstile.ts's header).
 */

import Script from "next/script";
import type { RefObject } from "react";

export default function CardFormTurnstile({
  containerRef,
  onReady,
  visible,
  testId,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  onReady: () => void;
  visible: boolean;
  testId: string;
}) {
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" onReady={onReady} />
      <div
        ref={containerRef}
        data-testid={testId}
        aria-hidden={visible ? undefined : true}
        className={visible ? undefined : "absolute -left-[9999px] -top-[9999px] pointer-events-none"}
      />
    </>
  );
}
