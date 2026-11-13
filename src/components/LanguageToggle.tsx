"use client";

/**
 * LanguageToggle — EN | ES two-way slider (#917 round 3, the design system's
 * slider: owner ruling "sliders for a two- or three-way switch").
 *
 * Consumes LocaleContext via useLocale(). Renders a button group on a
 * bone 200 track with a sage 600 thumb behind the active word:
 *   - The thumb slides to the other word in 250 ms on --ease-out-circ (R5).
 *   - Both segments are the same 48 by 40 box, inline-flex centered with a
 *     fixed line height, whether a <button> or an <a> (below), so the words
 *     never shift. Before, a mirrored page's <a> segment was inline (not
 *     centered like the <button>), so EN and ES sat at different heights.
 *   - Keyboard accessible: Tab to focus, Enter/Space to activate.
 *   - Screen reader: announces "Language: English, button" / "Language: Spanish, button".
 *
 * Spec: github.com/kr8vka0z/pueblo-food-map/issues/68
 *
 * #689 PR 2, design decision 8: on a MIRRORED page (this pathname has an
 * /es counterpart — mirroredCounterpartHref returns non-null), the segment
 * for the tree you're NOT currently on (l !== tree) renders as a real <a>
 * href to that counterpart URL instead of an in-place setLocale() button —
 * crossing root layouts is a full page load (design decision 2), so a
 * client-side setLocale() there would leave the URL/server metadata/JSON-LD
 * un-switched. Its `href` is the bare counterpart pathname (correct for a
 * no-JS visitor or a crawler); its `onClick` preventDefaults and re-navigates
 * via `location.assign` with the CURRENT page's query/hash appended, since
 * a plain href can't carry those (review fix — see the onClick's own
 * comment). The segment matching the CURRENT tree (l === tree) stays the
 * original in-place button — unaffected, same as a non-mirrored page. When
 * `usePathname()` has no counterpart (non-mirrored page, or null — the
 * value in this test suite without a route mocked), BOTH segments are the
 * original buttons: byte-identical to pre-#689 behavior.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/LocaleContext";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { track, EVENTS } from "@/lib/analytics";
import { mirroredCounterpartHref } from "@/lib/localizedHref";
import { writeLocaleCookie } from "@/lib/LocaleContext";

const LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

const SR_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
};

// WHY identical for both <button> and <a>: the two must draw the same box,
// or the words sit at different heights (the #917 round 3 jump). 48 wide,
// 40 tall, 14px semibold on a fixed 20px line; the ::before reaches the
// track's 4px padding above and below, so each taps at 48 by 48 and the two
// meet in the middle without overlapping (#233).
const SEGMENT_CLASS =
  "relative inline-flex h-[40px] w-12 items-center justify-center rounded-[var(--radius-md)] " +
  "text-sm font-semibold leading-5 transition-colors duration-250 ease-out-circ motion-reduce:transition-none " +
  "before:absolute before:inset-x-0 before:-inset-y-1 " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bone-200)] ";

function segmentColorClass(active: boolean): string {
  // The active word sits on the thumb; R1: the other one takes the sage 100
  // hover fill (words stay ink 700 on it).
  return active
    ? "text-[var(--color-bone-50)]"
    : "text-[var(--color-ink-700)] hover:bg-[var(--color-sage-100)]";
}

export default function LanguageToggle() {
  const { locale, setLocale, tree } = useLocale();
  const pathname = usePathname();
  const counterpartHref = pathname ? mirroredCounterpartHref(pathname, tree) : null;
  // The mirrored link is a full page load, so `locale` never changes on this
  // page. Moving the thumb to the tapped word right away lets it slide while
  // the next page loads, instead of nothing happening until it arrives.
  const [pending, setPending] = useState<Locale | null>(null);
  // Back to this page from the browser's back/forward cache: the thumb must
  // sit on the page's real language again, not the one tapped before leaving.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const thumbOn = pending ?? locale;

  return (
    <div
      role="group"
      aria-label={t("lang.toggle.label", locale)}
      // The design system's slider (docs/design/design-system/mock.css `.rs`):
      // a bone 200 track, corners radius-lg, 4px padding. No overflow-hidden
      // (#233): it would clip the segments' ::before tap overlays.
      className="relative inline-flex rounded-[var(--radius-lg)] bg-[var(--color-bone-200)] p-1"
    >
      {/* The thumb: sage 600 (primary), corners radius-md (the track's minus
          its 4px padding), behind the active word; first in the DOM so the
          segments paint over it. */}
      <span
        aria-hidden
        className={
          "pointer-events-none absolute left-1 top-1 bottom-1 w-12 rounded-[var(--radius-md)] " +
          "bg-[var(--color-sage-600)] shadow-[0_2px_6px_rgba(26,24,23,0.25)] " +
          "transition-transform duration-250 ease-out-circ motion-reduce:transition-none " +
          (thumbOn === "es" ? "translate-x-[48px]" : "translate-x-0")
        }
      />
      {(["en", "es"] as Locale[]).map((l) => {
        const active = locale === l;

        // On a mirrored page, the segment for the tree we're NOT on is a
        // real cross-tree link (see this file's header). The segment
        // matching the current tree stays the ordinary in-place button.
        if (counterpartHref && l !== tree) {
          return (
            <a
              key={l}
              href={counterpartHref}
              // href is the bare pathname (no query/hash — a no-JS visitor
              // or a crawler following this link still lands on the right
              // TREE, just not necessarily the exact same map state).
              // onClick (review fix): writes the cookie + fires the same
              // analytics event as the in-place toggle, THEN preventDefault
              // + location.assign with the CURRENT page's query/hash
              // appended — a plain href can't carry those (mirroredCounterpartHref
              // never sees them; see its own header), so without this a tap
              // on the toggle from e.g. /?venue=<id> would silently drop
              // that state crossing trees. Still a full page load
              // (location.assign, not router.push) — crossing root layouts
              // always is, design decision 2.
              onClick={(e) => {
                // Nit fix: a modified click (middle-click, ctrl/cmd/shift/
                // alt+click) means "open in a new tab/window" — the
                // browser's own default handling for a real <a> already
                // does that correctly. preventDefault()-ing it here would
                // break that expectation (e.g. cmd+click silently
                // navigating the CURRENT tab instead of opening a new
                // one). Let it through unmodified; only a plain left-click
                // gets the cookie-write + query/hash-preserving override.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                writeLocaleCookie(l);
                void track(EVENTS.LOCALE_SWITCHED, { to: l });
                setPending(l);
                e.preventDefault();
                window.location.assign(counterpartHref + window.location.search + window.location.hash);
              }}
              // aria-pressed is a button-only ARIA state (jsx-a11y/role-
              // supports-aria-props) — this is a real <a>, so aria-current
              // is the link-appropriate equivalent for "this is the
              // currently-shown language."
              aria-current={active ? "true" : undefined}
              aria-label={`Language: ${SR_LABELS[l]}`}
              className={SEGMENT_CLASS + segmentColorClass(l === thumbOn)}
            >
              {LABELS[l]}
            </a>
          );
        }

        return (
          <button
            key={l}
            type="button"
            onClick={() => {
              // #485 PR 2: only an ACTUAL switch counts — tapping the
              // already-active pill is a no-op tap, not a language change.
              if (l !== locale) void track(EVENTS.LOCALE_SWITCHED, { to: l });
              setLocale(l);
            }}
            aria-pressed={active}
            aria-label={`Language: ${SR_LABELS[l]}`}
            className={SEGMENT_CLASS + segmentColorClass(l === thumbOn)}
          >
            {LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
